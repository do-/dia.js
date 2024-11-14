const pg         = require ('pg')
const wrapper = require ('../Client/postgresql.js')
const crypto  = require ('crypto')
const LogEvent = require ('../../Log/Events/Text.js')
const ErrorEvent = require ('../../Log/Events/Error.js')

module.exports = class extends require ('../Pool.js') {

    constructor (o) {
        super (o)
        this.backend = new pg.Pool (o)

        pg.types.setTypeParser(pg.types.builtins.DATE, (dt) => dt === 'infinity' || dt === '-infinity' ? null : dt)
        pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (dt) => dt === 'infinity' || dt === '-infinity' ? null : dt)
        pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (dt) => dt === 'infinity' || dt === '-infinity' ? null : dt)
    }

    is_not_to_merge (i) {
    
    	if (super.is_not_to_merge (i)) return true
    
    	let {sql} = i
    	
    	if (/^\s*VACUUM\b/i.test (sql)) return true
    	
    	return false
    
    }

    async run (list, o = {}) {
    
    	if (!o.no_merge_sql || o.no_merge_sql >= 1000) list = this.merge_sql (list)
    
    	return super.run (list)

    }

    async listen (o = {}) {

		let log_meta = o.log_meta || {}

		let log_event = this.log_write (new LogEvent ({
			...log_meta,
			category: 'db',
			label: 'Subscribing on for PostgreSQL notifications on ' + o.name,
			phase: 'before',
		}))

		let db = new (require ('pg')).Client (this.options)
		
		db.connect ()
		
		if (!o.timers) o.timers = this._timers
		
		for (let name in o.timers) {
		
			let key = 'timer_' + name
		
			let hash = crypto.createHash ('sha256')
			
			hash.update (key)
			
			let digest = hash.digest ('hex').slice (0, 16)

			let log_event_1 = this.log_write (new LogEvent ({
				...log_meta,
				parent: log_event,
				category: 'db',
				label: `Aquiring cluster wide lock for ${key} (${digest})`,
				phase: 'before',
			}))

			try {

				let rs = await db.query (`SELECT pg_try_advisory_lock (x'${digest}'::int8) AS ok`) // njsscan-ignore: node_sqli_injection
				
				if (!rs) throw new Error ('!rs')
				
				let {rows} = rs; if (!rows) throw new Error ('!rs.rows')

				let {length} = rows; if (length != 1) throw new Error ('rs.rows.length == ' + length + ' != 1')

				if (!rows [0].ok) throw new Error ('!rows [0].ok, rows = ' + JSON.stringify (rows))

			}
			catch (e) {
			
				e.log_meta = {parent: log_event_1}
			
				this.log_write (new ErrorEvent (e))
			
			}
			finally {

				this.log_write (log_event_1.finish ())

			}

		}
		
		let sql = 'LISTEN ' + o.name
		
		db.query (sql) // njsscan-ignore: node_sqli_injection
		
		db.on ('notification', async e => {

			let log_event = this.log_write (new LogEvent ({
				...log_meta,
				category: 'db',
				label: 'PostgreSQL notification: ' + JSON.stringify (e),
				phase: 'before',
			}))

			try {

				let {payload} = e; 
				
				if (payload.charAt (0) != '{') {
				
					let {timers} = o; if (!timers) throw new Error ('The payload is scalar, but no timers were defined')
					
					let timer = timers [payload]; if (!timer)  throw new Error (`Timer '${payload}' not found`)

					timer.on ('DB notification received')

				}
				else {

					let {handler} = o; if (!handler) throw new Error ('The payload is object, but no handler was defined')
					
					let rq = JSON.parse (payload)

					await new Promise ((ok, fail) => {

                        // nosemgrep: javascript.lang.security.insecure-object-assign.insecure-object-assign
						let h = new handler (Object.assign ({rq}, o.params), ok, fail)

						h.run ()

					})

				}
			
			}
			catch (x) {

				x.log_meta = {parent: log_event}

				this.log_write (new ErrorEvent (x))

			}
			finally {

				this.log_write (log_event.finish ())

			}

		})

		this.log_write (log_event.finish ())

		return db

    }    
        
    async acquire (o = {}) {
        let raw = await this.backend.connect ()
        return this.inject (new wrapper (raw), o)
    }

    async release (client) {
        return await client.release ()
    }

    async select_version (db) {
        let label = await db.select_scalar (`SELECT version()`)
        let [m, major, minor] = label.match (/PostgreSQL\s+(\d+)\.(\d+)\b/i)
        major = +major
        minor = +minor
        return {
            major,
            minor,
            label,
        }
    }

    quote_name (s) {
        return ('' + s).split ('.').map (s => '"' + s.replace (/"/g, '""') + '"').join ('.')
    }
    
    gen_sql_type_dim (col) {
    
        let sql = col.TYPE_NAME
        
        if (col.COLUMN_SIZE > 0) {
            sql += '(' + col.COLUMN_SIZE
            if (col.DECIMAL_DIGITS) sql += ',' + col.DECIMAL_DIGITS
            sql += ')'
        }
        
        return sql
        
    }
    
    gen_sql_column_definition (col) {
    
        let sql = this.gen_sql_type_dim (col)
                
        let def = col.COLUMN_DEF; if (def != undefined) {
        
        	if (def == 'AUTO_INCREMENT') {
        	
				sql += ' GENERATED BY DEFAULT AS IDENTITY'
        	
        	}
        	else {

				if (def.indexOf (')') < 0) def = this.gen_sql_quoted_literal (def)

				sql += ' DEFAULT ' + def

        	}
                
        }
        
        if (col.NULLABLE === false) sql += ' NOT NULL'
        
        return sql

    }
    
    gen_sql_add_table (table) {
    
        let p_k = table.p_k
		let col = table.columns

        return {
            sql: `CREATE ${table.unlogged ? 'UNLOGGED ' : ''}TABLE ${table.qname} (${p_k.map (k => k + ' ' + this.gen_sql_column_definition (col [k]))}, PRIMARY KEY (${p_k}))`,
            params: []
        }

    }

    gen_sql_update_partitioned_tables () {
    
    	let result = [], {partitioned_tables} = this.model

    	for (let name of Object.keys (partitioned_tables).sort ()) {
    	
    		let table = partitioned_tables [name], {qname, columns, partition, existing, p_k} = table

    		if (!existing) {

                result.push ({sql: `CREATE TABLE ${qname} (${Object.values (columns).filter (i => i !== -Infinity).map (col => col.name + ' ' + this.gen_sql_column_definition (col))}) PARTITION BY ${partition.by}`})

                if (Array.isArray (p_k) && p_k.length > 1) result.push ({sql: `ALTER TABLE ${qname} ADD PRIMARY KEY (${p_k})`})

				continue
				
			}

    		let r = [], ex = clone (table.existing), cols = clone (columns)

	    	this.add_sql_update_columns (table, r)

	    	if (!r.length) continue

	    	for (let i of r) result.push (i)
/*
			for (let {name, filter} of partition.list) result.push ({sql: `ALTER TABLE ${qname} DETACH PARTITION ${name}`})

			for (let {name, filter} of partition.list) {

				table.existing = ex
				table.columns  = cols
				table.qname    = name

		    	this.add_sql_update_columns (table, result)

			}

			for (let {name, filter} of partition.list) result.push ({sql: `ALTER TABLE ${qname} ATTACH PARTITION ${name} ${filter}`})
			
			table.existing = ex
			table.qname = qname
*/
    	}
    	
    	return result

    }
    
    gen_sql_drop_foreign_tables () {
    
    	let {foreign_tables} = this.model; if (!foreign_tables) return []
    	
    	let qnames = Object.values (foreign_tables).map (v => v.qname); if (!qnames.length) return []
    	
    	return [{sql: `DROP FOREIGN TABLE IF EXISTS ${qnames} CASCADE`}]

    }

    gen_sql_drop_views () {

        let views = Object.values (this.model.views || {})
        let view_drops = Object.values (this.model.view_drops || {}).concat (views)

    	return [
            `DROP VIEW IF EXISTS ${view_drops.map (i => i.qname)} CASCADE`,

            ...views.map (({qname, columns}) =>
    			
    			`CREATE OR REPLACE VIEW ${qname} AS SELECT ${
    			
    				Object.values (columns).map (
    				
						col => {
							let type = this.gen_sql_type_dim (col)
							if (type == 'SERIAL') type = 'INT'
							return `NULL::${type} AS ${col.name}`
						}
    					
    				)
    			
    			}`)

    	].map (sql => ({sql}))
    		
    }

    gen_sql_drop_tables () {

        let table_drops = Object.values (this.model.table_drops)

        return [
            `DROP TABLE IF EXISTS ${table_drops.map (i => i.qname)} CASCADE`,
        ].map (sql => ({sql}))

    }

    gen_sql_create_views () {

    	return Object.values (this.model.views || [])
    	
    		.map (({qname, columns, sql}) => `CREATE OR REPLACE VIEW ${qname} AS SELECT ${    		
    		
    			Object.values (columns).map (

					col => {
						let type = this.gen_sql_type_dim (col)
						if (type == 'SERIAL') type = 'INT'
						return `${col.name}::${type} AS ${col.name}`
					}

    			)
    		
    		} FROM (${sql}) t`)
    			
    		.map (sql => ({sql}))

    }

    gen_sql_add_tables () {

        let result = []

        for (let table of Object.values (this.model.tables)) if (!table.existing) {
        
			let existing = {columns: {}, keys: {}, triggers: {}}

			for (let k of ['pk', 'p_k']) existing         [k] = clone (table [k])
			for (let k of     table.p_k) existing.columns [k] = clone (table.columns [k])
            
            table.existing = existing
            table._is_just_added = 1

            result.push (this.gen_sql_add_table (table))

        }

        return result

    }

    gen_sql_comment_tables () {

        let result = []

        for (let table of Object.values (this.model.tables)) 
        
            if (table.label != table.existing.label)

                result.push ({sql: `COMMENT ON TABLE ${table.qname} IS ` + this.gen_sql_quoted_literal (table.label), params: []})

        return result

    }

    gen_sql_upsert_data () {

        let result = []
        
        for (const table of Object.values (this.model.tables)) {

            const data = table._data_modified || table.data; if (!data || !data.length) continue

            for (const record of data) {

                let [f, s, v, params] = [[], [], [], []]

                for (const k in table.columns) {
                                            
                    f.push (k)
                    
                    if (k in record) {

                    	v.push ('?')
                    	params.push (record [k])

                    }
                    else {

                    	v.push ('DEFAULT')

                    }

                    if (!table.p_k.includes (k)) s.push (`${k}=EXCLUDED.${k}`)

                }
                
                const something = s.length ? 'UPDATE SET ' + s : 'NOTHING'

                result.push ({sql: `INSERT INTO ${table.qname} (${f}) VALUES (${v}) ON CONFLICT (${table.pk}) DO ${something}`, params})

            }
        
        }

        return result

    }
    
    gen_sql_add_column (table, col) {
    
        return {
            sql: `ALTER TABLE ${table.qname} ADD "${col.name}" ` + this.gen_sql_column_definition (col), 
            params: []
        }
    
    }
    
    gen_sql_recreate_tables () {
    
        let result = []
        
        for (let table_name in this.model.tables) {
        
            let table = this.model.tables [table_name]
            
            let {existing} = table; if (!existing) continue
            
            if ( table.unlogged && !existing.unlogged) result.push ({sql: `ALTER TABLE ${table.qname} SET UNLOGGED`})
            if (!table.unlogged &&  existing.unlogged) result.push ({sql: `ALTER TABLE ${table.qname} SET LOGGED`})

            if ('' + table.p_k == '' + table.existing.p_k) continue
            
            let on = table.on_before_recreate_table; if (on) {
            	
            	if (typeof on === 'function') on = on (table)
            	
            	if (on == null) on = []
            	
            	if (!Array.isArray (on)) on = [on]
            	
            	result.push (...on)

            }
            
            delete table.model

            let tmp_table = clone (table)

            for (let сol_name of table.existing.p_k) {
                if (tmp_table.p_k.includes (сol_name)) continue
                tmp_table.columns [сol_name] = table.existing.columns [сol_name]
            }

            for (let t of [table, tmp_table]) t.model = this.model
            
            tmp_table.name = 't_' + String (Math.random ()).replace (/\D/g, '_') // njsscan-ignore: node_insecure_random_generator
            tmp_table.qname = this.quote_name (tmp_table.name)

            result.push (this.gen_sql_add_table (tmp_table))
            
            let cols = []

            for (let col of Object.values (tmp_table.columns)) if (col) {

                let col_name = col.name

                if (!table.existing.columns [col_name]) continue

                cols.push (col_name)

                if (tmp_table.p_k.includes (col_name)) continue

                delete col.COLUMN_DEF
                delete table.existing.columns [col_name].COLUMN_DEF

                result.push (this.gen_sql_add_column (tmp_table, col))

            }

            result.push ({sql: `INSERT INTO ${tmp_table.qname} (${cols}) SELECT ${cols} FROM ${table.name}`, params: []})

			let on_before_refs = table.on_before_recreate_table_refs; if (on_before_refs) {

				if (typeof on_before_refs === 'function') on_before_refs = on_before_refs (tmp_table)

				if (on_before_refs == null) on_before_refs = []

				if (!Array.isArray (on_before_refs)) on_before_refs = [on_before_refs]

				result.push (...on_before_refs)

			}

			if (tmp_table.p_k.length == 1) {
				
				let TYPE_NAME = tmp_table.columns [tmp_table.pk].TYPE_NAME

				for (let ref_table_name in this.model.tables) {

					let ref_table = ref_table_name == table.name ? tmp_table : this.model.tables [ref_table_name]

					for (let col of Object.values (ref_table.columns)) {

						if (col.ref != table.name) continue

						if (!ref_table.existing.columns[col.name]) continue
						if (!table.existing.columns[table.existing.pk]) continue
						if (ref_table.existing.columns[col.name].TYPE_NAME != table.existing.columns[table.existing.pk].TYPE_NAME) continue

						let tmp_col = {TYPE_NAME, ref: tmp_table, name: 'c_' + String (Math.random ()).replace (/\D/g, '_')} // njsscan-ignore: node_insecure_random_generator
						result.push ({sql: `ALTER TABLE ${ref_table.qname} DISABLE TRIGGER USER`, params: []})
						result.push (this.gen_sql_add_column (ref_table, tmp_col))
						result.push ({sql: `UPDATE ${ref_table.qname} r SET ${tmp_col.name} =t.${tmp_table.pk} FROM ${tmp_table.name} t WHERE t.${table.existing.pk}=r.${col.name}`, params: []})
						result.push ({sql: `ALTER TABLE ${ref_table.qname} DROP COLUMN ${col.name}`, params: []})
						result.push ({sql: `ALTER TABLE ${ref_table.qname} RENAME ${tmp_col.name} TO ${col.name}`, params: []})
						result.push ({sql: `ALTER TABLE ${ref_table.qname} ENABLE TRIGGER USER`, params: []})

						ref_table.columns [col.name].TYPE_NAME = TYPE_NAME

					}

				}
				
			}

            result.push ({sql: `DROP TABLE ${table.qname} CASCADE`, params: []})
            result.push ({sql: `ALTER TABLE ${tmp_table.qname} RENAME TO ${table.qname}`, params: []})
            result.push ({sql: `ALTER INDEX IF EXISTS ${tmp_table.name}_pkey RENAME TO ${table.name}_pkey`, params: []})

            table.existing.pk  = table.pk
            table.existing.p_k = table.p_k
            for (let name of table.p_k) table.existing.columns [name] = table.columns [name]

        }        
        
        return result

    }
    
    is_type_int (t) {
    
    	return /^INT/.test (t)
    
    }
    
    is_column_to_alter_to_int (ex_col, col) {
    
	if (ex_col.TYPE_NAME == 'BIT') return true

    	if (!this.is_type_int (ex_col.TYPE_NAME)) return false
    	
    	let len = c => parseInt (c.TYPE_NAME.slice (3))
    	
    	return len (col) > len (ex_col)

    }
    
    is_column_to_alter_to_numeric (ex_col, col) {

    	let {TYPE_NAME} = ex_col

    	if (this.is_type_int (TYPE_NAME)) return true

    	if (TYPE_NAME != 'NUMERIC') return false
    	
    	for (let k of ['COLUMN_SIZE', 'DECIMAL_DIGITS']) if (col [k] > ex_col [k]) return true
    	
    	return false

    }
    
    is_column_to_alter_to_varchar (ex_col, col) {

    	let {TYPE_NAME} = ex_col

    	if (TYPE_NAME != 'VARCHAR') return false
    	
    	for (let k of ['COLUMN_SIZE']) if (col [k] > ex_col [k]) return true
    	
    	return false

    }
        
    is_column_to_alter_to_text (ex_col, col) {

    	let {TYPE_NAME} = ex_col

        if (/CHAR$/.test (TYPE_NAME)) return true

        if (/^INT/.test (TYPE_NAME)) return true

        if (TYPE_NAME == 'NUMERIC') return true

    	return false

    }
    
    is_column_to_alter_to_timestamp (ex_col, col) {

    	let {TYPE_NAME} = ex_col

		if (TYPE_NAME == 'DATE') return true
    	
    	return false

    }

    is_column_to_alter (ex_col, col) {
    
    	if (
    		ex_col.TYPE_NAME == col.TYPE_NAME && 
    		ex_col.COLUMN_SIZE == col.COLUMN_SIZE && 
    		ex_col.DECIMAL_DIGITS == col.DECIMAL_DIGITS
    	) return false
    	
    	let {TYPE_NAME} = col

		if (this.is_type_int (TYPE_NAME)) return this.is_column_to_alter_to_int (ex_col, col)
		
		switch (TYPE_NAME) {
			case 'VARCHAR':   return this.is_column_to_alter_to_varchar   (ex_col, col)
			case 'NUMERIC':   return this.is_column_to_alter_to_numeric   (ex_col, col)
			case 'TEXT':      return this.is_column_to_alter_to_text      (ex_col, col)
			case 'TIMESTAMP': return this.is_column_to_alter_to_timestamp (ex_col, col)
			default:          return false
		}

    }

    gen_sql_alter_column_using (ex_col, col) {

        let using = ''

        if (ex_col.TYPE_NAME == 'BIT' && col.TYPE_NAME == 'INT') using = `"${col.name}"::INT`
        if (ex_col.TYPE_NAME == 'BIT' && col.TYPE_NAME == 'INT2') using = `"${col.name}"::INT::INT2`

        return using ? ` USING ${using}` : ''

    }

    add_sql_add_column (table, col, existing_columns, result) {

        let {name} = col

        if (table.p_k.includes (name)) return

        if (name in existing_columns) {

            let after = table.on_after_add_column
            after = typeof after === 'function' ? after(table) : after
            table.on_after_add_column = after

            if (after && name in after) {
            	this.model.odd ({type: 'on_after_add_column', id: `${table.name}.${name}`})
                delete after[name]
            }

        	return

        }

        result.push (this.gen_sql_add_column (table, col))
                        
        existing_columns [name] = clone (col)
        
        delete existing_columns [name].REMARK

    }
    
    add_sql_alter_column (table, col, existing_columns, result) {

        let {name} = col, ex_col = existing_columns [name]; 
        
        if (!ex_col || !this.is_column_to_alter (ex_col, col)) return
        
		if (ex_col.COLUMN_DEF) {
			result.push ({sql: `ALTER TABLE ${table.qname} ALTER COLUMN "${col.name}" DROP DEFAULT`, params: []})
			delete ex_col.COLUMN_DEF
		}
		
        result.push ({sql: `ALTER TABLE ${table.qname} ALTER "${col.name}" TYPE ${this.gen_sql_type_dim (col)} ${this.gen_sql_alter_column_using (ex_col, col)}`, params: []})

		for (let k of ['TYPE_NAME', 'COLUMN_SIZE', 'DECIMAL_DIGITS']) ex_col [k] = col [k]
                
    }
    
    add_sql_set_default_column (table, col, existing_columns, result) {
    
        let d = col.COLUMN_DEF, ex = existing_columns [col.name], exd = ex.COLUMN_DEF

        if (col.TYPE_NAME == 'SERIAL') return

        if (typeof exd === 'string') {

            const pos = exd.indexOf ('('); if (pos !== -1) {

                // postgres identifier limit is 63 chars
                // eslint-disable-next-line redos/no-vulnerable
                const RE_FUNCTION_NAME = /([\w_]{1,63})\s*\(/g

                for (const fun of exd.matchAll (RE_FUNCTION_NAME)) if ((fun [1]).toLowerCase () in this.model.functions) {

                    exd = null

                    break

                }

            }

        }

        const invariant = s => {

            if (typeof s !== 'string') return s

            if (s.slice (-3) === ' ()') s = s.slice (0,-3) + '()'

            switch (s) {
                case 'now()': return 'NOW()'
                case 'infinity': return 'Infinity'
                case '-infinity': return '-Infinity'
                default: return s
            }

        }

        if (invariant (d) != invariant (exd)) {

            if (d !== null && exd !== null) this.model.odd ({type: 'changed_default', id: `${table.name}.${col.name}: ${exd} -> ${d}`})

        	if (d == 'AUTO_INCREMENT') {
        	
				if (exd) {

					if (exd == 'AUTO_INCREMENT') result.push ({sql: `ALTER TABLE ${table.qname} ALTER COLUMN "${col.name}" DROP IDENTITY IF EXISTS`})

					result.push ({sql: `ALTER TABLE ${table.qname} ALTER COLUMN "${col.name}" DROP DEFAULT`}) // just in case

				}
				
				result.push ({sql: `DO $$

					DECLARE _max INT;

					BEGIN

						SELECT MAX ("${col.name}") INTO _max FROM ${table.qname};

						IF _max IS NULL THEN _max = 0; END IF;

						EXECUTE FORMAT ('ALTER TABLE ${table.qname} ALTER COLUMN "${col.name}" ADD GENERATED BY DEFAULT AS IDENTITY (START WITH %s)', _max + 1);

					END;

				$$`})

        	}        
            else {
            
				if (d == null) {

					result.push ({sql: `ALTER TABLE ${table.qname} ALTER COLUMN "${col.name}" DROP DEFAULT`})

				}
				else {

                    if (ex.NULLABLE) {

                        const [v, params] = d.indexOf ('(') < 0 ? ['?', [d]] : [d, []]

                        result.push ({sql: `UPDATE ${table.qname} SET "${col.name}" = ${v} WHERE "${col.name}" IS NULL`, params})

                    }

					if (d.indexOf (')') < 0) d = this.gen_sql_quoted_literal (d)

					result.push ({sql: `ALTER TABLE ${table.qname} ALTER COLUMN "${col.name}" SET DEFAULT ${d}`, params: []})

				}
            
            }
                                
        }
        
        let n = col.NULLABLE; if (n != ex.NULLABLE) {

            result.push ({sql: `ALTER TABLE ${table.qname} ALTER COLUMN "${col.name}" ${n ? 'DROP' : 'SET'} NOT NULL`, params: []})

        }

    }    
    
    add_sql_update_columns (table, result) {
    
    	let {existing, columns} = table
    	
    	for (let name of Object.keys (columns).sort ()) {
    	
    		const col = columns [name]

    		if (col === -Infinity) {
    			
				if (name in existing.columns) {

					let before = table.on_before_drop_column; if (before) {

						if (typeof before === 'function') before = before (table)

						let b = before [name]

						if (b) for (let i of b) result.push (i)

					}

					result.push ({sql: `ALTER TABLE ${table.qname} DROP COLUMN IF EXISTS "${name}" CASCADE`, params: []})

				}
				else {
				
					this.model.odd ({type: 'dropped_column', id: `${table.name}.${name}`})
				
				}
			
    			delete columns [name]
    			
    		}
    		else {
    		
				for (let action of ['add', 'alter', 'set_default'])

		    		this [`add_sql_${action}_column`] (table, col, existing.columns, result)

    		}
    			
		}

    }

    gen_sql_update_columns () {

        let result = [], {tables} = this.model

        for (let name of Object.keys (tables).sort ())
        
        	this.add_sql_update_columns (tables [name], result)

        return result

    }
    
    gen_sql_after_add_columns () {

        let result = [], {tables} = this.model

        for (let name of Object.keys (tables).sort ())
            this.add_sql_after_add_columns (tables [name], result)

        return result

    }

    add_sql_after_add_columns (table, result) {

        if (table._is_just_added || !table.on_after_add_column) return

        let {existing, columns} = table

        for (let name of Object.keys (columns).sort ()) {

            let col = columns [name], after = table.on_after_add_column

            if (table.p_k.includes (col.name) || !existing.columns [col.name]) continue

            if (typeof after === 'function')
                throw new Error('on_after_add_column not expected as a function')

            let a = after [col.name]

            if (a) for (let i of a) result.push (i)

        }

    }

    gen_sql_drop_foreign_keys () {

        let result = []

        for (let table of Object.values (this.model.tables)) {
        
        	let {existing} = table; if (!existing) continue

        	let {columns} = existing; if (!columns) continue
        	
        	let actions = []
        	
        	for (let {ref_names} of Object.values (columns)) 
        		
        		if (ref_names) 
        		
        			for (let ref_name of ref_names) 
        			
        				actions.push (`DROP CONSTRAINT IF EXISTS ${ref_name} CASCADE`)
        	        	
        	if (actions.length) 
        		
        		result.push ({sql: `ALTER TABLE ${table.qname} ${actions}`})

        }

		return result
        
    }
    
    gen_sql_create_foreign_keys () {
    
        let result = [], {model} = this, {tables} = model

        for (let table of Object.values (tables)) {
        	
        	let actions = []; for (let column of Object.values (table.columns)) {
        	
        		let {name, ref, ref_on_delete} = column; if (!ref || column.ref_no_constraint) continue
        		
        		let rt = tables [ref]; if (rt) {
        			
        			let references = 'REFERENCES ' + tables [ref].qname
        			
        			if (ref_on_delete) references += ' ON DELETE ' + ref_on_delete
        		
        			actions.push (`ADD FOREIGN KEY (${name}) ${references} NOT VALID`)

        		} 
        		else {

        			if (!model.relations [ref]) this.model.odd ({type: 'unknown_ref', id: `${table.name}.${name}`})

        		}

        	} 

        	if (actions.length) result.push ({sql: `ALTER TABLE ${table.qname} ${actions}`})

		}

        return result
    
    }
    
    gen_sql_comment_columns () {

        let result = []

        for (let table of [
        	...Object.values (this.model.tables),
        ]) {

            let existing_columns = table.existing.columns

            for (let col of Object.values (table.columns)) {
            
                let label = col.REMARK || '', old_label = (existing_columns [col.name] || {}).REMARK || ''

                if (label != old_label) result.push ({sql: `COMMENT ON COLUMN ${table.qname}."${col.name}" IS ` + this.gen_sql_quoted_literal (label), params: []})

            }

        }

        return result

    }    
    
    gen_sql_recreate_triggers () {
    
        let result = []
        
        for (const type of ['tables', 'partitioned_tables']) for (let table of Object.values (this.model [type])) {

            let {triggers} = table; if (!triggers) continue
                    
            for (let name in triggers) {
            
                let src = triggers [name]
                
                let [phase, ...events] = name.toUpperCase ().split ('_')

                let glob = `on_${name}_${table.name}`

                if ((this.model.conf.db.skip_recreating_unchanged || {}).triggers && src && src != -Infinity && this.model.procs[glob] === src) continue

                result.push ({sql: `DROP FUNCTION IF EXISTS "${glob}" () CASCADE`})

                if (!src || src === -Infinity) continue

                const QUOT = '$_TTT_$'

                result.push ({sql: `
                	CREATE FUNCTION 
                		"${glob}" () 
                	RETURNS 
                		trigger 
                	AS 
                		${QUOT}${src}${QUOT} 
                	LANGUAGE 
	                	plpgsql;`
                })

                const for_each_row = name.endsWith('_truncate') ? '' : 'FOR EACH ROW'

                result.push ({sql: `
                    CREATE TRIGGER 
                        "${glob}"
                    ${phase} ${events.join (' OR ')} ON 
                        ${table.name}
                    ${for_each_row} EXECUTE PROCEDURE 
                        "${glob}" ();`
                })

            }

        }

        delete this.model.procs

        return result

    }

    normalize_model_table_key (table, k) {

        let glob = `ix_${table.schema ? table.name.replace('.', '_') : table.name}_${k}`

        let src = table.keys [k]
        
        if (src === -Infinity) src = null

        if (src != null) {        
            if (glob.length > 63) throw `Index name "${k}" for table "${table.name}" is too long`

        	if (typeof src == 'object') {
        		{
        			const K = 'constraint_error_messages'
        			if (!table [K]) table [K] = {}
        			table [K] [glob] = src.error
        		}
        		src = src.src
        	}        
            src = src.trim ()
            if (src.indexOf ('(') < 0) src = `(${src})`
            if (src.indexOf ('USING') < 0) src = src.replace ('(', 'USING btree (')
            src = src.replace ('USING', ` INDEX ${glob} ON ${table.name} USING`).trim ()
            src = 'CREATE ' + src
        }

        table.keys [k] = src

        let o = [table.keys]; for (let j of ['on_before_create_index']) if (table [j]) o.push (table [j])

        for (let h of o) if (k in h) {
        	let v = h [k]
			delete h [k]
			h [glob] = v
        }

    }

    gen_sql_update_keys () {
    
        let result = []

        const invariant = function (s) {
            if (s == null) return ''
            return s
                .replace (/B'/g, "'")
                .replace (/[\s\(\)]/g, '')
                .replace (/::\"\w+\"/g, '')
                .toLowerCase ()
        }

        for (const kind of ['tables', 'partitioned_tables']) for (let table of Object.values (this.model [kind])) {
        
            let keys = table.keys

            if (!keys) continue
        
            let existing_keys = (table.existing || {keys: {}}).keys
            
            let before = table.on_before_create_index

			for (let name in keys) {
            
                let src = keys [name]
                
                let old_src = existing_keys [name]
                
                let original_name = name.split (table.name + '_') [1]
                
           		if (old_src && before && name in before) this.model.odd ({type: 'on_before_create_index', id: `${table.name}.${original_name}`})

                if (invariant (src) == invariant (old_src)) continue

                this.model.odd ({type: 'redefined_index', id: `${old_src} -> ${src}`})

                if (old_src) {
                	result.push ({sql: `DROP INDEX IF EXISTS ${(table.schema ? table.schema + '.' : '') + name};`, params: []})
                }
                else if (before) {
                    let b = before [name]
                    if (b) for (let i of b) result.push (i)
                }
                
                if (src != null) {
                
                	result.push ({sql: src, params: []})

                	let {columns} = table, cols = [...new Set(src.split(/\W+/).filter(c => columns[c]))]

                	if (cols.length > 0) result.push ({sql: `VACUUM ANALYZE ${table.name} (${cols})`, params: []})

                }

            }

        }

        return result

    }

    normalize_model_table_trigger (table, k) {

        let src = table.triggers [k]; if (src === -Infinity) return

        src = src.replace (/\s+/g, ' ').trim ()

        if (!src.match (/^DECLARE/)) src = `BEGIN ${src} END;`
        
        const re_pseudocomment_validate = new RegExp ('\\/\\*\\+\\s*VALIDATE\\s+(\\w+)\\s*\\*\\/', 'mg')

        src = src.replace (re_pseudocomment_validate, (m, name) => {
        
        	if (name != 'ALL') return this.trg_check_column_value (table, name)
        	
        	let sql = ''; for (let name in table.columns) {
        	
        		let column = table.columns [name]

        		if (!table.model.has_validation (column)) continue
        		
        		sql += this.trg_check_column_value (table, name)
        	
        	}

       		return sql
        
        })

        table.triggers [k] = src

    }
        
    trg_check_column_value (table, name) {
    
    	let sql = ''

			let col = table.columns [name]
			
			if (col) {
			
				if (col.MIN)        sql += this.trg_check_column_value_min        (col, table)
				if (col.MAX)        sql += this.trg_check_column_value_max        (col, table)
				if (col.MIN_LENGTH) sql += this.trg_check_column_value_min_length (col, table)
				if (col.PATTERN)    sql += this.trg_check_column_value_pattern    (col, table)			
			
			}
			else {
			
				this.model.odd ({type: 'trg_check_column_value', id: `${table.name}.${name}`})

			}

    	return sql

    }

    trg_check_column_value_min (col, table) {
    
    	let type = col.TYPE_NAME.toUpperCase ()
    
    	if (/(INT|NUM|DEC)/.test (type)) return this.trg_check_column_value_min_num (col, table)
    	if (/(DATE|TIME)/.test (type)) return this.trg_check_column_value_min_date (col, table)
    	
		throw `Can't check MIN condition for ${type} type: ${table.name}.${col.name}`
    	
    }

    trg_check_column_value_max (col, table) {
    
    	let type = col.TYPE_NAME.toUpperCase ()
    
    	if (/(INT|NUM|DEC)/.test (type)) return this.trg_check_column_value_max_num (col, table)
    	if (/(DATE|TIME)/.test (type)) return this.trg_check_column_value_max_date (col, table)
    	
		throw `Can't check MAX condition for ${type} type: ${table.name}.${col.name}`
    	
    }

    trg_check_column_value_min_num (col, table) {return `
		IF NEW.${col.name} IS NOT NULL AND NEW.${col.name} < ${col.MIN} THEN
			RAISE '#${col.name}#: ${table.model.trg_check_column_value_min_num (col, table)}';
		END IF;
    `}

    trg_check_column_value_min_date (col, table) {
	    
	    let v = `'${col.MIN}'`; if (v == "'NOW'") v = 'now()'

	    return `
		IF NEW.${col.name} IS NOT NULL AND NEW.${col.name} < ${v} THEN
			RAISE '#${col.name}#: ${table.model.trg_check_column_value_min_date (col, table)}';
		END IF;
	    `
    }

    trg_check_column_value_max_num (col, table) {return `
		IF NEW.${col.name} IS NOT NULL AND NEW.${col.name} > ${col.MAX} THEN
			RAISE '#${col.name}#: ${table.model.trg_check_column_value_max_num (col, table)}';
		END IF;
    `}

    trg_check_column_value_max_date (col, table) {
    
    	let v = `'${col.MAX}'`; if (v == "'NOW'") v = 'now()'

		return `
			IF NEW.${col.name} IS NOT NULL AND NEW.${col.name} > '${v}' THEN
				RAISE '#${col.name}#: ${table.model.trg_check_column_value_max_date (col, table)}';
			END IF;
		`

    }
    
    trg_check_column_value_min_length (col, table) {return `
		IF NEW.${col.name} IS NOT NULL AND LENGTH (NEW.${col.name}) < ${col.MIN_LENGTH} THEN
			RAISE '#${col.name}#: ${table.model.trg_check_column_value_min_length (col, table)}';
		END IF;
    `}

    trg_check_column_value_pattern (col, table) {return `
		IF NEW.${col.name} IS NOT NULL AND NEW.${col.name}::text !~ '${col.PATTERN}' THEN
			RAISE '#${col.name}#: ${table.model.trg_check_column_value_pattern (col, table)}';
		END IF;
	`}

    normalize_model () {

    	super.normalize_model ()
    	
    	let {model} = this

    	if (!model.schemas) model.schemas = {}

    	for (let type of ['relation', 'function', 'procedure']) {

    		for (let name in model [type + 's']) {

    			let parts = name.split ('.'); switch (parts.length) {

    				case 3: throw `Invalid ${type} name: ${name}`

    				case 2: 
    					let [s] = parts
    					if (!model.schemas [s]) model.schemas [s] = {}

    			}    			

    		}

    	}

        for (let type of ['function', 'procedure']) {
        
        	for (let i of Object.values (model [type + 's'])) {
        	
        		if (!i.language) i.language = 'plpgsql'
        		
        		if (!i.options)  i.options = ''
        	
        	}
                			
		}

    }
    
    normalize_model_table_column (table, col) {

        super.normalize_model_table_column (table, col)

        if (table.p_k.includes (col.name)) col.NULLABLE = false

        if (col.TYPE_NAME == 'SERIAL') {
            if (col.ref) {
                col.TYPE_NAME = 'INT'
            } else if (this.version.major >= 10) {
                col.TYPE_NAME = 'INT'
                if (!col.ref) col.COLUMN_DEF = 'AUTO_INCREMENT'
            }
        }

        function get_int_type_name (prefix) {switch (prefix) {
            case 'MEDIUM': 
            case 'BIG': 
                return 'INT8'
            case 'SMALL': 
            case 'TINY':
                return 'INT2'
            default: 
                return 'INT4'
        }}
        
        if (/INT$/.test (col.TYPE_NAME)) {
            col.TYPE_NAME = get_int_type_name (col.TYPE_NAME.substr (0, col.TYPE_NAME.length - 3))
        }
        else if (/(RCHAR|STRING|TEXT)$/.test (col.TYPE_NAME)) {
            col.TYPE_NAME = col.COLUMN_SIZE ? 'VARCHAR' : 'TEXT'
        }
        else if (/BINARY$/.test (col.TYPE_NAME)) {
            col.TYPE_NAME = 'BYTEA'
        }
        else if (/BLOB$/.test (col.TYPE_NAME)) {
            col.TYPE_NAME = 'OID'
        }
        else if (col.TYPE_NAME == 'DECIMAL' || col.TYPE_NAME == 'MONEY' || col.TYPE_NAME == 'NUMBER') {
            col.TYPE_NAME = 'NUMERIC'
        }
        else if (col.TYPE_NAME == 'DATETIME') {
            col.TYPE_NAME = 'TIMESTAMP'
        }
        else if (col.TYPE_NAME == 'CHECKBOX') {
            col.TYPE_NAME = 'INT2'
            col.COLUMN_DEF = '0'
        }
        else if (/^BOOL/.test (col.TYPE_NAME)) {
        	if (col.COLUMN_DEF == '1') col.COLUMN_DEF = 'true'
        	if (col.COLUMN_DEF == '0') col.COLUMN_DEF = 'false'
        }
        
        if (col.TYPE_NAME == 'NUMERIC') {
            if (!col.COLUMN_SIZE) col.COLUMN_SIZE = 10
            if (col.DECIMAL_DIGITS == undefined) col.DECIMAL_DIGITS = 0
            for (let k of ['COLUMN_SIZE', 'DECIMAL_DIGITS']) col [k] = parseInt (col [k])
        }                
        
    }
    
    gen_sql_create_foreign_tables () {

        let result = []

        for (let {name, qname, label, db_link, columns} of Object.values (this.model.foreign_tables)) {
        
        	for (let [foreign_server, options] of Object.entries (db_link)) {

				result.push ({sql: `CREATE FOREIGN TABLE ${qname} (${Object.values (columns).map (col => col.name + ' ' + this.gen_sql_column_definition (col))}) SERVER ${foreign_server} OPTIONS (${Object.entries (options).map (i => `${i[0]} '${i[1]}'`)})`, params: []})

//				result.push ({sql: `COMMENT ON FOREIGN TABLE ${qname} IS ` + this.gen_sql_quoted_literal (label), params: []})

        	}
        	
        }
        
        return result

    }
    
    gen_sql_recreate_schemas () {
    
    	return Object.keys (this.model.schemas)
    		.map (i => `CREATE SCHEMA IF NOT EXISTS ${i}`)
    		.map (sql => ({sql}))
    
    }
    
    gen_sql_drop_proc () {
    
        let result = []

        const vars = function (o, t = '') {
            return !o ? '' : Object.entries (o).map (i => i [0] + ' ' + i [1] + t)
        }

        for (let type of ['function', 'procedure']) {
                
			for (let {name, returns, arg, language, options} of Object.values (this.model [type + 's'])) {

				let body = (() => {

					switch (language) {

						case 'plpgsql': switch (type) {
						
							case 'function'  : return /^\s*TABLE\b/.test (returns) ? 'BEGIN END;' : 'BEGIN RETURN NULL; END;'
							
							case 'procedure' : return 'BEGIN NULL; END;'
						
							default: throw new Error ('Unsupported procedure type: ' + type)

						}

						case 'sql': return 'SELECT NULL::' + returns

						default: throw new Error ('Unsupported language: ' + language)

					}
				
				}) ()
				
				if (returns) returns = 'RETURNS ' + returns				
				
				body = '$$' + body + '$$'
				
				result.push ({sql: [
					'DROP',
					type.toUpperCase (),
					'IF EXISTS',
					name,
					'(' + vars (arg) + ')',
					'CASCADE',
				].filter (i => i).join (' ')})
				
				result.push ({sql: [
					'CREATE',
					type.toUpperCase (),
					name,
					'(' + vars (arg) + ')',
					returns,
					'AS',
					body,
					'LANGUAGE',
					language,
					options,
				].filter (i => i).join (' ')})

			}
			
		}

        return result
    
    }
    
    gen_sql_create_proc () {

        let result = []

        const vars = function (o, t = '') {
            return !o ? '' : Object.entries (o).map (i => i [0] + ' ' + i [1] + t)
        }

        for (let type of ['function', 'procedure']) {
                
			for (let {name, returns, arg, declare, body, language, options} of Object.values (this.model [type + 's'])) {

				if (returns) returns = 'RETURNS ' + returns

				if (language == 'plpgsql') {

					body = `BEGIN ${body} END;`

					if (declare) body = 'DECLARE ' + vars (declare, ';').join ('') +  body

				}
				
				body = '$$' + body + '$$'
				
				result.push ({sql: [
					'CREATE OR REPLACE',
					type.toUpperCase (),
					name,
					'(' + vars (arg) + ')',
					returns,
					'AS',
					body,
					'LANGUAGE',
					language,
					options,
				].filter (i => i).join (' ')})

			}
			
		}

        return result

    }

    gen_sql_patch () {
            
        let patch = []; for (let i of [
        
            'recreate_schemas',

            'drop_foreign_keys',

            'update_partitioned_tables',
            'drop_foreign_tables',
            'create_foreign_tables',

            'drop_views',
            'drop_tables',
            'drop_proc',
            
            'recreate_tables',
            'add_tables',
            'comment_tables',
            
            'update_columns',
            
            'comment_columns',
            'update_keys',
            
            'after_add_tables',
            'create_views',

            'create_proc',
            'recreate_triggers',

            'upsert_data',

            'after_add_columns',

            'create_foreign_keys',

        ]) for (let j of this ['gen_sql_' + i] ()) patch.push (j)

        return patch
    
    }

}
