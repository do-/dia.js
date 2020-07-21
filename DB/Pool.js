module.exports = class {

    constructor (o) {
        this.options = o
    }
    
    async update_model () {
    
    	let patch = this.gen_sql_patch ()
    	
    	if (!patch.length) return
    	
        return this.run (patch)
        
    }
    
    async run (list) {

        try {
            var db = await this.acquire ()
            db.log_prefix = '[RUNNING BATCH] '
            for (let i of list) await db.do (i.sql, i.params)
        }
        finally {
            this.release (db)
        }
        
    }    

    async load_schema () {

    	await this.model.pending ()

        try {
            var db = await this.acquire ()
            db.log_prefix = '[LOADING SCHEMA] '
            await db.load_schema ()
        }
        catch (x) {
        	darn (x)
        }
        finally {
            this.release (db)
        }

    }
    
    gen_sql_patch () {
    
        this.normalize_model ()

        let patch = []
			.concat (this.gen_sql_recreate_foreign_tables ())
            .concat (this.gen_sql_recreate_tables ())
            .concat (this.gen_sql_add_tables ())
            .concat (this.gen_sql_comment_tables ())
            .concat (this.gen_sql_add_columns ())
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

    normalize_model () {

    	for (let type of ['tables', 'views', 'foreign_tables'])

        	for (let table of Object.values (this.model [type]))

        		this.normalize_model_table (table)

    }
    
    normalize_model_table (table) {
        if (table.columns)  for (let col of Object.values (table.columns)) this.normalize_model_table_column (table, col)
        if (table.keys)     for (let k in table.keys)     this.normalize_model_table_key     (table, k)
        if (table.triggers) for (let k in table.triggers) this.normalize_model_table_trigger (table, k)
    }
    
    normalize_model_table_column (table, col) {

        if (!col.TYPE_NAME && col.ref) {

            let t = this.model.tables [col.ref]

        	if (!t) throw new Error (`${table.name}.${col.name} references ${col.ref}, but no such table found in the model`)

			let tpk = t.columns [t.pk]; for (let k of ['TYPE_NAME', 'COLUMN_SIZE']) {
			
            	let v = tpk [k]; if (v) col [k] = v

            }

        }

        col.TYPE_NAME = col.TYPE_NAME.toUpperCase ()

        if (col.NULLABLE == undefined) col.NULLABLE   =        (col.COLUMN_DEF == null)
        if (col.COLUMN_DEF != null)    col.COLUMN_DEF = String (col.COLUMN_DEF)
        
    }    

    gen_sql_after_add_tables () {

        let result = []

        for (let table of Object.values (this.model.tables)) {
        
			if (table._is_just_added) {

				let a = table.on_after_add_table; if (a) result.push (a)

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

}