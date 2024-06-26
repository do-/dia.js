const zlib       = require ('zlib')

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
const  LineWriter   = require ('./clickhouse/LineWriter.js')
const  SqlPrepender = require ('./clickhouse/SqlPrepender.js')
const  readline     = require ('readline')
const {
	Transform,
	PassThrough,
	Readable,
}   				= require ('stream')

const RE_NULLABLE = /^Nullable\((.*?)\)$/
// eslint-disable-next-line redos/no-vulnerable
const RE_CAST     = /^CAST\('?(.*?)'?,.*\)$/i
// eslint-disable-next-line redos/no-vulnerable
const RE_DIM      = /^(.*?)\((.+)\)$/

class ChClient extends Dia.DB.Client {
    
    async release (success) {   
    }

    async break () {

    	try {
	        await this.backend.break ()
    	}
    	catch (x) {
    		this.warn ('' + x)
    	}

    }

	set_session (id, timeout) {
	
		let {o} = this.backend
		
		o.path = o.path
			.replace (/&session_id=[^&]*/, '')
			.replace (/&session_timeout=[^&]*/, '')

		if (id) o.path += '&session_id=' + id

		if (timeout) o.path += '&session_timeout=' + timeout
	
	}
    
    to_limited_sql_params (original_sql, original_params, limit, offset) {
        let params = original_params.slice ()
        params.push (limit)
        params.push (offset)
        return [original_sql + ' LIMIT ? OFFSET ?', params]
    }
        
    async select_stream (sql, params, o = {}) {

        sql = sql.replace (/\blower\b\s*\(/gsmi, 'lowerUTF8(')

        let log_event = this.backend.set_parent_log_event (this.log_start (sql, params))        

    	sql = this.bind (sql, params)
       	       	
       	let input = await this.backend.responseStream ({
       		path: this.backend.o.path + '&enable_http_compression=1',
			headers: {
				"Content-Type": "text/plain",
				"Accept-Encoding": "gzip",
			}				       	
       	}, sql + ' FORMAT JSONEachRow')

		input.on ('close', () => this.log_finish (log_event))

		let reader = readline.createInterface ({input})

		if (input.statusCode != 200) return new Promise ((ok, fail) => {

			input.on ('error', fail)
			
			log_event.level = 'error'
			log_event.phase = 'error'
			log_event.message = ''

			reader
				.on ('close', () => {
					this.log_write (log_event)
					fail (new Error ('ClickHouse server error'))
				})
				.on ('line', s => log_event.message += s)

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
    

    async delete (table, data) {
    
		let {sql, params} = this.query ({[table]: data})
		
		if (params.length == 0) throw 'DELETE without a filter? If sure, use this.db.do directly.'
		
		sql = 'ALTER TABLE ' + table + ' DELETE ' + sql
			.slice (sql.indexOf ('WHERE'))
			.split (table + '.').join ('')
		
		return this.do (sql, params)
		
    }    

    async load (is, table_name, fields) {

    	const {backend} = this, headers = {"Content-Type": "text/plain"}, plug = xform => {

        	is.on ('error', x => {x._is_from_input_stream = true; xform.destroy (x)})

	        is = is.pipe (xform)

    	}

		let columns; if (Array.isArray (fields)) {

			columns = {}; for (const name of fields) columns [name] = {name, TYPE_NAME: 'String', NULLABLE: true}

		} 
		else {
			
			columns = fields

		}

		if (is._readableState.objectMode) plug (new LineWriter ({table: {name: '(GENERATED)', columns}}))

        {

        	const sql = `INSERT INTO ${table_name} (${Object.keys(columns)})`;

        	var log_event = backend.set_parent_log_event (this.log_start (sql))
        
	        plug (new SqlPrepender (sql))

        }

        {

			headers ['Content-Encoding'] = 'gzip'

	        plug (zlib.createGzip ({level: 9}))

        }

		try {
 
			await backend.response ({headers}, is)

		}
		catch (error) {
			
		    this.log_error (log_event, error)
		
		}
		finally {
		
			this.log_finish (log_event)

		}

    }
    
    log_error (log_event, cause) {
    
		log_event.level = 'error'
		log_event.phase = 'error'
		log_event.message = cause.message

		this.log_write (log_event)

		throw cause._is_from_input_stream ? cause : Error ('ClickHouse server error: ' + cause.message, {cause})

    }

	async insert (table_name, data) {
    
		let table = this.model.get_relation (table_name); if (!table) throw 'Table not found: ' + table_name

		if (!isStream.readable (data)) {

			if (!Array.isArray (data)) data = [data]
			
			if (data.length == 0) return

			data = Readable.from (data)

		}
		
		const writer = new LineWriter ({table})
		
		await new Promise ((ok, fail) => {

			data.once   ('error',  fail)
			writer.once ('error',  fail)
			
			data.on ('end', ok)
			
			writer.on ('fields', fields => {

				data.off ('end', ok)

				this.load (writer, table_name, fields)
					.then (ok)
					.catch (fail)

			})
			
			data.pipe (writer)

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
    
        let log_event = this.backend.set_parent_log_event (this.log_start (sql, params))        

    	sql = this.bind (sql, params)
    	        
        try {        
			await this.backend.response ({}, sql)			
        }
		catch (error) {			
		    this.log_error (log_event, error)		
		}
        finally {        
            this.log_finish (log_event)        
        }
    
    }        

    async select_all (sql, params = [], options = {}) {

    	if (!options.maxRows) options.maxRows = ChClient.MAX_SELECT_ALL

   		const all = [], rs = await this.select_stream (sql, params)

   		for await (const r of rs) {
   		
   			if (all.length >= options.maxRows) {
   			
   				rs.destroy ()
   			
   				break
   				
   			}

   			all.push (r)

   		}

		return all

    }

    async select_hash (sql, params = []) {

		let [h] = await this.select_all (sql, params, {maxRows: 1})

		return h || {}

    }
    
    async load_schema_tables () {

        const {model} = this, {tables, partitioned_tables} = model

		let rs = await this.select_all ("SELECT * FROM system.tables WHERE database=?", [this.pool.database])

        for (let r of rs) {
        	const {name} = r
            let t = tables [name] || partitioned_tables [name]
            if (!t) {
				model.odd ({type: 'unknown_table', id: name})
           		continue
            }
            {
            	const {sorting_key} = r; if (sorting_key) r.p_k = sorting_key.split (',').map (s => s.trim ())
            }
            r.columns = {}
            r.keys = {}
            t.existing = r
        }

    }
    
    async load_schema_table_columns () {
    
		let rs = await this.select_all ("SELECT * FROM system.columns WHERE database=?", [this.pool.database])

        let {tables, partitioned_tables} = this.model
        
        for (const {table, name, type, comment, default_kind, default_expression} of rs) {

            const t = tables [table] || partitioned_tables [table]; if (!t) continue
            
			let col = {name, REMARK: comment}
			
			{
			
				const m = RE_NULLABLE.exec (type)

				col.NULLABLE = !!m

				col.TYPE_NAME = col.NULLABLE ? m [1] : type
			
			}

			{
			
				const m = RE_DIM.exec (col.TYPE_NAME)
				
				if (m) {

					col.TYPE_NAME = m [1]
					
					const p = m [2].indexOf (','); if (p < 0) {

						col.COLUMN_SIZE = m [2]

					}
					else {

						col.COLUMN_SIZE    = m [2].slice (0, p)
						col.DECIMAL_DIGITS = m [2].slice (p + 1).trim ()

					}

				}
			
			}

			if (default_kind === 'DEFAULT') {

				const m = RE_CAST.exec (default_expression)

				col.COLUMN_DEF = m ? m [1] : default_expression

			}

			t.existing.columns [name] = col
            
        }    
        
    }
    
    async load_schema_table_keys () { }

    async load_schema_table_triggers () { }

}

ChClient.MAX_SELECT_ALL = 4294967294

module.exports = ChClient