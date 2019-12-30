const {Pool} = require ('pg')
const wrapper = require ('../Client/postgresql.js')

module.exports = class extends require ('../Pool.js') {

    constructor (o) {
        super (o)
        this.backend = new Pool (o)
    }
    
    listen (o) {

		let db = new (require ('pg')).Client (this.options.connectionString)		
		
		db.connect ()
		
		let sql = 'LISTEN ' + o.name
		
		db.query (sql)
		
		db.on ('notification', async e => {

			try {
			
				await new Promise ((ok, fail) => {
				
					let h = new o.handler (Object.assign ({rq: JSON.parse (e.payload)}, o.params), ok, fail)
					
					darn (sql + ': ' + e.payload + ' -> ' + h.uuid)
					
					h.run ()
					
				})

			}
			catch (x) {

				darn (x)

			}

		})

		darn ('Listening for PostgreSQL notifications on ' + o.name)

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

        let result = []

        for (let table of Object.values (this.model.tables)) {

            let existing_columns = table.existing.columns

            for (let col of Object.values (table.columns)) {
            
                let label = col.REMARK

                if (label == existing_columns [col.name].REMARK) continue
                
                result.push ({sql: `COMMENT ON COLUMN "${table.name}"."${col.name}" IS ` + this.gen_sql_quoted_literal (label), params: []})

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
    
    normalize_model_table_key (table, k) {

        let glob = `ix_${table.name}_${k}`

        let src = table.keys [k]

        if (src != null) {
            src = src.trim ()
            if (src.indexOf ('(') < 0) src = `(${src})`
            if (src.indexOf ('USING') < 0) src = src.replace ('(', 'USING btree (')
            src = src.replace ('USING', `INDEX ${glob} ON ${table.name} USING`)
            src = 'CREATE ' + src
        }

        table.keys [k] = src

        let o = [table.keys]; for (let j of ['on_before_create_index']) if (table [j]) o.push (table [j])

        for (let h of o) if (k in h) {
        	let v = h [k]
			delete h [k]
			h [glob] = v
        }

    }

    gen_sql_update_keys () {
    
        let result = []
        
        for (let table of Object.values (this.model.tables)) {
        
            let keys = table.keys

            if (!keys) continue
        
            let existing_keys = (table.existing || {keys: {}}).keys
            
            let before = table.on_before_create_index

			for (let name in keys) {
            
                let src = keys [name]
                
                let old_src = existing_keys [name]
                
                function invariant (s) {
                    if (s == null) return ''
                    return s.replace (/[\s\(\)]/g, '').toLowerCase ()
                }
                
                if (invariant (src) == invariant (old_src)) continue

                if (old_src) {
                	result.push ({sql: `DROP INDEX IF EXISTS ${name};`, params: []})
                }
                else if (before) {
                    let b = before [name]
                    if (b) for (let i of b) result.push (i)
                }
                
                if (src != null) result.push ({sql: src, params: []})

            }

        }

        return result

    }

    normalize_model_table_trigger (table, k) {

        let src = table.triggers [k].replace (/\s+/g, ' ').trim ()

        if (!src.match (/^DECLARE/)) src = `BEGIN ${src} END;`

        table.triggers [k] = src

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
            col.TYPE_NAME = col.COLUMN_SIZE ? 'VARCHAR' : 'TEXT'
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
        else if (col.TYPE_NAME == 'CHECKBOX') {
            col.TYPE_NAME = 'INT2'
            col.COLUMN_DEF = '0'
        }
        
        if (col.TYPE_NAME == 'NUMERIC') {
            if (!col.COLUMN_SIZE) col.COLUMN_SIZE = 10
            if (col.DECIMAL_DIGITS == undefined) col.DECIMAL_DIGITS = 0
        }                
        
    }

}