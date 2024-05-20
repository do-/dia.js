const wrapper = require ('../Client/clickhouse.js')
const HTTP = require ('../../HTTP.js')
const HTTPLogEvent = require ('../../Log/Events/HTTP/clickhouse.js')

module.exports = class extends require ('../Pool.js') {

    constructor (o) {
    
        super (o)
        	
		let [url, auth] = o.connectionString.slice ('clickhouse://'.length).split ('@').reverse ()
		
		let p = url.split ('/')
		
		this.database = p.pop ()
		
		p.push ('?database=' + this.database)

		if (p.length < 2 || p [1]) p.unshift ('http:/')

		url = p.join ('/')

    	this.factory = new HTTP ({url, auth, method: 'POST'})

    }

    async acquire (o = {}) {

    	const {conf, log_meta} = o
    	
    	log_meta.event_class = HTTPLogEvent

    	const agent = await this.factory.acquire ({conf, log_meta})
    	
    	const cn = this.inject (new wrapper (agent), o)

        return cn

    }

    async release (client) {
    }

    async run (list, o = {}) {

    	return this.do_with_db ({
    	
			label : 'Running batch',
			
			f     : async db => {

				db.set_session (o.session_id || 'batch', o.session_timeout || 3600)

				for (let {sql, params} of list) await db.do (sql, params)
				
			} 
			
    	})

    }

    async select_version (db) {
        let label = await db.select_scalar (`SELECT version()`)
        let [m, major, minor] = label.match (/^(\d+)\.(\d+)\b/i)
        major = +major
        minor = +minor
        return {
            major,
            minor,
            label,
        }
    }

    gen_sql_column_definition (col) {
    
        let sql = col.TYPE_NAME

        {
        
        	const {COLUMN_SIZE} = col; if (COLUMN_SIZE) {

	            sql += '(' + COLUMN_SIZE

	            const {DECIMAL_DIGITS} = col; if (DECIMAL_DIGITS) sql += ',' + DECIMAL_DIGITS

	            sql += ')'

        	}
        
        }
        
        const {NULLABLE} = col; if (NULLABLE) sql = 'Nullable(' + sql + ')'

        {

        	const {COLUMN_DEF} = col; if (COLUMN_DEF == null) {

        		if (NULLABLE) sql += ' DEFAULT NULL'

        	}
        	else {

	        	sql += ' DEFAULT '

	       		const def = String (COLUMN_DEF)

        		sql += def.indexOf (')') < 0 ? this.gen_sql_quoted_literal (def) : def

        	}
        	
        }

        return sql

    }
    
    normalize_model_table (table) {

    	super.normalize_model_table (table)

    	if (!table.engine) table.engine = 'MergeTree'

	}

    normalize_model_table_column (table, col) {
        
        super.normalize_model_table_column (table, col) 
                
        if (/INT|SERIAL/.test (col.TYPE_NAME)) {        
        	if (/Int/.test (col.TYPE_NAME_ORIGINAL)) {
        		col.TYPE_NAME = col.TYPE_NAME_ORIGINAL
        	}
        	else {
        		col.TYPE_NAME = 'Int32'
        	}
        }
        else if (/(BINARY|BLOB|CHAR|JSONB?|STRING|TEXT|XML)$/.test (col.TYPE_NAME)) {
            col.TYPE_NAME = 'String'
        }
        else if (col.TYPE_NAME == 'DECIMAL' || col.TYPE_NAME == 'MONEY' || col.TYPE_NAME == 'NUMBER' || col.TYPE_NAME == 'NUMERIC') {
            col.TYPE_NAME = 'Decimal'
        }
        else if (col.TYPE_NAME == 'DATE') {
            col.TYPE_NAME = 'Date'
        }
        else if (col.TYPE_NAME == 'TIME') {
            col.TYPE_NAME = 'String'
        }
        else if (col.TYPE_NAME == 'DATETIME' || col.TYPE_NAME == 'TIMESTAMP') {
            col.TYPE_NAME = 'DateTime'
        }
        else if (col.TYPE_NAME == 'CHECKBOX') {
            col.TYPE_NAME = 'UInt8'
            col.COLUMN_DEF = '0'
        }
        else if (col.TYPE_NAME == 'BIT' && col.COLUMN_SIZE == 1) {
            col.TYPE_NAME = 'UInt8'
            col.COLUMN_DEF = '0'
            delete col.COLUMN_SIZE
        }
        else if (/^BOOL/.test (col.TYPE_NAME)) {
            col.TYPE_NAME = 'UInt8'
        }
        
        if (/^U?Int/.test (col.TYPE_NAME) && col.COLUMN_DEF) {

        	switch (String (col.COLUMN_DEF).toLowerCase ()) {

        		case 'true':
        			col.COLUMN_DEF = '1'
        			break

        		case 'false':
        			col.COLUMN_DEF = '0'
        			break

        	}
        
        }

        if (col.TYPE_NAME == 'Decimal') {
            if (!col.COLUMN_SIZE) col.COLUMN_SIZE = 10
            if (col.DECIMAL_DIGITS == undefined) col.DECIMAL_DIGITS = 0
        }                
        
        if (col.TYPE_NAME == 'String') {
            delete col.COLUMN_SIZE
        }

		{

			const m = /^\s*uuid_generate_v(\d+)/i.exec (col.COLUMN_DEF)

			if (m) col.COLUMN_DEF = m [1] == 4 ? 'generateUUIDv4()' : null

		}
        
        if (table.p_k.includes (col.name)) col.NULLABLE = false

    }

    gen_sql_recreate_tables () {
    
		const result = [], {model} = this

        for (const type of ['tables', 'partitioned_tables']) for (const table of Object.values (model [type])) {

            const {existing} = table; if (!existing) continue

            if (table.engine == existing.engine) {

            	if (table.engine.slice (-9) != 'MergeTree' || '' + table.p_k == '' + existing.p_k) continue

            }

            let on = table.on_before_recreate_table; if (on) {
            	
            	if (typeof on === 'function') on = on (table)
            	
            	if (on == null) on = []
            	
            	if (!Array.isArray (on)) on = [on]
            	
            	result.push (...on)

            }
            
            delete table.model            

            let tmp_table = clone (table)
            
			for (const сol_name in table.columns) tmp_table.columns [сol_name] = clone (table.columns [сol_name])

            if (existing.p_k) for (let сol_name of existing.p_k)

                if (!tmp_table.p_k.includes (сol_name))
                
	                tmp_table.columns [сol_name] = existing.columns [сol_name]

            for (let t of [table, tmp_table]) t.model = this.model
            
            tmp_table.name = 't_' + String (Math.random ()).replace (/\D/g, '_') // njsscan-ignore: node_insecure_random_generator
            
            tmp_table.qname = this.quote_name (tmp_table.name)
            
            try {
	            result.push (this.gen_sql_add_table (tmp_table))
            }
            catch (x) {
            	darn (x)
            	continue
            }
            
            let cols = []

            for (let col of Object.values (tmp_table.columns)) {

                let col_name = col.name; if (!existing.columns [col_name]) continue

                cols.push (col_name)

                if (tmp_table.p_k.includes (col_name)) continue

                delete col.COLUMN_DEF

                delete existing.columns [col_name].COLUMN_DEF

                result.push (this.gen_sql_add_column (tmp_table, col))

            }

            result.push ({sql: `SET max_partitions_per_insert_block=0`})

            result.push ({sql: `INSERT INTO ${tmp_table.qname} (${cols}) SELECT ${cols} FROM ${table.name} WHERE ${tmp_table.p_k.map(i => i + ' IS NOT NULL').join(' AND ')}`})

            result.push ({sql: `DROP TABLE ${table.qname}`})
            
            result.push ({sql: `RENAME TABLE ${tmp_table.qname} TO ${table.qname}`})

            existing.pk  = table.pk

            existing.p_k = table.p_k

            for (let name of table.p_k) existing.columns [name] = table.columns [name]

		}
    
        return result
        
    }
    
    gen_sql_add_tables () {

        let result = [], {model} = this
        
        for (let type of ['tables', 'partitioned_tables']) for (let table of Object.values (model [type])) if (!table.existing) {

            let pk = table.pk
            let df = table.columns [pk]
            
            table.existing = {pk, columns: {[pk]: df}, keys: {}, triggers: {}}
            table._is_just_added = 1

            result.push (this.gen_sql_add_table (table))

        }

        return result

    }

    gen_sql_add_table (table) {

        let {p_k, columns, engine} = table

        let {model} = this, {conf} = model

        let on_cluster = table.on_cluster? ` ON CLUSTER ${table.on_cluster}` : ''

		let sql = `CREATE TABLE ${table.name}${on_cluster}(${p_k.map (k => k + ' ' + this.gen_sql_column_definition (columns [k]))}) ENGINE=${engine}`

		if (engine.slice (-9) === 'MergeTree') sql += ` ORDER BY (${p_k})`

		let p = table.partition_by || (table.partition || {}).by; if (p) sql += ' PARTITION BY ' + p

        return {sql, params: []}

    }

    gen_sql_comment_tables () {
		return []
    }

    gen_sql_add_columns () {
    
        let result = []
        
        for (let type of ['tables', 'partitioned_tables']) for (let table of Object.values (this.model [type])) {
        
            let after = table.on_after_add_column

            let {existing, columns} = table

            for (let name of Object.keys (columns).sort ()) {

                let col = columns [name]

                if (col === -Infinity) {

                    if (name in existing.columns) {
                    
                    	result.push ({sql: `ALTER TABLE ${table.name} DROP COLUMN IF EXISTS "${name}"`, params: []})
                    
                    }
                    else {
                    
						this.model.odd ({type: 'dropped_column', id: `${table.name}.${name}`})

                    }

                    delete columns [name]

                    continue
                    
                }

            	if (table.p_k.includes (name)) continue

                let ex = existing.columns [name]; if (ex) {

					if (/UInt32/.test (ex.TYPE_NAME) && !/UInt32/.test (col.TYPE_NAME)) {

                        let on_cluster = table.on_cluster? ` ON CLUSTER ${table.on_cluster}` : ''

		                result.push ({
							sql: `ALTER TABLE ${table.name}${on_cluster} MODIFY COLUMN ${col.name} ` + this.gen_sql_column_definition (col),
							params: []
						})
						
					}
					
					continue

            	}

                result.push (this.gen_sql_add_column (table, col))
                                
                if (!table._is_just_added && after) {
                    let a = after [col.name]
                    if (a) for (let i of a) result.push (i)
                }                

                existing.columns [name] = clone (col)
                
                delete existing.columns [name].REMARK

            }

        }
    
        return result
    
    }
    
    gen_sql_add_column (table, col) {

        let on_cluster = table.on_cluster? ` ON CLUSTER ${table.on_cluster}` : ''

        return {
            sql: `ALTER TABLE ${table.name}${on_cluster} ADD COLUMN ${col.name} ` + this.gen_sql_column_definition (col),
            params: []
        }
    
    }
    
    gen_sql_set_default_columns () {
        return [] // TODO ALTER COLUMN
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
    
    gen_sql_alter_columns () {
    
        let result = []

        for (let type of ['tables', 'partitioned_tables']) for (let table of Object.values (this.model [type])) {

            let existing_columns = table.existing.columns

            for (let col of Object.values (table.columns)) {

            	const ex = existing_columns [col.name]; if (!ex) continue
            	
            	let diff = new Map ()
            	
				for (const name of [
					'TYPE_NAME',
					'NULLABLE',   
					'COLUMN_DEF', 
					'COLUMN_SIZE',
					'DECIMAL_DIGITS',			
				]) {

					const from = ex [name], to = col [name]; if (from == to) continue

					switch (name) {
					
						case 'COLUMN_SIZE':
						case 'DECIMAL_DIGITS': 
							if (parseInt (from) >= parseInt (to)) continue
							break
							
						case 'COLUMN_DEF':
							if (from == this.gen_sql_quoted_literal (to)) continue
							break
					}

					diff.set (name, [from, to])

				}
				
				if (diff.size === 0) continue
            	
            	if (table.p_k.includes (col.name)) {

					this.model.odd ({type: 'alter_pk_column', id: `${table.name}.${col.name}`, data: [...diff.entries ()]})

            		continue

            	}

		        const on_cluster = table.on_cluster? ` ON CLUSTER ${table.on_cluster}` : ''

				result.push ({
					sql: `ALTER TABLE ${table.name}${on_cluster} MODIFY COLUMN ${col.name} ` + this.gen_sql_column_definition (col),
					params: []
				})

            }

        }

        return result

    }
    
    gen_sql_comment_columns () {

        let result = []

        for (let table of Object.values (this.model.tables)) {

            let existing_columns = table.existing.columns

            for (let col of Object.values (table.columns)) {
            
                let label = col.REMARK || ''

                if (label == (existing_columns [col.name] || {}).REMARK) continue

                let on_cluster = table.on_cluster? ` ON CLUSTER ${table.on_cluster}` : ''

                result.push ({sql: `ALTER TABLE ${table.name}${on_cluster} COMMENT COLUMN ${col.name} ` + this.gen_sql_quoted_literal (label), params: []})

            }

        }

        return result

    }    
    
    gen_sql_recreate_views () {

        let result = []
        
        for (let name in this.model.views) {
        
        	let view = this.model.views [name]; view.depends = {}
        	
        	for (let word of view.sql.split (/\b/))
        	
        		if (this.model.views [word])

        			view.depends [word] = 1

        }
        
        let names = [], idx = {}
        
        let assert = name => {
        
        	if (idx [name]) return
        
        	for (let k in this.model.views [name].depends) assert (k)
        	
        	idx [name] = names.push (name)

        }
        
        for (let name in this.model.views) assert (name)

		let views = names.map (i => this.model.views [i])

        for (let view of views) {
        	result.push ({sql: `DROP TABLE IF EXISTS ${view.name}`, params: []})
        }

        for (let view of views) {           
            result.push ({sql: `CREATE VIEW "${view.name}" AS ${view.sql}`, params: []})            
        }

        return result

    }

    gen_sql_after_add_tables() {
        const result = []

        for (let type of ['tables', 'partitioned_tables']) for (let table of Object.values(this.model[type])) {
            if (table._is_just_added) {

                let a = table.on_after_add_table

                if (a) {
                    if (typeof a === 'function') a = a.call(table, table)
                    if (a == null) a = []
                    if (!Array.isArray(a)) a = [a]
                    for (let i of a) result.push(i)
                }

                const data = table.init_data
                if (data) table._data_modified = table.data = data

            } else {
                delete table.init_data
            }
        }

        return result
    }
}
