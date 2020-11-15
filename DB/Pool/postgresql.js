const {Pool} = require ('pg')
const wrapper = require ('../Client/postgresql.js')
const crypto  = require ('crypto')

module.exports = class extends require ('../Pool.js') {

    constructor (o) {
        super (o)
        this.backend = new Pool (o)
    }
    
    async listen (o) {

		let db = new (require ('pg')).Client (this.options.connectionString)		
		
		db.connect ()
		
		if (o.timers) for (let name in o.timers) {
		
			let key = 'timer_' + name
		
			let hash = crypto.createHash ('sha256')
			
			hash.update (key)
			
			let digest = hash.digest ('hex').slice (0, 16)
			
			darn (`Trying to aquire cluster wide lock for ${key} (${digest})...`)
			
			let sql = `SELECT pg_try_advisory_lock (x'${digest}'::int8) AS ok`
			
			darn (sql)			

			let rs = await db.query (sql)
			
			if (rs && rs.rows && rs.rows.length == 1 && rs.rows [0].ok) {
			
				darn (`... lock for ${key} (${digest}) acquired.`)
			
			}
			else {
						
				darn (rs)
				
				throw new Error (`... can't acquire lock for ${key} (${digest}), bailing out.`)
			
			}
			
		}
		
		let sql = 'LISTEN ' + o.name
		
		db.query (sql)
		
		db.on ('notification', async e => {

			try {

				let {payload} = e; if (payload.charAt (0) != '{') {

					if (o.timers) {

						let timer = o.timers [payload]; if (timer) {
						
							darn (sql + ': ' + payload + ' -> ' + timer.uuid)

							timer.on ()

						}

					}				

				}
				else {

					await new Promise ((ok, fail) => {

						let h = new o.handler (Object.assign ({rq: JSON.parse (payload)}, o.params), ok, fail)

						darn (sql + ': ' + payload + ' -> ' + h.uuid)

						h.run ()

					})

				}
			
			}
			catch (x) {

				darn (x)

			}

		})

		darn ('Listening for PostgreSQL notifications on ' + o.name)

    }    
    
    async acquire () {  // darn (`${this.backend.totalCount} ${this.backend.idleCount} ${this.backend.waitingCount}`)
        let raw = await this.backend.connect ()
        let c = new wrapper (raw)
        
/*    
        if (this.backend.is_txn_pending) {
            darn ('[WARNING] Got a dirty connection, rolling back uncommitted transaction')            
            (async () => {await this.rollback ()}) ()
        }
*/
        c.model = this.model
        return c
    }

    async release (client) {
        return await client.release ()
    }

    quote_name (s) {
        return '"' + String (s).replace (/"/g, '""') + '"'
    }

    gen_sql_quoted_literal (s) {
        if (s == null) s = ''
        return "'" + String (s).replace (/'/g, "''") + "'"
    }
    
    gen_sql_column_definition (col) {
    
        let sql = col.TYPE_NAME
        
        if (col.COLUMN_SIZE > 0) {
            sql += '(' + col.COLUMN_SIZE
            if (col.DECIMAL_DIGITS) sql += ',' + col.DECIMAL_DIGITS
            sql += ')'
        }
        
        let def = col.COLUMN_DEF
        if (def != undefined) {
            if (def.indexOf (')') < 0) def = this.gen_sql_quoted_literal (def)
            sql += ' DEFAULT ' + def
        }
        
        if (col.NULLABLE === false) sql += ' NOT NULL'
        
        return sql

    }
    
    gen_sql_add_table (table) {
    
        let p_k = table.p_k
		let col = table.columns

        return {
            sql: `CREATE TABLE ${table.qname} (${p_k.map (k => k + ' ' + this.gen_sql_column_definition (col [k]))}, PRIMARY KEY (${p_k}))`,
            params: []
        }

    }
    
    gen_sql_drop_partitioned_tables () {

    	let {partitioned_tables} = this.model; if (!partitioned_tables) return []
    	
    	let qnames = Object.values (partitioned_tables).map (v => v.qname); if (!qnames.length) return []
    	
    	return [{sql: `DROP TABLE IF EXISTS ${qnames} CASCADE`}]

    }

    gen_sql_create_partitioned_tables () {
    
    	let result = []
    
    	for (let {qname, columns, partition} of Object.values (this.model.partitioned_tables)) {
    	
    		result.push ({sql: `CREATE TABLE ${qname} (${Object.values (columns).map (col => col.name + ' ' + this.gen_sql_column_definition (col))}) PARTITION BY ${partition.by}`})
    		
    		for (let {name, filter} of partition.list) result.push ({sql: `ALTER TABLE ${qname} ATTACH PARTITION ${name} FOR VALUES ${filter}`})

    	}

    	return result

    }
    
    gen_sql_drop_foreign_tables () {
    
    	let {foreign_tables} = this.model; if (!foreign_tables) return []
    	
    	let qnames = Object.values (foreign_tables).map (v => v.qname); if (!qnames.length) return []
    	
    	return [{sql: `DROP FOREIGN TABLE IF EXISTS ${qnames} CASCADE`}]

    }

    gen_sql_drop_views () {
    
    	let {views} = this.model; if (!views) return []
    	
    	let qnames = Object.values (views).map (v => v.qname); if (!qnames.length) return []
    	
    	return [{sql: `DROP VIEW IF EXISTS ${qnames} CASCADE`}]

    }
    
    gen_sql_create_views () {

        let result = [], {views} = this.model

        for (let name in views) {

        	let view = views [name]; view.depends = {}

        	for (let word of view.sql.split (/\b/))

        		if (views [word])

        			view.depends [word] = 1

        }

        let names = [], idx = {}, assert = name => {
        
        	if (idx [name]) return
        
        	for (let k in views [name].depends) assert (k)
        	
        	idx [name] = names.push (name)

        }
        
        for (let name in views) assert (name)
        
        for (let name of names) {

        	let {qname, sql} = views [name]
        
        	result.push ({sql: `CREATE VIEW ${qname} AS ${sql}`})
        	
        }

		return result

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
        
        for (let table of Object.values (this.model.tables)) {
        
            let data = table._data_modified
            
            if (!data || !data.length) continue
            
            for (let record of data) {
            
                let [f, s, v] = [[], [], []]
                            
                for (let k in record) {
                
                    f.push (k)
                    v.push (record [k])

                    if (!table.p_k.includes (k)) s.push (`${k}=EXCLUDED.${k}`)

                }
                
                let something = s.length ? 'UPDATE SET ' + s : 'NOTHING'
                            
                result.push ({sql: `INSERT INTO ${table.qname} (${f}) VALUES (?${',?'.repeat (f.length - 1)}) ON CONFLICT (${table.pk}) DO ${something}`, params: v})

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
            
            if (!table.existing) continue

            if ('' + table.p_k == '' + table.existing.p_k) continue
            
            let on = table.on_before_recreate_table; if (on) {
            	
            	if (typeof on === 'function') on = on (table)
            	
            	if (on == null) on = []
            	
            	if (!Array.isArray (on)) on = [on]
            	
            	result.push (...on)

            }
            
            delete table.model

            let tmp_table = clone (table)
            
            for (let t of [table, tmp_table]) t.model = this.model
            
            tmp_table.name = 't_' + String (Math.random ()).replace (/\D/g, '_')
            tmp_table.qname = this.quote_name (tmp_table.name)

            result.push (this.gen_sql_add_table (tmp_table))
            
            let cols = []

            for (let col of Object.values (tmp_table.columns)) {

                let col_name = col.name

                if (!table.existing.columns [col_name]) continue

                cols.push (col_name)

                if (tmp_table.p_k.includes (col_name)) continue

                delete col.COLUMN_DEF
                delete table.existing.columns [col_name].COLUMN_DEF

                result.push (this.gen_sql_add_column (tmp_table, col))

            }

            result.push ({sql: `INSERT INTO ${tmp_table.qname} (${cols}) SELECT ${cols} FROM ${table.name}`, params: []})

			if (tmp_table.p_k.length == 1) {
				
				let TYPE_NAME = tmp_table.columns [tmp_table.pk].TYPE_NAME

				for (let ref_table_name in this.model.tables) {

					let ref_table = ref_table_name == table.name ? tmp_table : this.model.tables [ref_table_name]

					for (let col of Object.values (ref_table.columns)) {

						if (col.ref != table.name) continue

						let tmp_col = {TYPE_NAME, ref: tmp_table, name: 'c_' + String (Math.random ()).replace (/\D/g, '_')}

						result.push (this.gen_sql_add_column (ref_table, tmp_col))
						result.push ({sql: `UPDATE ${ref_table.qname} r SET ${tmp_col.name} = (SELECT ${tmp_table.pk} FROM ${table.name} v WHERE v.${table.existing.pk}=r.${col.name})`, params: []})
						result.push ({sql: `ALTER TABLE ${ref_table.qname} DROP COLUMN ${col.name}`, params: []})
						result.push ({sql: `ALTER TABLE ${ref_table.qname} RENAME ${tmp_col.name} TO ${col.name}`, params: []})

						ref_table.columns [col.name].TYPE_NAME = TYPE_NAME

					}

				}
				
			}

            result.push ({sql: `DROP TABLE ${table.qname}`, params: []})
            result.push ({sql: `ALTER TABLE ${tmp_table.qname} RENAME TO ${table.qname}`, params: []})
            
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
    
    gen_sql_alter_columns () {

        let result = []

        for (let table of Object.values (this.model.tables)) {

            let existing_columns = table.existing.columns

            for (let col of Object.values (table.columns)) {
            
            	let {name} = col, ex_col = existing_columns [name]; 
            	
            	if (!ex_col || !this.is_column_to_alter (ex_col, col)) continue
            
				if (ex_col.COLUMN_DEF) {
					result.push ({sql: `ALTER TABLE ${table.qname} ALTER COLUMN "${col.name}" DROP DEFAULT`, params: []})
					delete ex_col.COLUMN_DEF
				}
				
				result.push ({sql: `ALTER TABLE ${table.qname} ALTER "${col.name}" TYPE ` + this.gen_sql_column_definition (col).split (' DEFAULT') [0], params: []})

		    	for (let k of ['TYPE_NAME', 'COLUMN_SIZE', 'DECIMAL_DIGITS']) ex_col [k] = col [k]
            
            }

        }
        
        return result
        
    }
    
    gen_sql_add_columns () {
    
        let result = []
        
        for (let table of Object.values (this.model.tables)) {
        
            let existing_columns = table.existing.columns

            let after = table.on_after_add_column

            for (let col of Object.values (table.columns)) {

            	let {name} = col
            	
            	if (table.p_k.includes (name)) continue
            	
            	if (name in existing_columns) {
            	
            		if (after && name in after) darn (`[SCHEMA WARNING] REDUNDANT on_after_add_column: ${table.name}.${name}`)
            	
            		continue
            		
            	}

                result.push (this.gen_sql_add_column (table, col))
                                
                if (!table._is_just_added && after) {
                    let a = after [name]
                    if (a) for (let i of a) result.push (i)
                }                

                existing_columns [name] = clone (col)
                
                delete existing_columns [name].REMARK

            }

        }
    
        return result
    
    }
    
    gen_sql_drop_foreign_keys () {

        let result = []

        for (let table of Object.values (this.model.tables)) {
        
        	let {existing} = table; if (!existing) continue

        	let {columns} = existing; if (!columns) continue
        	
        	let actions = Object.values (columns).map (i => i.ref_name).filter (i => i).map (i => `DROP CONSTRAINT IF EXISTS ${i} CASCADE`)
        	
        	if (actions.length) result.push ({sql: `ALTER TABLE ${table.qname} ${actions}`})
        
        }

		return result
        
    }
    
    gen_sql_create_foreign_keys () {
    
        let result = [], {model} = this, {tables} = model

        for (let table of Object.values (tables)) {
        	
        	let actions = []; for (let column of Object.values (table.columns)) {
        	
        		let {name, ref} = column; if (!ref) continue
        		
        		let rt = tables [ref]; if (rt) {
        		
        			actions.push (`ADD FOREIGN KEY (${name}) REFERENCES ${tables [ref].qname} NOT VALID`)
        		
        		} 
        		else {
        		
        			if (!model.relations [ref]) darn (`WARNING! ${table.name}.${name} references non existing ${ref}!`)

        		}

        	} 

        	if (actions.length) result.push ({sql: `ALTER TABLE ${table.qname} ${actions}`})

		}

        return result
    
    }

    gen_sql_set_default_columns () {

        let result = []

        for (let table of Object.values (this.model.tables)) {

            let existing_columns = table.existing.columns

            for (let col of Object.values (table.columns)) {

                if (table.p_k.includes (col.name)) continue

                if (col.TYPE_NAME == 'SERIAL') continue

                let d = col.COLUMN_DEF

                if (d != existing_columns [col.name].COLUMN_DEF) {
                
                    if (d == null) {

                        result.push ({sql: `ALTER TABLE ${table.qname} ALTER COLUMN "${col.name}" DROP DEFAULT`, params: []})

                    }
                    else {

                		let [v, params] = d.indexOf ('(') < 0 ? ['?', [d]] : [d, []]

                        result.push ({sql: `UPDATE "${table.name}" SET "${col.name}" = ${v} WHERE "${col.name}" IS NULL`, params})

                        if (d.indexOf (')') < 0) d = this.gen_sql_quoted_literal (d)

                        result.push ({sql: `ALTER TABLE ${table.qname} ALTER COLUMN "${col.name}" SET DEFAULT ${d}`, params: []})

                    }
                
                }
                
                let n = col.NULLABLE; if (n != existing_columns [col.name].NULLABLE) {

                    result.push ({sql: `ALTER TABLE ${table.qname} ALTER COLUMN "${col.name}" ${n ? 'DROP' : 'SET'} NOT NULL`, params: []})

                }

            }

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
        
        for (let table of Object.values (this.model.tables)) {
        
            let {triggers} = table; if (!triggers) continue
                    
            for (let name in triggers) {
            
                let src = triggers [name]
                
                let [phase, ...events] = name.toUpperCase ().split ('_')
                
                let glob = `on_${name}_${table.name}`
                
                result.push ({sql: `DROP TRIGGER IF EXISTS ${glob} ON ${table.qname}`})
                
                if (!src) continue

                result.push ({sql: `

                    CREATE OR REPLACE FUNCTION ${glob}() RETURNS trigger AS \$${glob}\$

                        ${src}

                    \$${glob}\$ LANGUAGE plpgsql;

                `})

                result.push ({sql: `

                    CREATE TRIGGER 
                        ${glob}
                    ${phase} ${events.join (' OR ')} ON 
                        ${table.name}
                    FOR EACH ROW EXECUTE PROCEDURE 
                        ${glob} ();

                `})

            }
        
        }
        
        return result

    }
    
    normalize_model_table_key (table, k) {

        let glob = `ix_${table.name}_${k}`

        let src = table.keys [k]

        if (src != null) {
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
        
        for (let table of Object.values (this.model.tables)) {
        
            let keys = table.keys

            if (!keys) continue
        
            let existing_keys = (table.existing || {keys: {}}).keys
            
            let before = table.on_before_create_index

			for (let name in keys) {
            
                let src = keys [name]
                
                let old_src = existing_keys [name]
                
                let original_name = name.split (table.name + '_') [1]
                
           		if (old_src && before && name in before) darn (`[SCHEMA WARNING] REDUNDANT on_before_create_index: ${table.name}.${original_name}`)
                
                function invariant (s) {
                    if (s == null) return ''
                    return s
                    	.replace (/B'/g, "'")
                    	.replace (/[\s\(\)]/g, '')
                    	.replace (/::\"\w+\"/g, '')
                    	.toLowerCase ()
                }
                
                if (invariant (src) == invariant (old_src)) continue

                if (old_src) {
					darn (`[SCHEMA WARNING] INDEX REDEFINED: ${name} (see below)`)
					darn ([table.name + '.' + original_name, old_src, src])
                }

                if (old_src) {
                	result.push ({sql: `DROP INDEX IF EXISTS ${name};`, params: []})
                }
                else if (before) {
                    let b = before [name]
                    if (b) for (let i of b) result.push (i)
                }
                
                if (src != null) {
                
                	result.push ({sql: src, params: []})

                	let [, cols] = src.split (/[\(\)]/)

                    cols = cols.split (/,\s*/)
                        .map (c =>  c.match(/^(\w+)/) [0] )
                        .join (', ')

                	result.push ({sql: `VACUUM ANALYZE ${table.name} (${cols})`, params: []})

                }

            }

        }

        return result

    }

    normalize_model_table_trigger (table, k) {

        let src = table.triggers [k].replace (/\s+/g, ' ').trim ()

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
			
				darn (`trg_check_column_value: column ${table.name}.${name} not found`)
			
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

    trg_check_column_value_min_date (col, table) {return `
		IF NEW.${col.name} IS NOT NULL AND NEW.${col.name} < '${col.MIN}' THEN
			RAISE '#${col.name}#: ${table.model.trg_check_column_value_min_date (col, table)}';
		END IF;
    `}

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
    	
        for (let type of ['function', 'procedure']) {
        
        	for (let i of Object.values (this.model [type + 's'])) {
        	
        		if (!i.language) i.language = 'plpgsql'
        		
        		if (!i.options)  i.options = ''
        	
        	}
                			
		}

    }
    
    normalize_model_table_column (table, col) {
        
        super.normalize_model_table_column (table, col) 

        if (col.ref && col.TYPE_NAME === 'SERIAL') {
            col.TYPE_NAME = 'INT'
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
    
    gen_sql_recreate_proc () {

        let result = []
        
        for (let type of ['function', 'procedure']) {
                
			for (let {name, returns, arg, declare, body, label, existing, language, options} of Object.values (this.model [type + 's'])) {

				function vars (o, t = '') {return !o ? '' : Object.entries (o).map (i => i [0] + ' ' + i [1] + t)}
				
				if (returns) returns = 'RETURNS ' + returns

				if (language = 'plpgsql') {

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
        
            'drop_foreign_keys',

            'drop_views',
            'drop_foreign_tables',
            'drop_partitioned_tables',
            
            'recreate_tables',
            'add_tables',
            'comment_tables',
            'add_columns',
            'alter_columns',
            'set_default_columns',
            'comment_columns',
            'update_keys',
            
            'after_add_tables',
            'upsert_data',

            'create_partitioned_tables',
            'create_foreign_tables',
            'create_views',

            'recreate_proc',
            'recreate_triggers',

            'create_foreign_keys',

        ]) for (let j of this ['gen_sql_' + i] ()) patch.push (j)

        return patch
    
    }

}