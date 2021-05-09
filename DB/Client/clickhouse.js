// Borrowed from https://github.com/sindresorhus/is-stream

const isStream = stream =>
	stream !== null &&
	typeof stream === 'object' &&
	typeof stream.pipe === 'function';

isStream.readable = stream =>
	isStream(stream) &&
	stream.readable !== false &&
	typeof stream._read === 'function' &&
	typeof stream._readableState === 'object';    

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
        
    async select_stream (sql, params, o = {}) {

        let log_event = this.log_start (sql, params)

    	sql = this.bind (sql, params)
       	       	
       	let input = await this.backend.responseStream ({}, sql + ' FORMAT JSONEachRow')

		input.on ('end', () => this.log_finish (log_event))

		let reader = readline.createInterface ({input})

		if (input.statusCode != 200) return new Promise ((ok, fail) => {

			input.on ('error', fail)
			
			let x = 'Clickhouse server returned ' + input.statusCode
				
			reader.on ('close', () => fail (new Error (x))).on ('line', s => x += ' ' + s)
			
		})
		
		o.objectMode = true

		let result = new PassThrough (o)

		input.on ('error', x => result.destroy (x))

		reader.on ('close', () => result.end ()).on ('line', s => {

			try {
				result.write (JSON.parse (s))
			}
			catch (x) {
				darn (x)
			}

		})
			
		return result

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
   
        try {        
        
	        let log_event = this.log_start (sql)
        	
        	let body = new Transform ({transform (chunk, encoding, callback) {
				
				if (sql) {this.push (sql + ' FORMAT TSV\n'); sql = null}
									
				callback (null, chunk)			
					
			}})        	
				        
			let res_promise = this.backend.response ({}, body)
			
			is.pipe (body)
			
			await res_promise
    	
        }
        finally {
        
        	this.log_finish (log_event)
        
        }
    
    }    
    
    async insert (table, data) {
    
        let def = this.model.relations [table]; if (!def) throw 'Table not found: ' + table

		if (!isStream.readable (data)) {
		
	        if (!Array.isArray (data)) data = [data]; if (data.length == 0) return
	        
	        let _data = data; i = 0; data = new Readable ({objectMode: true, read () {this.push (_data [i ++] || null)}})

		}

        const esc = {
			'\\': '\\\\',
			'\n': '\\n',
			'\t': '\\t',
        }
        
        function safe (v) {
        
			if (v == null || v === '') return '\\N'

			if ([Infinity, -Infinity].includes (v)) return '\\N'

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
        
		const lens = {					
			"DATE":      10,
			"DATETIME":  19,
			"Date":      10,
			"DateTime":  19,
		}        
		
		let body = new PassThrough ()
				
		data.on ('end', () => body.end ())
		
		return await new Promise ((ok, fail) => {

			let fields = null, {columns} = def

			data.on ('close', () => {if (!fields) ok ()})

			function line (r) {

				let l = ''

				for (let k of fields) {

					if (l) l += '\t'

					let s = safe (r [k])

					let len = lens [columns [k].TYPE_NAME]; if (len && s.length > len) s = s.slice (0, len)

					l += s

				}

				return l += '\n'

			}

			data.on ('data', r => {

				if (!fields) {
									
					try {
					
						fields = Object.keys (r).filter (k => columns [k])
						
						if (!fields.length) fail (new Error (`No known fields (${Object.keys (columns)}) found in 1st record: ` + JSON.stringify (r)))
					
						ok (this.load (body, table, fields))
					
					}
					catch (x) {
					
						fail (x)
					
					}

				}

				body.write (line (r))

			})

		})

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
    
    	if (!params || !params.length) return original_sql
    	
		let [sql, ...parts] = original_sql.split ('?')
		
		let esc = v => {

			if (v == null) return 'NULL'

			if ([Infinity, -Infinity].includes (v)) return 'NULL'
		
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

		for (let i = 0; i < parts.length; i ++) sql += `${esc (params [i])}${parts[i]}`
        
        return sql    

    }
    
    async do (sql, params = []) {
    
        let log_event = this.log_start (sql, params)

    	sql = this.bind (sql, params)
    	        
        try {        
			await this.backend.response ({}, sql)			
        }
        finally {        
            this.log_finish (log_event)        
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

        let {tables, partitioned_tables} = this.model

		let rs = await this.select_all ("SELECT * FROM system.tables WHERE database=?", [this.pool.database])

        for (let r of rs) {
            let t = tables [r.name] || partitioned_tables [r.name]
            if (!t) continue
            r.columns = {}
            r.keys = {}
            t.existing = r
        }

    }
    
    async load_schema_table_columns () {
    
		let rs = await this.select_all ("SELECT * FROM system.columns WHERE database=?", [this.pool.database])

        let {tables, partitioned_tables} = this.model
        
        for (let r of rs) {

            let t = tables [r.table] || partitioned_tables [r.table]
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