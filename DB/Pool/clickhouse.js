const wrapper = require ('../Client/clickhouse.js')

module.exports = class extends require ('../Pool.js') {

    constructor (o) {
    
        super (o)
        	
		let [url, auth] = o.connectionString.slice ('clickhouse://'.length).split ('@').reverse ()
		
		let p = url.split ('/')
		
		this.database = p.pop ()
		
		p.push ('?database=' + this.database)

		if (p.length < 2 || p [1]) p.unshift ('http://')

		url = p.join ('/')
		
		this.http = new (require ('../../HTTP.js')) ({url, auth, method: 'POST'})

    }
    
    async acquire () {

    	let c = new wrapper (await this.http.acquire ())

        c.database = this.database
    	c.model = this.model
    	
        return c
        
    }

    async release (client) {
    }

    gen_sql_quoted_literal (s) {
        if (s == null) s = ''
        return "'" + String (s).replace(/'/g, "''") + "'"
    }
    
    gen_sql_column_definition (col) {
    
        let sql = col.TYPE_NAME
        
        if (col.NULLABLE) sql = 'Nullable(' + sql + ')'

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

        return sql

    }
    
    normalize_model_table_column (table, col) {
        
        super.normalize_model_table_column (table, col) 
                
        if (/INT/.test (col.TYPE_NAME)) {
            col.TYPE_NAME = 'UInt32'
        }
        else if (col.TYPE_NAME == 'CHAR') {
            col.TYPE_NAME = 'FixedString'
        }
        else if (/(BINARY|BLOB|CHAR|JSON|STRING|TEXT)$/.test (col.TYPE_NAME)) {
            col.TYPE_NAME = 'String'
        }
        else if (col.TYPE_NAME == 'DECIMAL' || col.TYPE_NAME == 'MONEY' || col.TYPE_NAME == 'NUMBER') {
            col.TYPE_NAME = 'Decimal'
        }
        else if (/TIME/.test (col.TYPE_NAME)) {
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

        let result = []

        for (let table of Object.values (this.model.tables)) if (!table.existing) {

            let pk = table.pk
            let df = table.columns [pk]
            
            table.existing = {pk, columns: {[pk]: df}, keys: {}, triggers: {}}
            table._is_just_added = 1

            result.push (this.gen_sql_add_table (table))

        }

        return result

    }

    gen_sql_add_table (table) {

        let p_k = table.p_k
		let col = table.columns

		let sql = `CREATE TABLE ${table.name} (${p_k.map (k => k + ' ' + this.gen_sql_column_definition (col [k]))}) ENGINE=${table.engine} ORDER BY (${p_k})`

		let p = table.partition_by; if (p) sql += ' PARTITION BY ' + p

        return {sql, params: []}

    }

    gen_sql_comment_tables () {
		return []
    }

    gen_sql_add_columns () {
    
        let result = []
        
        for (let table of Object.values (this.model.tables)) {
        
            let existing_columns = table.existing.columns

            let after = table.on_after_add_column
        
            for (let col of Object.values (table.columns)) {

            	let name = col.name; if (table.p_k.includes (name) || existing_columns [name]) continue

                result.push (this.gen_sql_add_column (table, col))
                                
                if (after) {
                    let a = after [col.name]
                    if (a) for (let i of a) result.push (i)
                }                

                existing_columns [col.name] = clone (col)
                
                delete existing_columns [col.name].REMARK

            }

        }
    
        return result
    
    }
    
    gen_sql_add_column (table, col) {
    
        return {
            sql: `ALTER TABLE ${table.name} ADD COLUMN ${col.name} ` + this.gen_sql_column_definition (col), 
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
    
    gen_sql_comment_columns () {

        let result = []

        for (let table of Object.values (this.model.tables)) {

            let existing_columns = table.existing.columns

            for (let col of Object.values (table.columns)) {
            
                let label = col.REMARK || ''

                if (label == (existing_columns [col.name] || {}).REMARK) continue
                
                result.push ({sql: `ALTER TABLE ${table.name} COMMENT COLUMN ${col.name} ` + this.gen_sql_quoted_literal (label), params: []})

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