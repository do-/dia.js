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
    
    gen_sql_add_tables () {

        let result = []

        for (let table of Object.values (this.model.tables)) if (!table.existing) {

            let pk = table.pk
            let df = table.columns [pk]
            
            table.existing = {pk, columns: {[pk]: df}, keys: {}, triggers: {}}

            result.push ({sql: `CREATE TABLE "${table.name}" (${pk} ${this.gen_sql_column_definition (df)} PRIMARY KEY)`, params: []})

        }

        return result

    }

    gen_sql_comment_tables () {

        let result = []

        for (let table of Object.values (this.model.tables)) 
        
            if (table.label != table.existing.label)

                result.push ({sql: `COMMENT ON TABLE "${table.name}" IS ` + this.gen_sql_quoted_literal (table.label), params: []})

        return result

    }

    gen_sql_upsert_data () {

        let result = []
        
        for (let table of Object.values (this.model.tables)) {
        
            let data = table.data
            
            if (!data) continue
            
            for (let record of data) {
            
                let [f, s, v] = [[], [], []]
                            
                for (let k in record) {
                
                    f.push (k)
                    v.push (record [k])
                    
                    if (k != table.pk) s.push (`${k}=EXCLUDED.${k}`)

                }
            
                result.push ({sql: `INSERT INTO "${table.name}" (${f}) VALUES (?${',?'.repeat (f.length - 1)}) ON CONFLICT (${table.pk}) DO UPDATE SET ${s}`, params: v})

            }
        
        }

        return result

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
    
    gen_sql_update_triggers () {
    
        let result = []
        
        for (let table of Object.values (this.model.tables)) {
        
            let triggers = table.triggers
        
            if (!triggers) continue
        
            let existing_triggers = (table.existing || {triggers: {}}).triggers
            
            for (let name in triggers) {
            
                let src = triggers [name]
                
                if (src == existing_triggers [name]) continue
                
                let [phase, ...events] = name.toUpperCase ().split ('_')
                
                let glob = `on_${name}_${table.name}`
                
                result.push ({sql: `

                    CREATE OR REPLACE FUNCTION ${glob}() RETURNS trigger AS \$${glob}\$

                        ${src}

                    \$${glob}\$ LANGUAGE plpgsql;

                `, params: []})

                result.push ({sql: `
                
                    DROP TRIGGER IF EXISTS ${glob} ON ${table.name};
                    
                `, params: []})

                result.push ({sql: `

                    CREATE TRIGGER 
                        ${glob}
                    ${phase} ${events.join (' OR ')} ON 
                        ${table.name}
                    FOR EACH ROW EXECUTE PROCEDURE 
                        ${glob} ();

                `, params: []})
            
            }
        
        }
        
        return result

    }

    gen_sql_update_keys () {
    
        let result = []
        
        for (let table of Object.values (this.model.tables)) {
        
            let keys = table.keys

            if (!keys) continue
        
            let existing_keys = (table.existing || {keys: {}}).keys

            for (let name in keys) {
            
                let src = keys [name]
                
                let old_src = existing_keys [name]
                
                if (src == old_src) continue

                let glob = `ix_${table.name}_${name}`

                if (old_src) result.push ({sql: `DROP INDEX ${glob};`, params: []})
                
                if (src != null) result.push ({sql: `CREATE INDEX ${glob} ON ${table.name} (${src});`, params: []})

            }

        }

        return result

    }

    normalize_model_table_trigger (table, k) {
    
        let src = table.triggers [k].replace (/\s+/g, ' ').trim ()
    
        table.triggers [k] = `BEGIN ${src} END;`
    
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
        else if (/(CHAR|STRING|TEXT)$/.test (col.TYPE_NAME)) {
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