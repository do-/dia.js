const Dia = require ('../../Dia.js')

module.exports = class extends Dia.DB.Client {

    async finish_txn (success) {
    
        if (success) {
            await this.commit ()
        }
        else {
            darn ('[WARNING] Rolling back uncommitted transaction')
            await this.rollback ()
        }

    }
    
    async release (success) {
    
        if (this.backend.is_txn_pending) try {        
            this.finish_txn (success)
        }
        catch (x) {
            darn (x)
        }
        
        return await this.backend.release ()
    
    }
    
    fix_sql (original_sql) {    
        let parts = original_sql.split ('?')
        let sql = parts.shift ()
        let cnt = 0
        for (let part of parts) sql += `$${++cnt}${part}`        
        return sql    
    }

    to_limited_sql_params (original_sql, original_params, limit, offset) {
        let params = original_params.slice ()
        params.push (limit)
        params.push (offset)
        return [original_sql + ' LIMIT ? OFFSET ?', params]
    }

    async select_all (original_sql, params = []) {
    
        let sql = this.fix_sql (original_sql)
        
        let label = this.log_prefix + sql.replace (/\s+/g, ' ') + ' ' + JSON.stringify (params)
        
        console.time (label)
        
        try {
            let result = await this.backend.query (sql, params)
            return result.rows
        }
        finally {
            console.timeEnd (label)
        }
        
    }
    
    async select_loop (sql, params, callback, data) {
        let all = await this.select_all (sql, params)
        for (let one of all) callback (one, data)
        return data
    }

    async select_hash (sql, params) {
        let all = await this.select_all (sql, params)
        return all.length ? all [0] : {}
    }
    
    async select_scalar (sql, params) {
        let r = await this.select_hash (sql, params)
        for (let k in r) return r [k]
        return null
    }

    async get (def) {
        let q =  this.query (def)
        let [limited_sql, limited_params] = this.to_limited_sql_params (q.sql, q.params, 1)
        let getter = q.parts [0].cols.length == 1 ? this.select_scalar : this.select_hash
        return getter.call (this, q.sql, q.params)
    }
    
    async upsert (table, data, key) {

        if (Array.isArray (data)) {
            for (let d of data) await this.upsert (table, d, key)
            return
        }
        
        if (typeof data !== 'object') throw 'upsert called with wrong argument: ' + JSON.stringify ([table, data])
        if (data === null) throw 'upsert called with null argument: ' + JSON.stringify ([table, data])

        let def = this.model.tables [table]
        if (!def) throw 'Table not found: ' + table

        if (!key) key = [def.pk]
        if (!Array.isArray (key)) key = [key]
        
        let [fields, args, set, params] = [[], [], [], []]
        
        for (let k in data) {
            fields.push (k)
            args.push ('?')
            params.push (data [k])
            if (key.indexOf (k) < 0) set.push (`${k}=COALESCE(EXCLUDED.${k},${table}.${k})`)
        }
// TODO: eliminate "fake"!!!        
        let sql = `INSERT INTO ${table} (${fields}) VALUES (${args}) ON CONFLICT (${key}) WHERE fake = 0 DO UPDATE SET ${set} RETURNING id`

        return this.select_scalar (sql, params)
        
    }
    
    async insert (table, data) {
    
        let def = this.model.tables [table]
        if (!def) throw 'Table not found: ' + table

        if (Array.isArray (data)) {
            for (let d of data) await this.insert (table, d)
            return
        }
        
        let [fields, args, params] = [[], [], []]
        
        for (let k in data) {
            if (!def.columns [k]) continue
            let v = data [k]
            if (typeof v === 'undefined') continue            
            fields.push (k)
            args.push ('?')
            params.push (v)
        }
        
        if (!fields.length) throw 'No known values provided to insert in ' + table + ': ' + JSON.stringify (data)

        let sql = `INSERT INTO ${table} (${fields}) VALUES (${args})`
        
        let pk = def.pk
        if (!data [pk]) sql += ` RETURNING ${pk}`

        return this.select_scalar (sql, params)

    }

    async do (original_sql, params = []) {
    
        let sql = this.fix_sql (original_sql)
        
        let label = this.log_prefix + sql.replace (/\s+/g, ' ') + ' ' + JSON.stringify (params)
        
        console.time (label)
        
        try {
            return await this.backend.query (sql, params)
        }
        finally {
            console.timeEnd (label)
        }
        
    }
    
    is_auto_commit () {
        if (this.backend.is_txn_pending) return true
        return false
    }
    
    async begin () {
        if (this.backend.is_txn_pending) throw "Nested transactions are not supported"
        await this.do ('BEGIN')
        this.backend.is_txn_pending = true
    }
    
    async commit () {
        if (this.auto_commit) return
        await this.do ('COMMIT')
        this.backend.is_txn_pending = false
    }
    
    async rollback () {
        if (this.auto_commit) return
        await this.do ('ROLLBACK')
        this.backend.is_txn_pending = false
    }
    
    async load_schema_tables () {

        let rs = await this.select_all (`

            SELECT 
                pg_class.relname AS name
                , pg_description.description AS label
            FROM 
                pg_namespace
                LEFT JOIN pg_class ON (
                    pg_class.relnamespace = pg_namespace.oid
                    AND pg_class.relkind = 'r'
                )
                LEFT JOIN pg_description ON (
                    pg_description.objoid = pg_class.oid
                    AND pg_description.objsubid = 0
                )
            WHERE
                pg_namespace.nspname = current_schema()

        `, [])
        
        let tables = this.model.tables
        for (let r of rs) {
            let t = tables [r.name]
            if (!t) continue
            r.columns = {}
            r.keys = {}
            r.triggers = {}
            t.existing = r
        }

    }
    
    async load_schema_table_columns () {
    
        let rs = await this.select_all (`

            SELECT 
                pg_attribute.*
                , pg_type.typname
                , pg_attrdef.adsrc
                , pg_description.description
                , pg_class.relname
                , CASE atttypid
                    WHEN 21 /*int2*/ THEN 16
                    WHEN 23 /*int4*/ THEN 32
                    WHEN 20 /*int8*/ THEN 64
                    WHEN 1700 /*numeric*/ THEN
                         CASE WHEN atttypmod = -1
                           THEN null
                           ELSE ((atttypmod - 4) >> 16) & 65535     -- calculate the precision
                           END
                    WHEN 700 /*float4*/ THEN 24 /*FLT_MANT_DIG*/
                    WHEN 701 /*float8*/ THEN 53 /*DBL_MANT_DIG*/
                    ELSE null
                END   AS numeric_precision,
                CASE 
                  WHEN atttypid IN (21, 23, 20) THEN 0
                  WHEN atttypid IN (1700) THEN            
                    CASE 
                        WHEN atttypmod = -1 THEN null       
                        ELSE (atttypmod - 4) & 65535            -- calculate the scale  
                    END
                     ELSE null
                END AS numeric_scale                
            FROM 
                pg_namespace
                LEFT JOIN pg_class ON (
                    pg_class.relnamespace = pg_namespace.oid
                    AND pg_class.relkind = 'r'
                )
                LEFT JOIN pg_attribute ON (
                    pg_attribute.attrelid = pg_class.oid
                    AND pg_attribute.attnum > 0
                    AND NOT pg_attribute.attisdropped
                )
                LEFT JOIN pg_type ON pg_attribute.atttypid = pg_type.oid
                LEFT JOIN pg_attrdef ON (
                    pg_attrdef.adrelid = pg_attribute.attrelid
                    AND pg_attrdef.adnum = pg_attribute.attnum
                )
                LEFT JOIN pg_description ON (
                    pg_description.objoid = pg_attribute.attrelid
                    AND pg_description.objsubid = pg_attribute.attnum
                )
            WHERE
                pg_namespace.nspname = current_schema()

        `, [])
//darn (rs)        
        let tables = this.model.tables
        for (let r of rs) {        

            let t = tables [r.relname]
            if (!t) continue
            
            let name = r.attname
            
            let col = {
                name,
                TYPE_NAME : r.typname.toUpperCase (),
                REMARK    : r.description,
                NULLABLE  : !!!r.attnotnull,
                COLUMN_DEF: undefined,
            }                        

            if (r.adsrc != null) col.COLUMN_DEF = String (r.adsrc)

            if (col.TYPE_NAME == 'NUMERIC') {
                col.COLUMN_SIZE = r.numeric_precision
                col.DECIMAL_DIGITS = r.numeric_scale
            }

            t.existing.columns [name] = col
            
        }
        
    }
    
    async load_schema_table_keys () {
    
        let rs = await this.select_all (`
            SELECT 
                *
            FROM 
                pg_indexes
            WHERE 
                schemaname = current_schema ()
        `, [])

        let tables = this.model.tables
        let re_pk = /_pkey$/

        for (let r of rs) {

            let t = tables [r.tablename]
            if (!t) continue
            
            let k = r.indexname            
            let v = r.indexdef
            
            if (re_pk.test (k)) t.existing.pk = v; else t.existing.keys [k] = v

        }
        
    }
    
    async load_schema_table_triggers () {
    
        let rs = await this.select_all (`

            SELECT 
                pg_class.relname tablename
                , SUBSTRING (pg_trigger.tgname, 4, LENGTH (pg_trigger.tgname) - 4 - LENGTH (pg_class.relname)) k
                , pg_proc.prosrc v
            FROM
                pg_trigger 
                INNER JOIN pg_proc ON pg_proc.oid=pg_trigger.tgfoid
                INNER JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
                INNER JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
            WHERE
                pg_namespace.nspname = current_schema()

        `, [])          
        
        let tables = this.model.tables

        for (let r of rs) {
        
            let t = tables [r.tablename]
            if (!t) continue
            
            t.existing.triggers [r.k] = r.v.trim ()
        
        }
    
    }

}