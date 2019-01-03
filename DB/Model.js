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
        for (let p of this.o.paths) this.load_dir (p)
    }
    
    load_dir (p) {
        for (let fn of fs.readdirSync (p)) if (/\.js/.test (fn)) {
            let name = fn.split ('.') [0]
            let table = this.load_file (p + '/' + fn)
            table.name = name
            this.tables [name] = table
        }
    }

    load_file (p) {
        let m = require (path.resolve (p))
        if (m.columns) this.parse_columns (m.columns)
        return m
    }
    
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
            col.TYPE_NAME = 'int'
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