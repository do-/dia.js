const Dia = require ('../../Dia.js')

module.exports = class extends Dia.DB.Client {

    is_pk_violation (e) {
    	
    	if (e.code != 'SQLITE_CONSTRAINT') return false

    	let [table, column] = e.message.split (/:\s*/).pop ().split ('.')
    	
    	let def = this.model.tables [table]; if (!def) return false
    
        return column == def.pk

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

        return this.pool.release (this)
    
    }
    
    to_limited_sql_params (original_sql, original_params, limit, offset) {
        let params = original_params.slice ()
        params.push (limit)
        params.push (offset)
        return [original_sql + ' LIMIT ? OFFSET ?', params]
    }
    
    log_label (sql, params) {
    
    	return (this.log_prefix || '') + sql.replace (/^\s+/g, '').replace (/\s+/g, ' ') + ' ' + JSON.stringify (params)
    
    }
    
    async do (sql, params = []) {
            
        let label = this.log_label (sql, params)
        
        console.time (label)

        return new Promise ((ok, fail) => {
        
        	this.backend.run (sql, params, 
        	
        		function (x) { 
        		
        			if (x) fail (x) 
        			
        			ok (this)
        			
        		}
        	
        	)
        
        }).finally (() => console.timeEnd (label))

    }    

    async select_all (sql, params = []) {
            
        let label = this.log_label (sql, params)
        
        console.time (label)
        
        return new Promise ((ok, fail) => {
        
        	this.backend.all (sql, params, (x, d) => x ? fail (x) : ok (d))
        
        }).finally (() => console.timeEnd (label))

    }
    
    async select_loop (sql, params, callback, data) {
    
        let label = this.log_label (sql, params)
        
        console.time (label)
        
        return new Promise ((ok, fail) => {
        
        	this.backend.each (sql, params, 
        		(x, one) => callback (one, data), 
        		(x, cnt) => x ? fail (x) : ok (data)
        	)
        
        }).finally (() => console.timeEnd (label))
    
    }

    async select_hash (sql, params) {
    
        let label = this.log_label (sql, params)
        
        console.time (label)
        
        return new Promise ((ok, fail) => {
        
        	this.backend.get (sql, params, (x, d) => x ? fail (x) : ok (d || {}))
        
        }).finally (() => console.timeEnd (label))

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
        
        let where = ''
        
        if (key [0] != def.pk) {
        
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
            fields.push (k)
            args.push ('?')
            params.push (data [k])
            if (key.indexOf (k) < 0) set.push (`${k}=COALESCE(EXCLUDED.${k},${table}.${k})`)
        }

        let sql = `INSERT INTO ${table} (${fields}) VALUES (${args}) ON CONFLICT (${key}) ${where || ''} DO UPDATE SET ${set}`

        return this.do (sql, params)
        
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
        
        let that = await this.do (sql, params)

        return data [def.pk] || that.lastID

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
    
    async list_objects_of_type (type) {
    	return this.select_all ('SELECT * FROM sqlite_master WHERE type=?', [type])
    }
    
    async load_schema_tables () {
    
        let tables = this.model.tables
        
		let rs = await this.list_objects_of_type ('table')

        for (let r of rs) {
            let t = tables [r.name]
            if (!t) continue
            r.columns = {}
            r.keys = {}
            t.existing = r
        }

    }
    
    async load_schema_table_columns () {
    
		let rs = await this.list_objects_of_type ('table')
    
        let tables = this.model.tables
        for (let r of rs) {        
        
            let t = tables [r.tbl_name]            
            if (!t) continue

        	let sql = r.sql
        	sql = sql.substr (1 + sql.indexOf ('('))
        	sql = sql.substr (0, sql.length - 1)
        	
        	for (let f of sql.split (', "')) {

				let [_, name, type, dim, def, is_pk, is_nn] = /^(\w+)"? ([A-Z]+)([\(\d\,\)]*)(?: DEFAULT '(.*)')?( PRIMARY KEY)?( NOT NULL)?/.exec (f)
				
				if (is_pk) t.pk = name

				let col = {
					name,
					TYPE_NAME : type,
					NULLABLE  : !(is_nn || is_pk),
					COLUMN_DEF: def,
				}
				
				if (dim) {				
					let [len, dd] = dim.split (/\D/).filter (_ => _)					
					col.COLUMN_SIZE = len					
					if (dd) col.DECIMAL_DIGITS = dd				
				}
				
	            t.existing.columns [name] = col
				
        	}
            
        }    
        
    }
    
    async load_schema_table_keys () {
    
		let rs = await this.list_objects_of_type ('index')

        let tables = this.model.tables

        for (let r of rs) {        
        
        	let sql = r.sql; if (!sql) continue
        	
            let t = tables [r.tbl_name]            
            if (!t) continue

			t.existing.keys [r.name] = sql
			
		}
            
    }
    
    async load_schema_table_triggers () {    
    
    }

}