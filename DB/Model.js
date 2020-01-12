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
            table.p_k = Array.isArray (table.pk) ? table.pk : [table.pk]
            this [table.sql ? 'views' : 'tables'] [name] = table
        }
    }
    
    load_file (p, name) {

        let m = require (path.resolve (p))

        m.name = name
        m.model = this

        this.on_before_parse_table_columns (m)

        if (m.columns) this.parse_columns (m.columns)

        let triggers = m.triggers; if (triggers) {for (let k in triggers) {
        	let v = triggers [k]
        	if (typeof v === 'function') triggers [k] = v.apply (m)
        }}

        this.on_after_parse_table_columns (m)

        for (let k of ['data', 'init_data']) if (typeof m [k] === "function") ((async () => {m [k] = await m [k].apply (m)})) ()

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
            NULLABLE: !column_def,
        }
        
        function set (k, v) {if (v) col [k] = v}
        
        set ('COLUMN_DEF', column_def)
                        
        let [t, re] = type.split ('/'); if (re) {
        	type = t
	        set ('PATTERN', re)
        }
        
        type = type.replace (/\s/g, '')
        
        if (type.charAt (0) == '(') {
            col.ref = type.replace (/[\(\)]/g, '')
        }
        else {

			let [, t, len, mm] = /(\w+)(?:\[(.*?)\])?(?:\{(.*?)\})?/.exec (type)

            set ('TYPE_NAME', t)
            
            if (len) {
				let [, min_length, column_size, decimal_digits] = /(?:(\d+)..)?(\d+)(?:,(\d+))?/.exec (len)
				if (min_length)     set ('MIN_LENGTH', min_length)
				if (column_size)    set ('COLUMN_SIZE', column_size)
				if (decimal_digits) set ('DECIMAL_DIGITS', decimal_digits)
            }

            if (mm) {            
				let [, min, max] = /^(.*?)\.\.(.*?)$/.exec (mm)
				if (min) set ('MIN', min)
				if (max) set ('MAX', max)
            }

        }

        return col
        
    }

	read_data_lines (name) {
	
		return fs.readFileSync ('./Model/data/' + name + '.txt', 'utf-8').split ("\n")
	
	}

	has_validation (tab_or_col) {

		let columns = tab_or_col.columns; if (columns) {		

			for (let name in columns) if (this.has_validation (columns [name])) return true

		}
		else {

			for (let k of ['COLUMN_SIZE', 'MIN_LENGTH', 'MIN', 'MAX', 'PATTERN']) if (k in tab_or_col) return true

		}	

		return false

	}
	
    trg_check_column_value_min_num (col, table) {
    
    	return `Значение поля "${col.REMARK}" не может быть менее ${col.MIN}`
    
    }

    trg_check_column_value_min_date (col, table) {
    
    	return `Значение поля "${col.REMARK}" не может быть ранее ${col.MIN.split ('-').reverse ().join ('.')}`
    
    }

    trg_check_column_value_max_num (col, table) {
    
    	return `Значение поля "${col.REMARK}" не может быть более ${col.MAX}`
    
    }

    trg_check_column_value_max_date (col, table) {
    
    	return `Значение поля "${col.REMARK}" не может быть позднее ${col.MAX.split ('-').reverse ().join ('.')}`
    
    }

    trg_check_column_value_min_length (col, table) {
    
    	return `Значение поля "${col.REMARK}" не может быть короче ${col.MIN_LENGTH} символов`
    
    }

    trg_check_column_value_pattern (col, table) {

    	return `Проверьте, пожалуйста, правильность заполнения поля "${col.REMARK}"`
    
    }
	

}