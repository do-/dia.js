const Dia = require ('../../Dia.js')
const {Readable, PassThrough} = require ('stream')
const WrappedError = require ('../../Log/WrappedError.js')
const to_tsv       = require ('./postgresql/to_tsv.js')
const util         = require ('util')
const PgCursor     = require ('pg-cursor')

let pg_query_stream; try {pg_query_stream = require ('pg-query-stream')} catch (x) {console.log ('no pg-query-stream, ok')}

class PgClient extends Dia.DB.Client {

    is_pk_violation (e) {
        return e.code == '23505' && /_pkey$/.test (e.constraint)
    }
    
    async break () {
        
    	try {    	
	        await this.backend.end ()    	
    	}
    	catch (x) {    	
    		this.warn ('' + x)
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
    
    wrap_error (e, log_event) {
    	for (let k of ['file', 'line', 'position']) delete e [k]
		return new WrappedError (e, {log_meta: {...this.log_meta, parent: log_event}})
    }

    async select_all (original_sql, params = [], options = {}) {

    	if (!options.maxRows) options.maxRows = PgClient.MAX_SELECT_ALL

        let sql = this.fix_sql (original_sql)
                
    	await this.check_signature ()

        let log_event = this.log_start (sql, params)
        
        try {
        
        	const {maxRows, isPartial} = options

			const cursor = this.backend.query (new PgCursor (sql, params))

			const result = await new Promise ((ok, fail) => {

				cursor.read (isPartial ? maxRows : maxRows + 1, (err, rows) => {

					cursor.close ()

					if (err) return fail (err)

					if (!isPartial && rows.length > maxRows) return fail (Error (maxRows + ' rows limit exceeded. Plesae fix the request or consider using select_stream instead of select_all'))

					ok (rows)

				})

			})
			
			return result

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
        
    	await this.check_signature ()
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
        let all = await this.select_all (sql, params, {maxRows: 1, isPartial: true})
        return all.length ? all [0] : {}
    }
    
    async get (def) {
    
        const {sql, params, parts: [{cols}]} = this.query (def)

        return this [cols.length === 1 ? 'select_scalar' : 'select_hash'].call (this, sql, params)
    
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

                if (!ix) continue

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

        if (arguments.length == 1) return this.select_scalar (`INSERT INTO ${table} DEFAULT VALUES`, [])

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
        
    async delete (table, data, options = {}) {
    
		await super.delete (table, data, options)
		
		if (options.vacuum) {
		
			await this.commit ()
			
			await this.do ('VACUUM ' + table)
		
		}
		
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
    
    async check_signature () {
    
    	const {is_signed, handler, pool: {model: {spy}}} = this; if (is_signed || !spy || !handler) return
    	
    	this.is_signed = true

        const {sql, params} = spy.get_sql_params (handler)
        
		await this.do (sql, params, {no_log: !spy.verbose})
        
    }

    async do (sql, params = [], options = {}) {

    	if (params.length > 0) {

    		sql = this.fix_sql (sql)

    		params = params.map (v => typeof v == 'object' && v != null ? JSON.stringify (v) : v)

    	}
    	
    	await this.check_signature ()
        let log_event = options.no_log ? null : this.log_start (sql, params)

        try {
            return await this.backend.query (sql, params)
        }
        catch (e) {

        	if (!log_event) log_event = this.log_start (sql, params)
        
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
        
			if (log_event) this.log_finish (log_event)
			
		}

    }

    async load (is, table, cols, o = {NULL: ''}) {

    	await this.check_signature ()

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

	        const log_event = this.log_start (sql), croak = e => fail (this.wrap_error (e, log_event))

			is.on ('error', croak)

    		if (is._readableState.objectMode) {
    		
    			const o2s = new to_tsv (cols)

				o2s.on ('error', croak)

    			is = is.pipe (o2s)
    		
    		}

			let os = this.backend.query (require ('pg-copy-streams').from (sql))
			os.on ('error', croak)
			os.on ('finish', () => ok (this.log_finish (log_event)))			

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
					CASE WHEN pg_namespace.nspname = current_schema () THEN NULL ELSE pg_namespace.nspname END,
					pg_class.relname
				) AS name
                , pg_description.description AS label
                , pg_class.relpersistence = 'u' AS unlogged
                , pg_class.relkind
                , pg_class.reltuples AS _est_cnt
            FROM 
                pg_namespace
                LEFT JOIN pg_class ON (
                    pg_class.relnamespace = pg_namespace.oid
                    AND pg_class.relkind IN ('r', 'p', 'v')
                )
                LEFT JOIN pg_description ON (
                    pg_description.objoid = pg_class.oid
                    AND pg_description.objsubid = 0
                )
        `, [])
        
        let {model} = this, {tables, partitioned_tables, table_drops, views, view_drops} = model
        
        const RE_SYS = /^(pg_|information_schema\.)/
        
        for (let r of rs) {
        	
        	const {name, relkind} = r
        	
        	if (relkind === 'v') {

				if (RE_SYS.test (name)) continue

				if (name in view_drops) {
				
					view_drops [name].existing = r
				
					continue
					
				}

				if (name in views) continue

				model.odd ({type: 'unknown_view', id: name})

				continue

        	}        	
        
			let t = tables [name] || partitioned_tables [name]; if (!t) {

				if (RE_SYS.test (name)) continue
				
				if (name in table_drops) {
				
					table_drops [name].existing = r

					continue
					
				}

				model.odd ({type: 'unknown_table', id: name})

				continue

			}
			
			r.p_k = []
        
        	for (let k of ['columns', 'keys', 'triggers']) r [k] = {}
            
            t.existing = r

        	if (relkind === 'r' && r._est_cnt < 0) model.odd ({type: 'never_analyzed_table', id: name})

        }

		for (const i of Object.values (table_drops)) if (!i.existing) model.odd ({type: 'dropped_table', id: i.name})
		for (const i of Object.values (view_drops))  if (!i.existing) model.odd ({type: 'dropped_view',  id: i.name})
        
        for (let partitioned_table of Object.values (partitioned_tables)) {
        
        	let {partition} = partitioned_table
        	
			partition.list = []
        
        }
        
        try {
        
			rs = await this.select_all (`

				SELECT
					CONCAT_WS ('.', 
					CASE WHEN ptn.nspname = current_schema () THEN NULL ELSE ptn.nspname END,
					ptc.relname
				  ) table_name
					, CONCAT_WS ('.', 
					CASE WHEN pn.nspname = current_schema () THEN NULL ELSE pn.nspname END,
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
					WHEN c.table_schema = current_schema () THEN NULL
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
            
			if (!(r.name in t.columns)) model.odd ({type: 'unknown_column', id: t.name + '.' + r.name})

        }

        rs = await this.select_all (`
            SELECT
                CONCAT_WS ('.', 
                	CASE 
                        WHEN pg_namespace.nspname = current_schema () THEN NULL
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
                        WHEN schemaname = current_schema () THEN NULL
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
                CASE WHEN current_schema <> pg_namespace.nspname THEN pg_namespace.nspname || '.' ELSE '' END || table_from.relname AS table_name
                , c.conname AS ref_name
                , columns.attname AS column_name
                , table_to.relname AS ref
            FROM
                pg_catalog.pg_constraint c
                LEFT JOIN pg_namespace ON pg_namespace.oid = c.connamespace
                INNER JOIN pg_class AS table_from ON table_from.oid = c.conrelid
                INNER JOIN pg_class AS table_to ON table_to.oid = c.confrelid
                INNER JOIN pg_attribute AS columns ON columns.attrelid = table_from.oid AND c.conkey[1] = columns.attnum
            WHERE
                c.contype = 'f'
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
    
    	const {model} = this
    
    	let tables = []; for (const table of Object.values (model.tables)) if ('data' in table && 'existing' in table) {

    		const {name, data} = table

    		if (!Array.isArray (data)) {

				model.odd ({type: 'invalid_data', id: `${name}`})

    			continue

    		}

			const {length} = table.data; if (length === 0) {

				model.odd ({type: 'empty_data', id: `${name}`})

    			continue

    		}

    		const {p_k} = table, pk = r => p_k.map (k => '' + r [k]).join (' ')
    		
    		let idx = new Map (); for (const r of Object.values (table.data)) idx.set (pk (r), clone (r))
    		
    		const limit = Math.max (2 * length, 1000); if (table.existing._est_cnt > limit) model.odd ({type: 'excess_data', id: name})

    		let sql = `SELECT JSON_AGG (t) FROM (SELECT * FROM ${name} ORDER BY ${p_k} LIMIT ${limit}) t`, params = []

			tables.push ({
				name, 
				idx,
				pk,
				kv: `'${name}',(${sql})`,
				params,
				cols: Object.keys (table.columns).filter (n => !p_k.includes (n)),
				key: p_k.length == 1 ? table.pk : `CONCAT (${p_k.join (",' ',")})`,
			})
			
		}

		const eq = (rv, dv) => {switch (rv) {

			case null:
				return dv == null
				
			case false:
				switch (dv) {
					case false:
					case 'false':
					case 0:
					case '0':
						return true
					default:
						return false
				}
		
			case true:
				switch (dv) {
					case true:
					case 'true':
					case 1:
					case '1':
						return true
					default:
						return false
				}
		
			default:

				return typeof rv === 'object' ? util.isDeepStrictEqual (rv, JSON.parse (dv)) : rv == dv

		}}

		const {no_default_update_data} = this.pool.options

		while (tables.length) {

			const part = tables.splice (0, 10)
		
			const {v} = await this.select_hash (

				`SELECT JSON_BUILD_OBJECT (${part.map (t => t.kv)}) v`,

				Array.prototype.concat.apply ([], part.map (t => t.params))

			)
			
			for (const [name, list] of Object.entries (v)) {
			
				const table = model.tables [name], {p_k} = table, {cols, idx, pk} = part.find (i => i.name === name)

				main: for (let r of list || []) {

					const id = pk (r); if (!idx.has (id)) {
					
						model.odd ({type: 'unknown_data', id: `${name} [${id}]`, data: r})

						continue main
					
					}
					
					const d = idx.get (id); for (let k of cols) {

						const k_in_d = k in d

						if (!no_default_update_data || k_in_d) {

							const rv = r [k], dv = k_in_d ? d [k] : table.columns [k].COLUMN_DEF
					
							if (!eq (rv, dv)) continue main
						}
					}

					idx.delete (id)
					
				}

				table._data_modified = [...idx.values ()]

			}

		}

    }    	

}

PgClient.MAX_SELECT_ALL = 4294967294

module.exports = PgClient