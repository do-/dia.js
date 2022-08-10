module.exports = class {

    constructor () {

		this.columns = {
			_id_rq  : {TYPE_NAME: 'uuid',   REMARK: 'Уникальный номер запроса', getter: h => h.uuid, NULLABLE: false},
			_type   : {TYPE_NAME: 'string', REMARK: 'Тип объекта', getter: h => (h.rq || {}).type},
			_id     : {TYPE_NAME: 'string', REMARK: 'Уникальный номер объекта', getter: h => (h.rq || {}).id},
			_action : {TYPE_NAME: 'string', REMARK: 'Действие', getter: h => (h.rq || {}).action},		
		}

		this.option_name = 'log'
		this.verbose = 0

    }

    get_signature (h) {

    	let o = {}; for (const [k, {getter}] of Object.entries (this.columns)) if (getter) {

    		const v = getter (h)

    		o [k] = v == null ? null : v // undefined as null

    	}

    	return o

    }

	to_logging_table_name (name) {
		
		return this.schema_name + '.' + name
		
	}

	to_logging_table_label (label) {
		
		return label + ' (история изменений)'
		
	}
	
	to_logging_column (col) {
	
		let c = {NULLABLE: true}; for (const k of ['name', 'REMARK', 'TYPE_NAME', 'COLUMN_SIZE', 'DECIMAL_DIGITS']) {
		
			const v = col [k]
			
			if (v != null) c [k] = v
		
		}
	
		return c
	
	}
	
	to_logging_table (def) {

		const {name, label, columns} = def, options = def [this.option_name], {except_columns} = options

		let log = {
		
			name  : this.to_logging_table_name (name),
			
			label : this.to_logging_table_label (label),
			
			columns: {},

			triggers: {},
			
		}
		
		for (const [name, col] of Object.entries (this.columns)) {
		
			if (!('name' in col)) col.name = name
				
			const c = this.to_logging_column (col)
			
			log.columns [c.name] = c
		
		}		

		for (const col of Object.values (columns)) {
		
			if (except_columns && except_columns.includes (col.name)) continue
		
			const c = this.to_logging_column (col)
			
			log.columns [c.name] = c
		
		}		

		return log

	}

}