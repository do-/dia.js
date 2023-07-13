const assert = require ('assert')
const fs = require ('fs')
const path = require ('path')
const Config = require ('../Config.js')

module.exports = class {

    constructor (o = {}) {

    	if (o instanceof Config) o = {conf: o}

    	if (!((this.conf = o.conf) instanceof Config)) throw new Error ('Sorry, an instance of Dia Config is now mandatory to initialize a Model')

        if (!o.paths) o.paths = o.path ? [o.path] : this.conf._model_paths || ['./Model']

        this.o = o

        this.voc_options = {
        
        	id:         'id',
        	id_name:    'id',
        	
        	label:      'label',
        	label_name: 'label',
        	
        	order:      '2',
        	
        	columns:    ['is_deleted'],

        	...(o.voc_options || {})

        }

        this.relation_types = ['tables', 'views', 'foreign_tables', 'partitioned_tables']
        this.drop_types     = ['table_drops', 'view_drops']
        this.all_types      = [...this.relation_types, ...this.drop_types, 'procedures', 'functions']

		this._oddities = []

        this.reload ()

    }
    
    odd (o) {
    	this._oddities.push (o)
    }

    async pending () {

    	let todo = [], add = (o, k, def) => {

			const v = o [k]; switch (typeof v) {

				case 'function' : return todo.push ((async () => {o [k] = await v.apply (def)}) ())

				case 'object'   : for (const name in v) add (v, name, def)

			}

		}

		for (const type of this.all_types)

			for (const def of Object.values (this [type]))

				for (const k of ['data', 'init_data', 'sql', 'body', 'queue', 'triggers'])

					if (k in def) add (def, k, def)

    	return Promise.all (todo)

    }

    reload () {

    	for (let k of this.all_types) this [k] = {}
    	
    	let all = {}; for (let p of this.o.paths) for (let fn of fs.readdirSync (p)) if (/\.js/.test (fn)) {

			let src = path.resolve (p, fn), m = this.load_file (src), {name} = m
			
			if (!(name in all)) all [name] = []

			all [name].push ({m, src})

        }
        
        let merged = Object.values (all).map (l => this.merge (l))

        for (let m of merged) this.add_definition (m)

    }
    
    add_roster (type) {
    
		this.all_types.push (type)
			
		return this [type] = {}

    }

    get_roster (type) {
    
    	if (!(type in this)) return this.add_roster (type)

    	const r = this [type]

    	assert (r && typeof r === 'object', `Invalid type name: '${type}'`)

    	return r

    }
    
    guess_type (def) {
    	
		const {columns, body, sql} = def
    
    	if (columns === -Infinity) return 'table_drop'

    	if (!columns && !body) {darn (def); throw new Error ('Impossible to guess definition type, see STDERR')}

    	if (!columns)              return 'returns' in def ? 'function' : 'procedure'

		if (sql === -Infinity)     return 'view_drop'

		if (sql) return 'view'
		
		if ('db_link' in def)      return 'foreign_table'
		
		if ('partition' in def)    return 'partitioned_table'
		
		return 'table'

    }
    
    add_definition (def) {
    
    	if (!('type' in def)) def.type = this.guess_type (def)

    	const {name, type} = def; if (!name) {darn (def); throw new Exception ('Attempt to register a non named object')}
    	
    	if (!name) {darn (def); throw new Exception ('Attempt to register a non named object')}

		const r = this.get_roster (type + 's')

		assert (!(name in r), `${name} is already registered`)

		def.model = this
		
		let {columns} = def; if (columns && columns !== -Infinity) {

			this.on_before_parse_table_columns (def)

			this.parse_columns (def.columns)

			this.on_after_parse_table_columns (def)

        }

		r [name] = def

    }

    merge__name (ov, nv) {
    
    	return ov
    
    }

    merge__type (ov, nv) {
    
    	return this.merge___scalar (ov, nv, 'Type')
        
    }

    merge__label (ov, nv) {
    
    	return this.merge___scalar (ov, nv, 'Label')
        
    }

    merge___scalar (ov, nv, name) {
    
		if (nv != ov) throw `${name} mismatch: ${nv} vs. ${ov}`

    	return ov
    
    }

    merge__data (ov, nv) {

    	return this.merge___array (ov, nv)

    }

    merge__init_data (ov, nv) {

    	return this.merge___array (ov, nv)

    }

    merge___array (ov, nv) {

    	return [...ov, ...nv]

    }

    merge__p_k (ov, nv) {    	

		if (nv.length == 0) return ov
		
		if (ov.length == 0) return nv

		let j = [ov, nv].map (i => JSON.stringify (i))

		if (j [0] != j [1]) `PK mismatch: ${j [0]} vs. ${j [1]}`

		return ov

    }
    
    merge__columns (ov, nv) {

		for (let k in nv) if (k in ov) throw `Found two columns named ${k}`
		
		return {...ov, ...nv}

    }

    merge__keys (ov, nv) {

		for (let k in nv) if (k in ov) throw `Found two keys named ${k}`
		
		return {...ov, ...nv}

    }
    
    merge (list) {
    
    	if (list.length == 1) return list [0].m
    
    	let r = {}; for (let {m} of list) {
    	
    		for (let [k, v] of Object.entries (m)) {
    		
    			if (!(k in r)) {
    			
    				r [k] = v
    				
    				continue
    			
    			}
    			    			    			
    			try {

					let sub_name = 'merge__' + k, sub = this [sub_name]; if (!sub) throw `Don't know how to merge ${k}`

					r [k] = sub.call (this, r [k], v, r)

    			}
    			catch (x) {
    			
    				throw new Error (`Cannot load ${m.name} definition from ${list.map (i => i.src)}. ${x}`)
    			
    			}
    			   		
    		}
    	
    	}
    
    	return r
    
    }

    load_file (p) {

        let m = require (p)

        if (!('name' in m)) m.name = path.basename (p, '.js')

        return m

    }

    on_before_parse_table_columns (table) {}
    on_after_parse_table_columns (table) {}
    on_after_resolve_column_references () {}
    
    parse_columns (columns) {
        for (let name in columns) {
            let column = columns [name]
            if (typeof column === 'string') column = this.parse_column (column)
            if (typeof column === 'object') column.name = name
            columns [name] = column
        }
    }
    
    parse_column (s) {

		// eslint-disable-next-line redos/no-vulnerable
        let [content, comment] = s.split (/\s*\/\/\s*/)
    
		// eslint-disable-next-line redos/no-vulnerable
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

        let xxx = type.split (/(\!)/); if (xxx.length > 1) {
        	type = xxx [0]
	        col.NULLABLE = false
        }
        
        if (type.charAt (0) == '(') {
            
            col.ref = type.replace (/[\(\)]/g, '')
            
            const del = {
            	'-': 'CASCADE',
            	'~': 'SET NULL',
            }
            
            let d = del [col.ref.charAt (0)]; if (d) {            
            	col.ref_on_delete = d
            	col.ref = col.ref.slice (1)
            }
            
        }
        else {

			// eslint-disable-next-line redos/no-vulnerable
			let [, t, len, mm] = /(\w+)(?:\[(.*?)\])?(?:\{(.*?)\})?/.exec (type)

            set ('TYPE_NAME', t)
            
            if (len) {
				// eslint-disable-next-line redos/no-vulnerable
				let [, min_length, column_size, decimal_digits] = /(?:(\d+)\.\.)?(\d+)(?:\,(\d+))?$/.exec (len)
				if (min_length)     set ('MIN_LENGTH', min_length)
				if (column_size)    set ('COLUMN_SIZE', column_size)
				if (decimal_digits) set ('DECIMAL_DIGITS', decimal_digits)
            }

            if (mm) {            
				// eslint-disable-next-line redos/no-vulnerable
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

			if (tab_or_col === -Infinity) return false

			for (let k of ['MIN_LENGTH', 'MIN', 'MAX', 'PATTERN']) if (k in tab_or_col) return true

		}	

		return false

	}
	
    trg_check_column_value_min_num (col, table) {
    
    	return `Значение поля "${col.REMARK.replace(/%/g, '%%')}" не может быть менее ${col.MIN}`
    
    }

    trg_check_column_value_min_date (col, table) {

    	let v = col.MIN

    	if (v == 'NOW') {
    		v = 'сегодняшнего числа'
    	}
    	else {
    		v = v.split ('-').reverse ().join ('.')
    	}

    	return `Значение поля "${col.REMARK.replace(/%/g, '%%')}" не может быть ранее ${v}`
    
    }

    trg_check_column_value_max_num (col, table) {
    
    	return `Значение поля "${col.REMARK.replace(/%/g, '%%')}" не может быть более ${col.MAX}`
    
    }

    trg_check_column_value_max_date (col, table) {
    
    	let v = col.MAX
    	
    	if (v == 'NOW') {
    		v = 'сегодняшнего числа'
    	}
    	else {
    		v = v.split ('-').reverse ().join ('.')
    	}
    
    	return `Значение поля "${col.REMARK.replace(/%/g, '%%')}" не может быть позднее ${v}`

    }

    trg_check_column_value_min_length (col, table) {
    
    	return `Значение поля "${col.REMARK.replace(/%/g, '%%')}" не может быть короче ${col.MIN_LENGTH} символов`
    
    }

    trg_check_column_value_pattern (col, table) {

    	return `Проверьте, пожалуйста, правильность заполнения поля "${col.REMARK.replace(/%/g, '%%')}"`
    
    }

	cleanup () {

		this._oddities = []

		const {tables, views} = this, TO_DEL = ['triggers', 'sql', 'init_data']

		for (const type of [this.drop_types, 'procedures', 'functions']) 

			this [type] = {}

		for (const type of this.all_types) 

			for (const def of Object.values (this [type])) 

				for (const k of TO_DEL) 

					if (k in def) def [k] = undefined

	}

	resolve_column_references () {

		for (const type of this.all_types) 

			for (const {name, columns} of Object.values (this [type])) if (columns) 

				for (let col of Object.values (columns)) if (typeof col === 'object' && !('TYPE_NAME' in col) && 'ref' in col) {
					
					try {

						const {ref} = col, {columns, pk} = this.get_relation (ref)

						assert (columns, `"${ref}" has no columns`)
						assert (pk,      `"${ref}" has no pk`)

						const target = columns [pk]

						assert (target,  `"${ref}.${pk}" not found`)
						
						col.TYPE_NAME = target.TYPE_NAME

						if ('COLUMN_SIZE' in target) col.COLUMN_SIZE = target.COLUMN_SIZE

					}
					catch (cause) {
					
						darn (cause)

						throw new Error (`Cannot resolve the "${name}.${col.name}" reference`, {cause})

					}

				}
				
		this.on_after_resolve_column_references ()

	}	

	get_relation (name) {

		for (const type of this.relation_types) {

			const h = this [type]

			if (name in h) return h [name]

		}

		throw new Error (`Relation "${name}" not found`)

	}

}
