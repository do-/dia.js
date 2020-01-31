const  Dia          = require ('../../Dia.js')
const  readline     = require ('readline')
const {
	Transform,
	PassThrough,
	Readable,
}   				= require ('stream')

module.exports = class extends Dia.DB.Client {
    
    async release (success) {   
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
    
    async select_loop (sql, params, callback, data) {
    	
    	sql = this.bind (sql, params)
    	
    	let label = this.log_label (sql)
        
        try {
        
        	console.time (label)        

        	let input = await this.backend.responseStream ({}, sql + ' FORMAT JSONEachRow')
  
  			let is_ok = input.statusCode == 200; if (!is_ok) data = 'Clickhouse server returned ' + input.statusCode + ' '
  
        	return new Promise ((ok, fail) => {

				readline.createInterface ({input})
				
				.on ('close', () => is_ok ? ok (data) : fail (data))

				.on ('line', s => {
				
					if (!is_ok) return data += s

					try {
						callback (JSON.parse (s), data)
					}
					catch (e) {						
						darn (e)							
					}

				})

        	})

        }
        finally {        
        
        	console.timeEnd (label)        
        	
        }

    }

    async get (def) {
        let q =  this.query (def)
        let [limited_sql, limited_params] = this.to_limited_sql_params (q.sql, q.params, 1)
        let getter = q.parts [0].cols.length == 1 ? this.select_scalar : this.select_hash
        return getter.call (this, q.sql, q.params)
    }

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
    
    async load (is, table, fields) {
    
    	let sql = `INSERT INTO ${table} (${fields})`

    	let label = this.log_label (sql)
    	
        try {        
        
        	console.time (label)        
        	
        	let body = new Transform ({transform (chunk, encoding, callback) {
				
				if (sql) {this.push (sql + ' FORMAT TSV\n'); sql = null}
									
				callback (null, chunk)			
					
			}})        	
			
			let res_promise = this.backend.response ({}, body)
			
			is.pipe (body)
			
			await res_promise
    	
        }
        finally {
        
        	console.timeEnd (label)
        
        }
    
    }    

    async insert (table, data) {
    
        let def = this.model.tables [table]; if (!def) throw 'Table not found: ' + table

		if (!(data instanceof Readable)) {
		
	        if (!Array.isArray (data)) data = [data]; if (data.length == 0) return
	        
	        let _data = clone (data); data = new Readable ({
	        
	        	objectMode: true,
	        	
				read () {this.push (_data.shift () || null)}
				
			})

		}

        const esc = {
			'\\': '\\\\',
			'\n': '\\n',
			'\t': '\\t',
        }
        
        function safe (v) {
        
			if (v == null || v === '') return '\\N'
			
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

			return v.replace (/[\\\n\t]/g, (m, p1) => esc [p1])
			
        }
        
		let first = data.read (1)
		
		let {columns} = def

		let fields = Object.keys (first).filter (k => columns [k])

        let body = new PassThrough (), res_promise = this.load (body, table, fields)

        function line (r) {

        	let l = ''; 
        	
        	for (let k of fields) {
			
				if (l) l += '\t'
				
				let s = safe (r [k])
				
				if (columns [k].TYPE_NAME == 'DateTime' && s.length > 19) s = s.slice (0, 19)

				l += s
				
			}
		
			return l += '\n'

		}
		
		body.write (line (first))
		
		data.on ('end',  () => body.end ())
		data.on ('data',  r => body.write (line (r)))

		return res_promise

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
		
		let esc = v => {

			if (v == null) return 'NULL'
		
			switch (typeof v) {
				case 'boolean': 
					return v ? '1' : '0'
				case 'number': 
				case 'bigint': 
					return v
				default: 
					return "'" + ('' + v).replace (/[\\']/g, s => "\\" + s) + "'"
			}
		
		}

        for (let part of parts) sql += `${esc (params.shift ())}${part}`        
        
        return sql    

    }
    
    async do (sql, params = []) {
    
    	sql = this.bind (sql, params)
    	
    	let label = this.log_label (sql)
        
        try {        
        	console.time (label)        
			await this.backend.response ({}, sql)			
        }
        finally {
        
        	console.timeEnd (label)
        
        }
    
    }        

    async select_all (sql, params = []) {
    
    	return this.select_loop (sql, params, (d, a) => a.push (d), [])

    }
    
    async select_hash (sql, params = []) {

		let [h] = await this.select_all (sql, params)
		
		return h || {}

    }
    
    async load_schema_tables () {
    
        let tables = this.model.tables

		let rs = await this.select_all ("SELECT * FROM system.tables WHERE database=?", [this.database])

        for (let r of rs) {
            let t = tables [r.name]
            if (!t) continue
            r.columns = {}
            r.keys = {}
            t.existing = r
        }

    }
    
    async load_schema_table_columns () {
    
		let rs = await this.select_all ("SELECT * FROM system.columns WHERE database=?", [this.database])

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