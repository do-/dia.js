const fs = require ('fs')
const path = require ('path')

module.exports = class {

    constructor (o) {
        if (!o.paths) o.paths = o.path ? [o.path] : []
        this.o = o
        this.reload ()
darn (this.tables.tasks)        
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
            COLUMN_DEF: column_def,
            NULLABLE: !!!column_def,
        }
        
        let ref = /^\s*\((\w+)\)/.exec (type)        
        if (ref) {
            col.TYPE_NAME = 'int'
            col.ref = ref [1]
        }
        else {
            let tsd = /^\s*(\w+)(?:\s*\[\s*(\d{1,2})(?:\s*,\s*(\d{1,2}))?\])?/.exec (type)        
            col.TYPE_NAME = tsd [1]
            col.COLUMN_SIZE = tsd [2]
            col.DECIMAL_DIGITS = tsd [3]
        }
        
        return col
        
    }
    
}