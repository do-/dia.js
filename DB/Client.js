const Dia = require ('../Dia.js')
const LogEvent = require ('../Log/Events/DB.js')
const WarningEvent = require ('../Log/Events/Warning.js')
const {Transform} = require ('stream')

module.exports = class {

    constructor (backend) {
        this.backend = backend
    }
    
    async release () {
    }

    query (def) {
        return new Dia.DB.Query (this.model, def)
    }
    
    zero_value (t) {

		if (t == 'UUID') return ZERO_UUID
		
    	if (/(CHAR|TEXT|STRING)$/.test (t)) return ''

    	if (/^(DATE|TIMES)/.test (t)) return '1970-01-01'

    	if (/INT|NUM|DEC|BOOL|FLO|MONEY/.test (t)) return 0

		return null
    
    }
    
    not_nuller (table) {
    
    	let def = this.model.relations [table]; if (!def) throw new Error ('Relation not found: ' + table)

		let {columns} = def; if (!columns) throw new Error ('Relation has no columns: ' + table)
        
    	let cols = []; for (let {name, TYPE_NAME, NULLABLE, COLUMN_DEF} of Object.values (columns)) if (!NULLABLE) {
    	
    		let value = COLUMN_DEF
    		
    		if (value == null) value = this.zero_value (TYPE_NAME.toUpperCase ())

    		if (value != null) cols.push ([name, value])
    	
    	}
			
		return new Transform ({objectMode: true, transform (r, encoding, callback) {

			for (let [name, value] of cols) 
			
				if (name in r && r [name] == null) 
				
					r [name] = value

			this.push (r)

			callback ()

		}})
    
    }

    async select_vocabulary (t, o = {}) {

        let def = this.model.relations [t]; if (!def) throw new Error (`No table nor view named "${t}" is found in model`)

        let {data, columns, pk} = def

        if (data && !Object.keys (o).length) return data
        
        o = {...this.model.voc_options, ...o}

        let sql = `SELECT ${pk}`;  if (pk != o.id_name) sql += ` AS ${o.id_name}`

        sql += `, ${o.label}`;     if (o.label != o.label_name) sql += ` AS ${o.label_name}`

		for (let col of o.columns) if (columns [col]) sql += `, ${col}`

		sql += ` FROM ${t}`

		if (o.filter) sql += ` WHERE ${o.filter}`

		sql += ` ORDER BY ${o.order}`

        return this.select_all (sql)

    }

    async add_vocabularies (data, def) {
    
    	let keys = [], values = [], {relations} = this.model

        for (let [k, o] of Object.entries (def)) {

            if (!(o instanceof Object)) o = {}

            if (o.off) continue; delete o.off

            let t = o.name || k; delete o.name

            let rel = relations [t]; if (!rel) throw new Error (`No table nor view named "${t}" is found in model`)
            
            if ('data' in rel && Object.keys (o).length == 0) {

				data [k] = rel.data
            
            } 
            else {

            	keys.push (k)

            	values.push (this.select_vocabulary (t, o))
            	
            }
        
        }
        
        let {length} = keys; if (!length) return data
        
        values = await Promise.all (values)
        
        for (let i = 0; i < length; i ++) data [keys [i]] = values [i]

        return data

    }
    
    to_counting_sql (original_sql) {
        
        let [unordered_sql, order] = original_sql.split (/ORDER\s+BY/)
        
        if (!order) throw 'to_counting_sql received some sql without ORDER BY: ' + original_sql
            
        return 'SELECT COUNT(*) ' + unordered_sql.substr (unordered_sql.indexOf ('FROM'))
    
    }

    async select_all_cnt (original_sql, original_params, limit, offset = 0) {
    
        let [limited_sql, limited_params] = this.to_limited_sql_params (original_sql, original_params, limit, offset)

        return Promise.all ([
            this.select_all (limited_sql, limited_params),
            this.select_scalar (this.to_counting_sql (original_sql), original_params),
        ])
    
    }
    
    async select_hash (original_sql, original_params = []) {
    	let [sql, params] = this.to_limited_sql_params (original_sql, original_params, 1, 0)
        let [r] = await this.select_all (sql, params)
        return r ? r : {}
    }

    async select_scalar (sql, params = []) {
        let r = await this.select_hash (sql, params)
        for (let k in r) return r [k]
        return null
    }

    async add_all_cnt (data, def, limit, offset) {

        let q = this.query (def)        
        if (limit == undefined) limit = q.limit
        if (limit == undefined) throw 'LIMIT not set for add_all_cnt: ' + JSON.stringify (def)

        if (offset == undefined) offset = q.offset
        if (offset == undefined) offset = 0
        
        let [limited_sql, limited_params] = this.to_limited_sql_params (q.sql, q.params, limit, offset)
        let [all, cnt] = await Promise.all ([
        	this.select_all    (limited_sql, limited_params),
            this.select_scalar (q.sql_cnt, q.params_cnt),
        ])

        data [q.parts [0].alias] = all
        data.cnt = cnt
        data.portion = limit
// TODO: avoid hardcoded names
        return data

    }

    async add (data, def) {
        let q = this.query (def)
        if (q.limit) throw 'LIMIT set, use add_all_cnt: ' + JSON.stringify (def)
        data [q.parts [0].alias] = await this.select_all (q.sql, q.params)
        return data
    }
    
    async list (def) {

        const q = this.query (def), {sql, params, limit, offset} = q
        
        if (limit == null) return this.select_all (sql, params)

		const [limited_sql, limited_params] = this.to_limited_sql_params (sql, params, limit, offset)

		return this.select_all (limited_sql, limited_params)

    }

    async fold (def, callback, data) {
        let q = this.query (def)
        await this.select_loop (q.sql, q.params, callback, data)
        return data
    }

    async select_col (sql, params) {
    
    	return this.select_loop (sql, params, (r, l) => {
    	
    		for (let k in r) {
    		
    			l.push (r [k])
    			
    			break
    		
    		}
    	
    	}, [])
    
    }

    async select_all (sql, params) {
    
    	return this.select_loop (sql, params, (r, l) => l.push (r), [])
    
    }
    
    async select_loop (sql, params, cb, data) {
    
    	let rs = await this.select_stream (sql, params)
        	
    	return new Promise ((ok, fail) => {rs
	    	.on ('error', x  => fail (x))
	    	.on ('end',   () => ok (data))
	    	.on ('data',  r  => {	    	
	    		try {
			    	cb (r, data)
	    		}
	    		catch (x) {
	    			rs.destroy (x)
	    		}
	    	})
    	})
    
    }
    
    async insert_if_absent (table, data) {
    
        try {
            await this.db.insert (table, data)
        }
        catch (x) {
            if (this.db.is_pk_violation (x)) return data
            throw x
        }    

    }
    
    async update (table, data, key, return_expr = '*') {

        let def = this.model.tables [table]
        if (!def) throw 'Table not found: ' + table

        if (Array.isArray (data)) {
            for (let d of data) await this.update (table, d, key)
            return
        }
        
        if (key == null) key = def.p_k
        if (!Array.isArray (key)) throw 'The key must be an array of field names, got ' + JSON.stringify (key)
        if (!key.length) throw 'Empty update key supplied for ' + table

        let [fields, filter, params] = [[], [], []]
        
        for (let k of key) {
            let v = data [k]
            if (v == undefined) throw 'No ' + k + ' supplied for ' + table + ': ' + JSON.stringify (data)
            filter.push (`${k}=?`)
            params.push (v)
            delete data [k]
        }

        for (let k in data) {
            let v = data [k]
            if (!(k in def.columns) || typeof v === 'undefined') continue
            if (v === null) {
				let {NULLABLE, COLUMN_DEF} = def.columns [k]
				if (!NULLABLE && COLUMN_DEF) v = COLUMN_DEF
            }
            fields.unshift (`${k}=?`)
            params.unshift (v)
        }
        
        if (!fields.length) return new Promise ((ok, fail) => ok (darn ('Nothig to update in ' + table + ', only key fields supplied: '  + JSON.stringify ([filter, params]))))

        return this.do (`UPDATE ${table} SET ${fields} WHERE ${filter.join (' AND ')} RETURNING ${return_expr}`, params)

    }

    async delete (table, data) {
    
		let {sql, params} = this.query ({[table]: data})
		
		if (params.length == 0) throw 'DELETE without a filter? If sure, use this.db.do directly.'
		
		sql = 'DELETE ' + sql.slice (sql.indexOf ('FROM'))
		
		return this.do (sql, params)
		
    }    
    
    async delepsert (table, data, items, key) {

    	let todo = []

    	let del = clone (data)

    	if (items.length > 0) {

	        let def = this.model.tables [table]
	        
	        if (!key) {
	        
	        	let fields = def.p_k.filter (k => !(k in data))

	        	if (fields.length != 1) throw `Can't guess the distinction key for ${table} ${JSON.stringify (data)}`
	        	
	        	key = fields [0]
	        	
	        }

			del [key + ' NOT IN'] = items.map (i => i [key])

	        let u_k = [key]; for (let k in data) u_k.push (k)

	        todo.push (this.upsert (table, items.map (i => Object.assign ({}, i, data)), u_k))

    	}

    	todo.push (this.delete (table, del))

    	return Promise.all (todo)

    }

    async load_schema () {
    
        await this.load_schema_tables ()
        await this.load_schema_table_columns ()
        await this.load_schema_table_keys ()
        await this.load_schema_table_triggers ()
        await this.load_schema_table_data ()
        await this.load_schema_foreign_keys ()
        await this.load_schema_proc ()

    }
    
    async load_schema_foreign_keys () {
    }

    async load_schema_proc () {
    }

    async load_schema_table_data () {

    	for (let table of Object.values (this.model.tables)) {

    		let {data} = table

    		if (!data || !data.length) continue

    		let idx = {}, f = {}, {p_k} = table, pk = r => p_k.map (k => '' + r [k]).join (' ')
    		
    		for (let r of Object.values (table.data)) {

    			for (let k in r) if (!(k in f)) f [k] = 1
    		
    			idx [pk (r)] = clone (r)
    			
    		}
    		
    		let {existing} = table; if (existing) {
    		
    			let cols = Object.keys (f).filter (n => existing.columns [n]); if (cols.length) {

					let ids = Object.keys (idx)
					
					let list = await this.select_all (`SELECT ${cols} FROM ${table.name} WHERE ${p_k.length == 1 ? table.pk : `CONCAT (${p_k.join (",' ',")})`} IN (${ids.map (i => '?')})`, ids)

					main: for (let r of list) {

						let id = pk (r), d = idx [id]; if (!d) continue main

						for (let k in d) if (!p_k.includes (k) && '' + r [k] != '' + d [k]) continue main

						delete idx [id]
						
					}

    			}    			
    			
    		}
    		
			table._data_modified = Object.values (idx)

    	}

    }    
    
    async load_schema_tables () {}
    
    async load_schema_table_columns () {}
    
    async load_schema_table_keys () {}
    
    async load_schema_table_triggers () {}

    log_write (e) {

    	this.model.conf.log_event (e)

    	return e
    
    }

    log_finish (e) {
        	
		e.level = 'info'
		return this.log_write (e.finish ())

    }
    
    log_start (sql, params) {

    	return this.log_write (new LogEvent ({
    		...(this.log_meta || {}),
			phase: 'before',
			sql,
			params,
    	}))

    }
    
    warn (label, o = {}) {

    	return this.log_write (new WarningEvent ({
    		...(this.log_meta || {}),
			label,
			...o
    	}))

    }
    
    async finish_txn (success) {
    
        if (success) {
            await this.commit ()
        }
        else {
        	this.warn ('Rolling back uncommitted transaction')
            await this.rollback ()
        }

    }

}