const {Pool} = require ('pg')
const wrapper = require ('../Client/postgresql.js')

module.exports = class extends require ('../Pool.js') {

    constructor (o) {
        super (o)
        this.backend = new Pool (o)
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
    
    gen_sql_quoted_literal (s) {
        if (s == null) s = ''
        return "'" + String (s).replace(/'/g, "''") + "'"
    }

    gen_sql_column_comment (table, col) {
        return {sql: `COMMENT ON COLUMN "${table.name}"."${col.name}" IS ` + this.gen_sql_quoted_literal (col.REMARK), params: []}
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
    
    gen_sql_add_columns () {
    
        let result = []
        
        for (let table of Object.values (this.model.tables)) {
        
            let existing_columns = (table.existing || {columns: {}}).columns
            let after = table.on_after_add_column
        
            for (let col of Object.values (table.columns)) {
            
                let ex = existing_columns [col.name]
                
                if (ex) continue
                
                result.push ({sql: `ALTER TABLE "${table.name}" ADD "${col.name}" ` + this.gen_sql_column_definition (col), params: []})
                
                result.push (this.gen_sql_column_comment (table, col))                
                
                if (after) {
                    let a = after [col.name]
                    if (a) for (let i of a) result.push (i)
                }                

            }

        }
    
        return result
    
    }
    
    normalize_model_table_column (table, col) {
        
        super.normalize_model_table_column (table, col) 
        
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
        else if (/(CHAR|TEXT)$/.test (col.TYPE_NAME)) {
            col.TYPE_NAME = 'TEXT'
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
        
        if (col.TYPE_NAME == 'NUMERIC') {
            if (!col.COLUMN_SIZE) col.COLUMN_SIZE = 10
            if (col.DECIMAL_DIGITS == undefined) col.DECIMAL_DIGITS = 0
        }                
        
    }

}