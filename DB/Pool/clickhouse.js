const wrapper = require ('../Client/clickhouse.js')

module.exports = class extends require ('../Pool.js') {

    constructor (o) {
    
        super (o)
        	
		let [url, auth] = o.connectionString.slice ('clickhouse://'.length).split ('@').reverse ()
		
		let p = url.split ('/')
		
		this.database = p.pop ()
		
		p.push ('?database=' + this.database)

		if (p.length < 2 || p [1]) p.unshift ('http:/')

		url = p.join ('/')
		
		this.http = new (require ('../../HTTP.js')) ({url, auth, method: 'POST'})

    }
    
    async acquire (o = {}) {
    
    	let {conf, log_meta} = o

        return this.inject (new wrapper (await this.http.acquire ({conf, log_meta})), o)
        
    }

    async release (client) {
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
        
        if (col.COLUMN_SIZE > 0) {
            sql += '(' + col.COLUMN_SIZE
            if (col.DECIMAL_DIGITS) sql += ',' + col.DECIMAL_DIGITS
            sql += ')'
        }

        if (col.NULLABLE) sql = 'Nullable(' + sql + ')'
        
        let def = col.COLUMN_DEF
        if (def != undefined) {
            if (def.indexOf (')') < 0) def = this.gen_sql_quoted_literal (def)
            sql += ' DEFAULT ' + def
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
        else if (col.TYPE_NAME == 'CHAR') {
            col.TYPE_NAME = 'FixedString'
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
        
        if (col.TYPE_NAME == 'Decimal') {
            if (!col.COLUMN_SIZE) col.COLUMN_SIZE = 10
            if (col.DECIMAL_DIGITS == undefined) col.DECIMAL_DIGITS = 0
        }                
        
        if (col.TYPE_NAME == 'String') {
            delete col.COLUMN_SIZE
        }                
        
        if (table.p_k.includes (col.name)) col.NULLABLE = false

    }

    gen_sql_recreate_tables () {
        return [] // TODO: recreate table
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

		let sql = `CREATE TABLE ${table.name}${on_cluster}(${p_k.map (k => k + ' ' + this.gen_sql_column_definition (columns [k]))}) ENGINE=${engine} ORDER BY (${p_k})`

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

                    if (name in existing.columns) result.push ({sql: `ALTER TABLE ${table.name} DROP COLUMN IF EXISTS "${name}"`, params: []})

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
            	
            	if (

            		 col.TYPE_NAME  === ex.TYPE_NAME  && 
            		 col.NULLABLE   === ex.NULLABLE   && 
            		(col.COLUMN_DEF  == ex.COLUMN_DEF  || ex.COLUMN_DEF == this.gen_sql_quoted_literal (col.COLUMN_DEF)) && 
            		(col.COLUMN_SIZE == ex.COLUMN_SIZE || parseInt (col.COLUMN_SIZE) < parseInt (ex.COLUMN_SIZE)) &&
            		(col.DECIMAL_DIGITS == ex.DECIMAL_DIGITS || parseInt (col.DECIMAL_DIGITS) < parseInt (ex.DECIMAL_DIGITS))

            	) continue

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
    
}
