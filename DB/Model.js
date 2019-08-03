const fs = require ('fs')
const path = require ('path')

module.exports = class {

    constructor (o) {
        if (!o.paths) o.paths = o.path ? [o.path] : []
        this.o = o
        this.reload ()
    }
    
    reload () {
        this.tables = {}
        this.views = {}
        for (let p of this.o.paths) this.load_dir (p)
    }
    
    load_dir (p) {
        for (let fn of fs.readdirSync (p)) if (/\.js/.test (fn)) {
            let name = fn.split ('.') [0]
            let table = this.load_file (p + '/' + fn, name)
            if (!table.pk) throw 'No primary key defined for ' + name
            this [table.sql ? 'views' : 'tables'] [name] = table
        }
    }
    
    load_file (p, name) {
        let m = require (path.resolve (p))
        m.name = name
        this.on_before_parse_table_columns (m)
        if (m.columns) this.parse_columns (m.columns)
        this.on_after_parse_table_columns (m)
        return m
    }
    
    on_before_parse_table_columns (table) {}
    on_after_parse_table_columns (table) {}
    
    parse_columns (columns) {
        for (let name in columns) {
            let column = columns [name]
            if (typeof column === 'string') column = this.parse_column (column)
            column.name = name
            columns [name] = column
        }
    }
    
    parse_column (s) {
    
        let [content, comment] = s.split (/\s*\/\/\s*/)
    
        let [type, column_def] = content.split (/\s*=\s*/)
        
        let col = {
            REMARK: comment,
            NULLABLE: !!!column_def,
        }
        
        function set (k, v) {if (v) col [k] = v}
        
        set ('COLUMN_DEF', column_def)
                
        type = type.replace (/\s/g, '')
        
        if (type.charAt (0) == '(') {
            col.ref = type.replace (/[\(\)]/g, '')
        }
        else {
            let [t, s, p] = type.split (/[\[\,\]]/)
            set ('TYPE_NAME', t)
            set ('col.COLUMN_SIZE', s)
            set ('col.DECIMAL_DIGITS', p)
        }
        
        return col
        
    }

}