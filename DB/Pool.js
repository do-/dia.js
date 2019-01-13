module.exports = class {

    constructor (o) {
        this.options = o
    }
    
    async load_schema () {
    
        try {
            var db = await this.acquire ()
            await db.load_schema ()
        }
        finally {
            this.release (db)
        }

    }
    
    gen_sql_patch () {
    
        this.normalize_model ()
    
        return []
            .concat (this.gen_sql_add_columns ())
    
    }

    normalize_model () {
        for (let table of Object.values (this.model.tables)) this.normalize_model_table (table)
    }
    
    normalize_model_table (table) {
        if (table.columns) for (let col of Object.values (table.columns)) this.normalize_model_table_column (table, col)
    }
    
    normalize_model_table_column (table, col) {        

        col.TYPE_NAME = col.TYPE_NAME.toUpperCase ()

        if (col.NULLABLE == undefined) col.NULLABLE   =        (col.COLUMN_DEF == null)
        if (col.COLUMN_DEF != null)    col.COLUMN_DEF = String (col.COLUMN_DEF)
        
    }    

}