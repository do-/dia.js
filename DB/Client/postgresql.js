const Dia = require ('../../Dia.js')
const {Readable, Transform, PassThrough} = require ('stream')

let pg_query_stream; try {pg_query_stream = require ('pg-query-stream')} catch (x) {}

module.exports = class extends Dia.DB.Client {

    is_pk_violation (e) {
        return e.code == '23505' && /_pkey$/.test (e.constraint)
    }

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
            await this.finish_txn (success)
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
        
        let label = (this.log_prefix || '') + sql.replace (/^\s+/g, '').replace (/\s+/g, ' ') + ' ' + JSON.stringify (params)
        
        console.time (label)
        
        try {
            let result = await this.backend.query (sql, params)
            return result.rows
        }
        finally {
            console.timeEnd (label)
        }
        
    }
    
    async select_stream (original_sql, params, o) {
    	
        let sql = this.fix_sql (original_sql)

        let label = (this.log_prefix || '') + sql.replace (/^\s+/g, '').replace (/\s+/g, ' ') + ' ' + JSON.stringify (params)
        
        console.time (label)
        
        let qs = require ('pg-query-stream')

    	let stream = this.backend.query (new qs (sql, params, o))
    	
    	stream.on ('end', () => console.timeEnd (label))
    	
    	return stream

    }
    
    async select_loop (sql, params, callback, data) {
    	if (pg_query_stream) return super.select_loop (sql, params, callback, data)
        let all = await this.select_all (sql, params)
        for (let one of all) callback (one, data)
        return data
    }

    async select_hash (sql, params) {
        let all = await this.select_all (sql, params)
        return all.length ? all [0] : {}
    }
    
    async get (def) {
        let q =  this.query (def)
        let [limited_sql, limited_params] = this.to_limited_sql_params (q.sql, q.params, 1)
        let getter = q.parts [0].cols.length == 1 ? this.select_scalar : this.select_hash
        return getter.call (this, q.sql, q.params)
    }
    
    async create_temp_as (src, cols = '*', name = '_') {

    	await this.do ('DROP TABLE IF EXISTS ' + name)

    	await this.do ('CREATE TEMP TABLE ' + name + ' ON COMMIT DROP AS SELECT ' + cols + ' FROM ' + src + ' WHERE 0=1')

    	return name

    }
    
    async upsert (table, data, key) {

        if (Array.isArray (data)) return Promise.all (data.map (d => this.upsert (table, d, key)))

        if (typeof data !== 'object') throw 'upsert called with wrong argument: ' + JSON.stringify ([table, data])
        if (data === null) throw 'upsert called with null argument: ' + JSON.stringify ([table, data])

        let def = this.model.tables [table]
        if (!def) throw 'Table not found: ' + table

        if (!key) key = def.p_k
        if (!Array.isArray (key)) key = [key]
        
        let where = ''
        
        let inv = k => ('' + k).split (',').map (s => s.trim ()).sort ().join (',')
        
        if (inv (key) != inv (def.p_k)) {
        
        	darn (inv (key) + '!=' + inv (def.p_k))
        
            let keys = def.keys
            if (!keys) throw 'Keys are not defined for ' + table
            
            let the_index
            
            outer: for (let ix of Object.values (keys)) {

                if (!ix.match (/^\s*CREATE\s*UNIQUE/i)) continue
                
                let cols = ix.slice (1 + ix.indexOf ('('), ix.lastIndexOf (')'))

                let parts = cols.split (/\s*,\s*/)
                
                if (parts.length != key.length) continue
                
                for (let i = 0; i < parts.length; i ++) if (parts [i] != key [i]) continue outer
                
                the_index = ix
                
                break
            
            }
        
            if (!the_index) throw 'No unique key found for ' + table + ' on ' + key
                        
            where = the_index.match (/ WHERE .*$/)
            
        }
        
        let [fields, args, set, params] = [[], [], [], []]
        
        for (let k in data) {
            let v = data [k]
            if (typeof v === 'undefined') continue            
            fields.push (k)
            args.push ('?')
            params.push (v)
            if (key.indexOf (k) < 0) set.push (`${k}=EXCLUDED.${k}`)
        }

        let sql = `INSERT INTO ${table} (${fields}) VALUES (${args}) ON CONFLICT (${key}) ${where || ''} DO`

        sql += set.length ? ` UPDATE SET ${set}` : ' NOTHING'

        if (def.p_k.length == 1) sql += ` RETURNING ${def.pk}`

        return this.select_scalar (sql, params)
        
    }
    
    async insert (table, data) {
    
        let def = this.model.tables [table]
        if (!def) throw 'Table not found: ' + table

        if (Array.isArray (data)) {
        	if (!data.length) return
			return this.load (Readable.from (data), table, Object.keys (data [0]))
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
        if (def.p_k.length == 1 && !data [pk]) sql += ` RETURNING ${pk}`

        return this.select_scalar (sql, params)

    }
    
    async insert_if_absent (table, data) {
    
        let def = this.model.tables [table]
        if (!def) throw 'Table not found: ' + table
        if (def.p_k.length > 1) throw 'Composite PK not supported'

        if (Array.isArray (data)) {
            for (let d of data) await this.insert_if_absent (table, d)
            return
        }
        
        let pk = def.pk
        if (!data [pk]) throw 'PK not set for ' + table + ': ' + JSON.stringify (data)
        
        let [fields, args, params] = [[], [], []]
        
        for (let k in data) {
            if (!def.columns [k]) continue
            let v = data [k]
            if (typeof v === 'undefined') continue            
            fields.push (k)
            args.push ('?')
            params.push (v)
        }
        
        let sql = `INSERT INTO ${table} (${fields}) VALUES (${args}) ON CONFLICT (${pk}) DO NOTHING`
        
        await this.do (sql, params)

    }

    async do (sql, params = []) {

    	if (params.length > 0) {

    		sql = this.fix_sql (sql)

    		params = params.map (v => typeof v == 'object' && v != null ? JSON.stringify (v) : v)

    	}

        let label = (this.log_prefix || '') + sql.replace (/\s+/g, ' ') + ' ' + JSON.stringify (params)

        console.time (label)

        try {
            return await this.backend.query (sql, params)
        }
        finally {
            console.timeEnd (label)
        }

    }

    async load (is, table, cols, o = {NULL: ''}) {

    	if (is._readableState.objectMode) is = is.pipe (new Transform ({
			
			readableObjectMode: false,
			
			writableObjectMode: true, 		
			
			transform (r, encoding, callback) {

				function safe (v) {

					const esc = {
						'\\': '\\\\',
						'\r': '\\r',
						'\n': '\\n',
						'\t': '\\t',
					}

					if (v == null || v === '') return ''

					if (v instanceof Buffer) return '\\\\x' + v.toString ('hex')

					if (v instanceof Date) return v.toJSON ().slice (0, 19)

					switch (typeof v) {
						case 'boolean': 
							return v ? '1' : '0'
						case 'number': 
						case 'bigint': 
							return '' + v
						case 'object': 
							v = JSON.stringify (v)
					}

					return v.replace (/[\\\n\r\t]/g, m => esc [m])

				}
				
				const lenm1 = cols.length - 1

				for (let i = 0; i <= lenm1; i ++) {
					this.push (safe (r [cols [i]]))
					this.push (i < lenm1 ? '\t' : '\n')
				}

				callback ()
			
			}
			
    	}))

		return new Promise ((ok, fail) => {

			let sql = ''; for (let k in o) {

				let v = o [k]

				if (v == null) continue
				
				if (!sql) sql = 'WITH'

				if (typeof v !== "boolean") v = "'" + v.replace (/\'/g, "''") + "'" //'
				
				sql += ' ' + k + ' ' + v

			}

			sql = `COPY ${table} (${cols}) FROM STDIN ${sql}`

	        let label = (this.log_prefix || '') + sql; console.time (label)

			let os = this.backend.query (require ('pg-copy-streams').from (sql))

			is.on ('end', () => ok (console.timeEnd (label)))

			os.on ('error', fail)
			is.on ('error', fail)

			is.pipe (os)

		})    

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
                , pg_views.definition AS sql
            FROM 
                pg_namespace
                LEFT JOIN pg_class ON (
                    pg_class.relnamespace = pg_namespace.oid
                    AND pg_class.relkind IN ('r', 'v')
                )
                LEFT JOIN pg_description ON (
                    pg_description.objoid = pg_class.oid
                    AND pg_description.objsubid = 0
                )
                LEFT JOIN pg_views ON (
                	pg_views.viewname = pg_class.relname
                	AND pg_views.viewowner = current_user
                )
                
            WHERE
                pg_namespace.nspname = current_schema()

        `, [])
        
        let {tables, views} = this.model
        
        for (let r of rs) {
        
			let t = (r.sql ? views : tables) [r.name]; if (!t) continue
        
        	for (let k of ['columns', 'keys', 'triggers']) r [k] = {}
            
            t.existing = r

        }
        
        for (let view of Object.values (views)) {
        
			let {existing} = view; if (!existing) continue
			
			let name = '_tmp_' + ('' + Math.random ()).replace (/\D/g, '')
			
			try {

				await this.do (`CREATE VIEW ${name} AS ${view.sql}`)

				let sql = await this.select_scalar ('SELECT definition FROM pg_views WHERE viewowner = current_user AND viewname = ?', [name])

				await this.do (`DROP VIEW ${name}`)
				
				if (sql == existing.sql) view._no_recreate = 1

			}
			catch (x) {

				darn (x)

			}

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
                , pg_class.relkind
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
                    AND pg_class.relkind IN ('r', 'v')
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

        let {tables, views} = this.model
        for (let r of rs) {        

            let t = (r.relkind == 'v' ? views : tables) [r.relname]
            if (!t) continue
            
            let name = r.attname
            
            let col = {
                name,
                TYPE_NAME : r.typname.toUpperCase (),
                REMARK    : r.description,
                NULLABLE  : !r.attnotnull,
                COLUMN_DEF: undefined,
            }                        

            if (r.adsrc != null) {
            	let d = '' + r.adsrc
            	if (/::"bit"$/.test (d)) [, d] = d.split ("'")
            	col.COLUMN_DEF = d            	
            }

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
                tablename, 
                indexname, 
                REPLACE (indexdef, schemaname || '.', '') AS indexdef
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
            
            if (re_pk.test (k)) {
                let p_k = /\((.*)\)/.exec (v) [1].trim ().replace (/\s/g, '').split (',')
                t.existing.p_k = p_k
                t.existing.pk = p_k.length == 1 ? p_k [0] : p_k
            } 
            else {
                t.existing.keys [k] = v
            }

        }
        
    }
    
    async load_schema_foreign_keys () {

        let rs = await this.select_all (`

			SELECT
			    tc.constraint_name AS ref_name, 
				tc.table_name, 
				kcu.column_name, 
				ccu.table_name AS ref
			FROM 
				information_schema.table_constraints AS tc 
				JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
				JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
			WHERE 
				tc.constraint_type = 'FOREIGN KEY' 
				AND tc.table_schema = current_schema()
	
        `, [])          
        
        let tables = this.model.tables

        for (let r of rs) {

			let {existing} = tables [r.table_name] || {}; if (!existing) continue

			let xc = existing.columns [r.column_name]; if (!xc) continue

			for (let k of ['ref', 'ref_name']) xc [k] = r [k]

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
				AND pg_trigger.tgname LIKE 'on%'

        `, [])          
        
        let tables = this.model.tables

        for (let r of rs) {
        
            let t = tables [r.tablename]
            if (!t) continue
            
            t.existing.triggers [r.k] = r.v.trim ()
        
        }
    
    }

    async load_schema_proc () {
    
        let rs = await this.select_all (`

            SELECT 
                pg_proc.proname AS name
                , pg_proc.prosrc AS src
            FROM
				pg_namespace
                INNER JOIN pg_proc ON pg_proc.pronamespace = pg_namespace.oid
            WHERE
                pg_namespace.nspname = current_schema()
				AND pg_proc.oid NOT IN (SELECT tgfoid FROM pg_trigger)
        `, [])          
        
        let {procedures, functions} = this.model

        for (let {name, src} of rs) {
        
			let proc = procedures [name] || functions [name]
			
			if (proc) proc.existing = {src}
        
        }
    
    }

}