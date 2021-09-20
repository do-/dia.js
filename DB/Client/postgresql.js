const Dia = require ('../../Dia.js')
const {Readable, Transform, PassThrough} = require ('stream')
const WrappedError = require ('../../Log/WrappedError.js')

let pg_query_stream; try {pg_query_stream = require ('pg-query-stream')} catch (x) {}

module.exports = class extends Dia.DB.Client {

    is_pk_violation (e) {
        return e.code == '23505' && /_pkey$/.test (e.constraint)
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
    
    wrap_error (e, log_event) {
    	for (let k of ['file', 'line', 'position']) delete e [k]
		return new WrappedError (e, {log_meta: {...this.log_meta, parent: log_event}})
    }

    async select_all (original_sql, params = []) {
    
        let sql = this.fix_sql (original_sql)
                
        let log_event = this.log_start (sql, params)
        
        try {
            let result = await this.backend.query (sql, params)
            return result.rows
        }
        catch (e) {

            if (e.code == 23505) {

                let {model} = this; if (model) {

                    let {constraint_error_messages} = model.tables [e.table]; if (constraint_error_messages) {

                        let message = constraint_error_messages [e.constraint];

                        if (message) throw this.wrap_error ({message}, log_event)

                    }

                }

            }

            throw this.wrap_error (e, log_event)
        }
        finally {
            this.log_finish (log_event)
        }
        
    }
    
    async select_stream (original_sql, params, o) {
    	
        let sql = this.fix_sql (original_sql)
        
        let log_event = this.log_start (sql, params)
        
        let qs = require ('pg-query-stream')

    	let stream = this.backend.query (new qs (sql, params, o))
    	
    	stream.on ('end', () => this.log_finish (log_event))
    	
    	return stream

    }
    
    async select_loop (sql, params, callback, data) {
    	if (pg_query_stream) return super.select_loop (sql, params, callback, data)
        let all = await this.select_all (sql, params)
        for (let one of all) callback (one, data)
        return data
    }

    async select_hash (sql, params) {
		params = (params || []).map (v => typeof v == 'object' && v != null && !(v instanceof Uint8Array) ? JSON.stringify (v) : v)
        let all = await this.select_all (sql, params)
        return all.length ? all [0] : {}
    }
    
    async get (def) {
        let q =  this.query (def)
        let [limited_sql, limited_params] = this.to_limited_sql_params (q.sql, q.params, 1, 0)
        let getter = q.parts [0].cols.length == 1 ? this.select_scalar : this.select_hash
        return getter.call (this, limited_sql, limited_params)
    }
    
    async call (name, params = []) {
    	return this.select_scalar (`SELECT ${name}(${params.map (i => '?')})`, params)
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
                
                for (let i = 0; i < parts.length; i ++) if (!key.find (k => k == parts [i])) continue outer
                
                the_index = ix
                
                break
            
            }
        
            if (!the_index) throw 'No unique key found for ' + table + ' on ' + key
                        
            where = the_index.match (/ WHERE .*$/)
            
        }
        
        let [fields, args, set, params] = [[], [], [], []]
        
        let {columns} = def
        for (let k in data) {
        	if (!columns [k]) continue
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
    
        if (Array.isArray (data)) {
        	if (!data.length) return
			return this.load (Readable.from (data), table, Object.keys (data [0]))
        }

        let def = this.model.tables [table]; if (!def) throw 'Table not defined: ' + table

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
            if (v === null) {
				let {NULLABLE, COLUMN_DEF} = def.columns [k]
				if (!NULLABLE && COLUMN_DEF) v = COLUMN_DEF
            }                        
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

        let log_event = this.log_start (sql, params)

        try {
            return await this.backend.query (sql, params)
        }
        catch (e) {
        
        	if (e.code == 23505) {
        	
        		let {model} = this; if (model) {

	        		let {constraint_error_messages} = model.tables [e.table]; if (constraint_error_messages) {
	        		
	        			let message = constraint_error_messages [e.constraint]; 
	        			
	        			if (message) throw this.wrap_error ({message}, log_event)
	        		
	        		}

        		}
        		
        	}
        
        	throw this.wrap_error (e, log_event)

        }
        finally {
			this.log_finish (log_event)
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
				
				if (sql)
					sql += ', '
				else
					sql = 'WITH ('
					
				if (/^FORCE_/.test (k)) {
				
					if (Array.isArray (v)) v = '(' + v + ')'
				
				}
				else if (typeof v !== "boolean" && k != 'FORMAT') {
					
					v = "'" + v.replace (/\'/g, "''") + "'" //'
				
				}
				
				sql += ' ' + k + ' ' + v

			}

			if (sql) sql += ')'

			sql = `COPY ${table} (${cols}) FROM STDIN ${sql}`

	        let log_event = this.log_start (sql)

			let os = this.backend.query (require ('pg-copy-streams').from (sql))

			os.on ('finish', () => ok (this.log_finish (log_event)))
			
			let croak = e => fail (this.wrap_error (e, log_event))

			os.on ('error', croak)
			is.on ('error', croak)

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
				CONCAT_WS ('.',
					CASE WHEN pg_namespace.nspname = 'public' THEN NULL ELSE pg_namespace.nspname END,
					pg_class.relname
				) AS name
                , pg_description.description AS label
                , pg_class.relpersistence = 'u' AS unlogged
            FROM 
                pg_namespace
                LEFT JOIN pg_class ON (
                    pg_class.relnamespace = pg_namespace.oid
                    AND pg_class.relkind IN ('r', 'p')
                )
                LEFT JOIN pg_description ON (
                    pg_description.objoid = pg_class.oid
                    AND pg_description.objsubid = 0
                )
        `, [])
        
        let {tables, partitioned_tables} = this.model
        
        for (let r of rs) {
        
			let t = tables [r.name] || partitioned_tables [r.name]; if (!t) continue
			
			r.p_k = []
        
        	for (let k of ['columns', 'keys', 'triggers']) r [k] = {}
            
            t.existing = r

        }
        
        for (let partitioned_table of Object.values (partitioned_tables)) {
        
        	let {partition} = partitioned_table
        	
			partition.list = []
        
        }
        
        try {
        
			rs = await this.select_all (`

				SELECT
					CONCAT_WS ('.', 
					CASE WHEN ptn.nspname = 'public' THEN NULL ELSE ptn.nspname END,
					ptc.relname
				  ) table_name
					, CONCAT_WS ('.', 
					CASE WHEN pn.nspname = 'public' THEN NULL ELSE pn.nspname END,
					pc.relname
				  ) AS name
				  , pg_get_expr (pc.relpartbound, pc.oid, true) AS filter
				FROM 
				  pg_partitioned_table pt
				  join pg_class ptc on pt.partrelid = ptc.oid
				  join pg_namespace ptn on ptc.relnamespace = ptn.oid
				  join pg_inherits i ON i.inhparent = pt.partrelid
				  join pg_class pc on i.inhrelid = pc.oid
				  join pg_namespace pn on pc.relnamespace = pn.oid

			`, [])        

			for (let {table_name, name, filter} of rs) {

				let partitioned_table = partitioned_tables [table_name]; if (!partitioned_table) continue

				partitioned_table.partition.list.push ({name, filter})

			}
        
        }
        catch (x) {
        
        	if (x.code != '42P01') throw x // pg_partitioned_table didn't exist in pg < 10
        
        }
        
    }

    async load_schema_table_columns () {
   
        let {model} = this, {tables, partitioned_tables} = model, rs = await this.select_all (`
        	SELECT
			  CONCAT_WS ('.', 
				  CASE 
					WHEN c.table_schema = 'public' THEN NULL
					ELSE c.table_schema
				  END
				  , c.table_name
			  ) table_name
			  , c.column_name AS name
			  , UPPER (udt_name) "TYPE_NAME"
			  , CASE
			  	WHEN c.identity_generation IS NOT NULL THEN 'AUTO_INCREMENT'
			  	WHEN c.column_default ILIKE 'NEXTVAL%' THEN 'AUTO_INCREMENT'
				WHEN c.column_default LIKE '%::%' THEN SPLIT_PART (c.column_default, '''', 2)
				ELSE c.column_default 
			  END "COLUMN_DEF"
			  , c.is_nullable = 'YES' "NULLABLE"
			  , CASE
				WHEN c.character_maximum_length IS NOT NULL THEN c.character_maximum_length
				WHEN c.numeric_precision_radix = 10 THEN c.numeric_precision
				ELSE NULL
			  END "COLUMN_SIZE"
			  , CASE
				WHEN c.numeric_precision_radix = 10 THEN c.numeric_scale
				ELSE NULL
			  END "DECIMAL_DIGITS"
			FROM
			  information_schema.tables t
			  JOIN information_schema.columns c ON (t.table_schema = c.table_schema AND t.table_name = c.table_name)
			WHERE
			  t.table_type = 'BASE TABLE'
			  AND t.table_schema NOT IN ('pg_catalog', 'information_schema')

        `, [])

        for (let r of rs) {        

            let t = tables [r.table_name] || partitioned_tables [r.table_name]; if (!t) continue

            delete r.table_name; t.existing.columns [r.name] = r

        }

        rs = await this.select_all (`
            SELECT
                CONCAT_WS ('.', 
                	CASE 
                    	WHEN pg_namespace.nspname = 'public' THEN NULL
                        ELSE pg_namespace.nspname
                    END
                    , pg_class.relname
                ) table_name            	
                , pg_attribute.attname AS name
                , pg_description.description AS "REMARK"
            FROM 
                pg_namespace
                JOIN pg_class       ON (pg_class.relnamespace = pg_namespace.oid AND pg_class.relkind IN ('r'))
                JOIN pg_attribute   ON (pg_attribute.attrelid = pg_class.oid AND pg_attribute.attnum > 0 AND NOT pg_attribute.attisdropped)
                JOIN pg_description ON (pg_description.objoid = pg_attribute.attrelid AND pg_description.objsubid = pg_attribute.attnum)
        `, [])

        for (let r of rs) {        

            let t = tables [r.table_name] || partitioned_tables [r.table_name]; if (!t) continue

            let {columns} = t.existing, {name, REMARK} = r

            if (!columns [name]) columns [name] = {name}

            columns [name].REMARK = REMARK

        }

    }

    async load_schema_table_keys () {
    
        let rs = await this.select_all (`
            SELECT 
                CONCAT_WS ('.', 
                	CASE 
                    	WHEN schemaname = 'public' THEN NULL
                        ELSE schemaname
                    END
                    , tablename
                ) AS tablename,
                indexname, 
                REPLACE (indexdef, schemaname || '.', '') AS indexdef
            FROM
                pg_indexes
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
                CONCAT_WS ('.', 
                	CASE 
                    	WHEN tc.table_schema = 'public' THEN NULL
                        ELSE tc.table_schema
                    END
                    , tc.table_name
                ) AS table_name,
			    tc.constraint_name AS ref_name, 
				kcu.column_name, 
				ccu.table_name AS ref
			FROM 
				information_schema.table_constraints AS tc 
				JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
				JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
			WHERE 
				tc.constraint_type = 'FOREIGN KEY' 
        `, [])          

        let tables = this.model.tables

        for (let r of rs) {

			let {existing} = tables [r.table_name] || {}; 
			
			if (!existing) continue

			let xc = existing.columns [r.column_name]; if (!xc) continue
			
			if (!xc.ref_names) xc.ref_names = []
			
			xc.ref_names.push (r.ref_name)

        }

	}
	
    async load_schema_table_data () {
    
    	let tables = []

    	for (let table of Object.values (this.model.tables)) {

    		let {name, data} = table

    		if (!data || !data.length) continue

    		let idx = {}, f = {}, {p_k} = table, pk = r => p_k.map (k => '' + r [k]).join (' ')
    		
    		for (let r of Object.values (table.data)) {

    			for (let k in r) if (!(k in f)) f [k] = 1
    		
    			idx [pk (r)] = clone (r)
    			
    		}
    		
    		let {existing} = table; if (!existing) continue
    		
    		let cols = Object.keys (f).filter (n => existing.columns [n]); if (!cols.length) continue
    		
			let ids = Object.keys (idx); if (!ids.length) continue
			
			tables.push ({
				name, 
				cols, 
				ids, 
				idx,
				pk,
				key: p_k.length == 1 ? table.pk : `CONCAT (${p_k.join (",' ',")}`
			})
			
		}
    		
		let qq = s => this.pool.gen_sql_quoted_literal (s)

		while (tables.length) {
		
			let part = tables.splice (0, 50)

			let args = []; for (let {name, cols, ids, key} of part) {
			
				args.push (qq (name))
				
				args.push (`(SELECT json_agg (t) FROM (SELECT ${cols} FROM ${name}) t WHERE ${key} IN (${ids.map (qq)}))`)

			}

			let data = await this.select_hash (`SELECT json_build_object (${args}) v`)
			
			for (let [name, list] of Object.entries (data.v)) {
			
				let table = this.model.tables [name], {p_k} = table, {cols, idx, pk} = part.find (i => i.name == name)

				main: for (let r of list || []) {

					let id = pk (r), d = idx [id]; if (!d) continue main

					for (let k in d) if (!p_k.includes (k) && '' + r [k] != '' + d [k]) continue main

					delete idx [id]
					
				}
				
				table._data_modified = Object.values (idx)

			}

		}

    }    	

}
