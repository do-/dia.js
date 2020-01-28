const Dia = require ('../../Dia.js')

module.exports = class extends Dia.DB.Client {
    
    async release (success) {   
        return this.pool.release (this)
    }
    
    to_limited_sql_params (original_sql, original_params, limit, offset) {
        let params = original_params.slice ()
        params.push (limit)
        params.push (offset)
        return [original_sql + ' LIMIT ? OFFSET ?', params]
    }
    
    log_label (sql, params) {
    
    	return (this.log_prefix || '') + sql
    
    }
    
/*    

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
*/    

    carp_write_only () {
    	throw new Error ('Data modification not supported')
    }
    
    async upsert () {
    	this.carp_write_only ()
    }
    
    async update () {
    	this.carp_write_only ()
    }
    
    async delete () {
    	this.carp_write_only ()
    }

    async insert (table, data) {
    
        let def = this.model.tables [table]; if (!def) throw 'Table not found: ' + table

        if (!Array.isArray (data)) data = [data]; if (data.length == 0) return

        let fields = Object.keys (data [0]).filter (k => def.columns [k]); if (!fields.length) throw 'No known values provided to insert in ' + table + ': ' + JSON.stringify (data)
        
        let ws = this.backend.insert (`INSERT INTO ${table} (${fields})`).stream ()
      
		for (let r of data) await ws.writeRow (JSON.stringify (fields.map (k => k [k])))
		
		return ws.exec ()

    }

    is_auto_commit () {
    	return true
    }
    
    async begin () {
    }
    
    async commit () {
    }
    
    async rollback () {
    }

    bind (original_sql, params) {
    	if (!params.length) return original_sql
		let [sql, ...parts] = original_sql.split ('?')
        let esc = s => "'" + s.replace (/[\\']/g, s => "\\" + s) + "'"
        for (let part of parts) sql += `${esc (params.shift ())}${part}`        
        return sql    
    }
    
    async do (sql, params = []) {
    
    	sql = this.bind (sql, params)
    	
    	let label = this.log_label (sql)
        
        try {
        
        	console.time (label)
        
			await this.backend.query (sql).toPromise ()
			
        }
        finally {
        
        	console.timeEnd (label)
        
        }
    
    }        

    async select_all (sql, params = []) {
    
    	sql = this.bind (sql, params)
            
        let label = this.log_label (sql)
        
        console.time (label)
                
        return new Promise ((ok, fail) => {

        	this.backend.query (sql).exec ((x, d) => x ? fail (x) : ok (d))

        }).finally (() => console.timeEnd (label))

    }

    async load_schema_tables () {
    
        let tables = this.model.tables

		let rs = await this.select_all ("SELECT * FROM system.tables WHERE database=?", [this.backend.opts.database])

        for (let r of rs) {
            let t = tables [r.name]
            if (!t) continue
            r.columns = {}
            r.keys = {}
            t.existing = r
        }

    }
    
    async load_schema_table_columns () {
    
		let rs = await this.select_all ("SELECT * FROM system.columns WHERE database=?", [this.backend.opts.database])

        let tables = this.model.tables
        
        for (let r of rs) {

            let t = tables [r.table]            
            if (!t) continue
            
            let {name} = r
            
			let col = {
				name,
				TYPE_NAME: r.type,
				REMARK: r.comment,
			}
			
			if (r.default_kind == 'DEFAULT') col.COLUMN_DEF = r.default_expression

			t.existing.columns [name] = col
            
        }    
        
    }
    
    async load_schema_table_keys () { }

    async load_schema_table_triggers () { }

}