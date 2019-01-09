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
            
}