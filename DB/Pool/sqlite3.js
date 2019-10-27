const genericPool = require ("generic-pool")
const sqlite3     = require ("sqlite3").verbose ()
const wrapper     = require ('../Client/sqlite3.js')

module.exports = class extends require ('../Pool.js') {

    constructor (o) {
    
        super (o)
        
        if (!o.filename) o.filename = o.connectionString.split ('://') [1]
        
        let factory = {

			create: function () {				
				
				return new Promise (function (ok, fail) {
				
					let db = new sqlite3.Database (
						o.filename, 
						(x) => x ? fail (x) : ok (db)
					)
					
				})
				
			},

			destroy: function (db) {
			
				return new Promise (function (ok, fail) {
					db.close ((x) => x ? fail (x) : ok ())
				})
				
			}

		}
		
		this.backend = genericPool.createPool (factory, o);
		
    }
    
    async acquire () {  
        let raw = await this.backend.acquire ()
        let c = new wrapper (raw)
        c.model = this.model
        c.pool = this
        return c
    }

    async release (client) {
        return await this.backend.release (client.backend)
    }
    
    gen_sql_quoted_literal (s) {
        if (s == null) s = ''
        return "'" + String (s).replace(/'/g, "''") + "'"
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
    
        let pk = table.pk
        
        let df = table.columns [pk]
        
        return {
            sql: `CREATE TABLE "${table.name}" (${pk} ${this.gen_sql_column_definition (df)} PRIMARY KEY)`, 
            params: []
        }

    }
    
    gen_sql_recreate_views () {

        let result = []

        for (let view of Object.values (this.model.views)) {            
        
            result.push ({sql: `DROP VIEW IF EXISTS "${view.name}"`, params: []})
            result.push ({sql: `CREATE VIEW "${view.name}" AS ${view.sql}`, params: []})            
            result.push ({sql: `COMMENT ON VIEW "${view.name}" IS ` + this.gen_sql_quoted_literal (view.label), params: []})

            for (let col of Object.values (view.columns))                             
                result.push ({sql: `COMMENT ON COLUMN "${view.name}"."${col.name}" IS ` + this.gen_sql_quoted_literal (col.REMARK), params: []})
            
        }

        return result

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

    gen_sql_comment_tables () {
		return []
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
                
                let something = s.length ? 'UPDATE SET ' + s : 'NOTHING'
                            
                result.push ({sql: `INSERT INTO "${table.name}" (${f}) VALUES (?${',?'.repeat (f.length - 1)}) ON CONFLICT (${table.pk}) DO ${something}`, params: v})

            }
        
        }

        return result

    }
    
    gen_sql_add_column (table, col) {
    
        return {
            sql: `ALTER TABLE "${table.name}" ADD "${col.name}" ` + this.gen_sql_column_definition (col), 
            params: []
        }
    
    }
    
    gen_sql_recreate_tables () {
    
        let result = []
return result        
        for (let table_name in this.model.tables) {
        
            let table = this.model.tables [table_name]
            
            if (!table.existing) continue;

            if (table.pk == table.existing.pk) continue;

            let tmp_table = clone (table)
            
            tmp_table.name = 't_' + String (Math.random ()).replace (/\D/g, '_')
                        
            result.push (this.gen_sql_add_table (tmp_table))
            
            let cols = []

            for (let col of Object.values (tmp_table.columns)) {

                let col_name = col.name

                if (!table.existing.columns [col_name]) continue

                cols.push (col_name)

                if (col_name != tmp_table.pk) {
                
                    delete col.COLUMN_DEF
                    delete table.existing.columns [col_name].COLUMN_DEF
                
                    result.push (this.gen_sql_add_column (tmp_table, col))
                    
                }

            }

            result.push ({sql: `INSERT INTO ${tmp_table.name} (${cols}) SELECT ${cols} FROM ${table.name}`, params: []})

            let TYPE_NAME = tmp_table.columns [tmp_table.pk].TYPE_NAME

            for (let ref_table_name in this.model.tables) {
            
                let ref_table = ref_table_name == table.name ? tmp_table : this.model.tables [ref_table_name]
                
                for (let col of Object.values (ref_table.columns)) {
                
                    if (col.ref != table.name) continue
                    
                    let tmp_col = {TYPE_NAME, ref: tmp_table, name: 'c_' + String (Math.random ()).replace (/\D/g, '_')}

                    result.push (this.gen_sql_add_column (ref_table, tmp_col))
                    result.push ({sql: `UPDATE ${ref_table.name} r SET ${tmp_col.name} = (SELECT ${tmp_table.pk} FROM ${table.name} v WHERE v.${table.existing.pk}=r.${col.name})`, params: []})
                    result.push ({sql: `ALTER TABLE ${ref_table.name} DROP COLUMN ${col.name}`, params: []})
                    result.push ({sql: `ALTER TABLE ${ref_table.name} RENAME ${tmp_col.name} TO ${col.name}`, params: []})
                    
                    ref_table.columns [col.name].TYPE_NAME = TYPE_NAME
                
                }

            }

            result.push ({sql: `DROP TABLE ${table.name}`, params: []})
            result.push ({sql: `ALTER TABLE ${tmp_table.name} RENAME TO ${table.name}`, params: []})
            
            table.existing.pk = table.pk
            table.existing.columns [table.pk] = table.columns [table.pk]

        }        
        
        return result

    }
    
    gen_sql_add_columns () {
    
        let result = []
        
        for (let table of Object.values (this.model.tables)) {
        
            let existing_columns = table.existing.columns

            let after = table.on_after_add_column
        
            for (let col of Object.values (table.columns)) {
            
                let ex = existing_columns [col.name]
                
                if (ex) continue

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

    gen_sql_set_default_columns () {

        let result = []

        for (let table of Object.values (this.model.tables)) {

            let existing_columns = table.existing.columns

            for (let col of Object.values (table.columns)) {
            
                let d = col.COLUMN_DEF

                if (d != existing_columns [col.name].COLUMN_DEF) {
                
                    if (d == null) {

                        result.push ({sql: `ALTER TABLE "${table.name}" ALTER COLUMN "${col.name}" DROP DEFAULT`, params: []})

                    }
                    else {

                        if (d.indexOf ('(') < 0) result.push ({sql: `UPDATE "${table.name}" SET "${col.name}" = ${d} WHERE "${col.name}" IS NULL`, params: []})

                        result.push ({sql: `ALTER TABLE "${table.name}" ALTER COLUMN "${col.name}" SET DEFAULT ${d}`, params: []})

                    }
                
                }
                
                if (col.name != table.pk) {

                    let n = col.NULLABLE

                    if (n != existing_columns [col.name].NULLABLE) {

                        result.push ({sql: `ALTER TABLE "${table.name}" ALTER COLUMN "${col.name}" ${n ? 'DROP' : 'SET'} NOT NULL`, params: []})

                    }

                }                

            }

        }

        return result

    }    
    
    gen_sql_comment_columns () {
		return []
    }    
    
    gen_sql_update_triggers () {
		return []
    }
    
    normalize_model_table_key (table, k) {

        let glob = `ix_${table.name}_${k}`
    
        let src = table.keys [k]
        
        if (src != null) {
        
        	let unique = ''
        	
        	let um = /^\s*(UNIQUE)\s*\((.*?)\)\s*$/.exec (src); if (um) [unique, src] = um.slice (1)
        
        	src = `CREATE ${unique} INDEX ${glob} ON ${table.name} (${src.trim ()})`
        	
        }
        
        delete table.keys [k]
        table.keys [glob] = src

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
                
                function invariant (s) {
                    if (s == null) return ''
                    return s.replace (/[\s\(\)]/g, '').toLowerCase ()
                }

                if (invariant (src) == invariant (old_src)) continue

                if (old_src) result.push ({sql: `DROP INDEX IF EXISTS ${name};`, params: []})
                
                if (src != null) result.push ({sql: src, params: []})

            }

        }

        return result

    }

    normalize_model_table_trigger (table, k) {
        
    }
    
    normalize_model_table_column (table, col) {
        
        super.normalize_model_table_column (table, col) 
                
        if (/INT$/.test (col.TYPE_NAME)) {
            col.TYPE_NAME = 'INTEGER'
        }
        else if (/(CHAR|STRING|TEXT)$/.test (col.TYPE_NAME)) {
            col.TYPE_NAME = 'TEXT'
        }
        else if (/BINARY$/.test (col.TYPE_NAME)) {
            col.TYPE_NAME = 'BLOB'
        }
        else if (/BLOB$/.test (col.TYPE_NAME)) {
            col.TYPE_NAME = 'BLOB'
        }
        else if (col.TYPE_NAME == 'DECIMAL' || col.TYPE_NAME == 'MONEY' || col.TYPE_NAME == 'NUMBER') {
            col.TYPE_NAME = 'NUMERIC'
        }
        else if (/^DATE/.test (col.TYPE_NAME) || /TIME$/.test (col.TYPE_NAME)) {
            col.TYPE_NAME = 'TEXT'
        }
        else if (col.TYPE_NAME == 'CHECKBOX') {
            col.TYPE_NAME = 'INTEGER'
            col.COLUMN_DEF = '0'
        }
        
        if (col.TYPE_NAME == 'NUMERIC') {
            if (!col.COLUMN_SIZE) col.COLUMN_SIZE = 10
            if (col.DECIMAL_DIGITS == undefined) col.DECIMAL_DIGITS = 0
        }                
        
    }

}