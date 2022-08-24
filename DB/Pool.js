const LogEvent = require ('../Log/Events/Text.js')
const Queue = require ('../Queue.js')

module.exports = class {

    constructor (o) {

        this.options = o

		this._timers = {}
		
		this.log_category = o.log_category || 'db'

    }
    
    log_info (label) {

    	let log_event = this.log_write (new LogEvent ({
			category: this.log_category,
			label
		}))

    }
    
    async init_queue (relation, o) {

    	let {model, _timers} = this, {conf} = model, {name, label, queue, columns} = relation

    	for (let k of ['label']) if (!queue [k]) queue [k] = relation [k]
    	
    	if (!queue.name && !queue.type) queue.name = name
    	
    	let is_empty = async () => this.do_with_db ({
    		label: `Checking if ${name} is empty`,
    		f: async db => {
    			let l = await db.list ({[name]: {LIMIT: 1}})
    			return l.length == 0
    		}
    	})
    	
    	let options = {conf, is_empty, ...o, ...queue}
    	    	
    	if ('ORDER' in queue || 'LIMIT' in queue) {

    		let {ORDER, LIMIT} = queue; if (!ORDER) throw new Error ('Invalid ORDER value for queue' + queue.name + ': ' + ORDER)
    		
    		let order_first_name = ORDER.trim ().split (/\s/) [0].toLowerCase ()
    		
			let order_first = columns [order_first_name]; if (!order_first) throw new Error ("Didn't found the definition of the queue ORDER column " + order_first_name)
			
			if (order_first.TYPE_NAME == 'TIMESTAMP') options.ts_scheduled_field = order_first_name

    		if (!('LIMIT' in queue)) LIMIT = 1
    	
    		queue.LIMIT = LIMIT = parseInt (LIMIT)
    	
    		if (!(LIMIT > 0)) throw new Error ('Invalid LIMIT value for queue' + queue.name + ': ' + LIMIT)
    		
			options.fetch = async () => this.do_with_db ({
				label: `Fetching ${LIMIT} queued task${LIMIT > 1 ? 's' : ''} from ${name}`,
				f: async db => {
					let l = await db.list ({[name]: {ORDER, LIMIT}})
					return l
				}
			})

    	}
    	
    	let q = new Queue (options)
    	
    	await q.init ()
    	
    	let {timer} = q; _timers [timer.name] = timer
		
		return q
		
    }
    
    async init_queues (o = {}) {

		await Promise.all (
		
			Object.values (this.model.relations)
			
				.filter (r => r.queue)
				
					.map (r => this.init_queue (r, o))

		)

    }

    async update_model (o = {}) {

    	let patch = this.gen_sql_patch (o)
    	
    	if (!patch.length) return
    	
        return this.run (patch, o)
        
    }
    
    inject (c, o) {
    
    	c.log_meta = {
    		...(o.log_meta || {}),
    		category: this.log_category,
    	},

        c.model = this.model

        c.pool = this

        return c

    }
    
    log_write (e) {

    	this.model.conf.log_event (e)

    	return e
    
    }

    async do_with_db (o) {
    
    	let {f, label} = o
    
    	let {log_meta} = this; if (!log_meta) log_meta = {}
    
		this.log_event = this.log_write (new LogEvent ({
    		...log_meta,
			category: this.log_category,
			label,
			phase: 'before',
    	}))

        try {
        	let {conf} = this.model
            var db = await this.acquire ({
            	conf,
            	log_meta: {...log_meta, parent: this.log_event},
            })
            return await f.call (this, db)
        }
        finally {
            this.release (db)
            this.log_write (this.log_event.finish ())
        }
        
    }    
    
    is_not_to_merge (i) {

    	let {params} = i; if (params && params.length) return true

    	return false

    }
    
    merge_sql (list) {
    
    	let short_list = [], sql = '', flush = (i) => {

    		if (sql) short_list.push ({sql})
    		
    		if (i)   short_list.push (i)
    		
    		sql = ''

    	}
    	
    	for (let i of list) {
    		
    		if (this.is_not_to_merge (i)) {
    		
    			flush (i)
    		
    		} 
    		else {
    		
    			if (sql) sql += ';'
    		
    			sql += i.sql
    		
    		}
    		
    	}
    	
    	flush ()

    	return short_list

    }    

    async run (list, o = {}) {

    	return this.do_with_db ({
			label : 'Running batch',
			f     : async db => {for (let {sql, params} of list) await db.do (sql, params)} 
    	})

    }

    async select_version () {
        return {}
    }

    async load_schema () {

        await this.do_with_db ({
            label : `Checking ${this.product} version`,
            f     : async db => {
                this.version = await this.select_version (db)
                this.log_write (new LogEvent ({
                    category: this.log_category,
                    label: `${this.product} version is ${JSON.stringify (this.version)}`,
                    parent: this.log_event,
                }))
            }
        })
        
        const {model} = this
        
        model.resolve_column_references ()

    	await model.pending ()
    	
		this.normalize_model ()

    	return this.do_with_db ({
			label : 'Loading schema',
			f     : db => db.load_schema ()
    	})

	}

    gen_sql_patch () {
    
        let patch = []
            .concat (this.gen_sql_recreate_foreign_tables ())
            .concat (this.gen_sql_recreate_tables ())
            .concat (this.gen_sql_add_tables ())
            .concat (this.gen_sql_comment_tables ())
            .concat (this.gen_sql_add_columns ())
            .concat (this.gen_sql_alter_columns ())
            .concat (this.gen_sql_set_default_columns ())
            .concat (this.gen_sql_comment_columns ())
            .concat (this.gen_sql_update_keys ())
            .concat (this.gen_sql_update_triggers ())
            .concat (this.gen_sql_after_add_tables ())
            .concat (this.gen_sql_upsert_data ())
            .concat (this.gen_sql_recreate_views ())
            .concat (this.gen_sql_create_foreign_keys ())
            .concat (this.gen_sql_recreate_proc ())
            
        let m = this.model
        let [t, v] = [m.tables, m.views]
        for (let k in v) t [k] = v [k]

        return patch
    
    }
    
    quote_name (s) {
        return s
    }

    gen_sql_quoted_literal (s) {
        if (s == null) return 'NULL'
        return "'" + String (s).replace (/'/g, "''") + "'"
    }

    normalize_model () {

    	let {model} = this; if (model._is_normalized) return; model._is_normalized = 1

    	model.relations = {}

    	for (let type of model.relation_types) for (let r of Object.values (model [type])) model.relations [r.name] = r

        for (let r of Object.values (model.relations)) this.normalize_model_table (r)

        for (let d of Object.values (model.table_drops)) this.normalize_model_table_name (d)

        for (let d of Object.values (model.view_drops)) this.normalize_model_table_name (d)


    }

	normalize_model_table_name (table) {
		table.qname = this.quote_name (table.name)
	}
    
    normalize_model_table (table) {
    
    	if (!('p_k' in table)) {

    		const {pk} = table

			table.p_k = pk == null ? [] : Array.isArray (pk) ? pk : [pk]
    	
    	}
    	
	    this.normalize_model_table_name (table)
        if (table.columns)  for (let col of Object.values (table.columns)) this.normalize_model_table_column (table, col)
        if (table.keys)     for (let k in table.keys)     this.normalize_model_table_key     (table, k)
        if (table.triggers) for (let k in table.triggers) this.normalize_model_table_trigger (table, k)
    }
    
    normalize_model_table_column (table, col) {
    
		if (typeof col !== 'object') return

        col.TYPE_NAME_ORIGINAL = col.TYPE_NAME
if (!col.TYPE_NAME) darn ({table, col})
        col.TYPE_NAME = col.TYPE_NAME.toUpperCase ()

        if (col.NULLABLE == undefined) col.NULLABLE   =        (col.COLUMN_DEF == null)
        if (col.COLUMN_DEF != null)    col.COLUMN_DEF = String (col.COLUMN_DEF)
        
    }    

    gen_sql_after_add_tables () {

        let result = []

        for (let table of Object.values (this.model.tables)) {
        
			if (table._is_just_added) {

				let a = table.on_after_add_table

				if (a) {
					if (typeof a === 'function') a = a.call (table, table)
					if (a == null) a = []
					if (!Array.isArray (a)) a = [a]
					for (let i of a) result.push (i)
				}

				let data = table.init_data; if (data) table._data_modified = table.data = data

			}
			else {
				delete table.init_data
			}

        }

        return result

    }
    
    gen_sql_create_foreign_keys () {
    
    	return []
    
    }

    gen_sql_recreate_proc () {
    
    	return []
    
    }
    
    gen_sql_recreate_foreign_tables () {

    	return []

    }
    
    gen_sql_recreate_tables () {

    	return []

    }

    gen_sql_add_tables () {

    	return []

    }

    gen_sql_comment_tables () {

    	return []

    }

    gen_sql_add_columns () {

    	return []

    }
    
    gen_sql_alter_columns () {

    	return []

    }
    
	gen_sql_set_default_columns () {

    	return []

    }

	gen_sql_comment_columns () {

    	return []

    }
    
	gen_sql_update_keys () {

    	return []

    }
    
    gen_sql_update_triggers () {

    	return []

    }
    
    gen_sql_upsert_data () {

    	return []

    }
	
}
