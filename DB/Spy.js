module.exports = class {

    constructor () {
    
    	this.global_definitions = {}

		this.columns = {

			_uuid   : {TYPE_NAME: 'uuid',      REMARK: 'Первичный ключ в самой таблице истории'},
			_ts     : {TYPE_NAME: 'timestamp', REMARK: 'Дата/время события'},

			_id_rq  : {TYPE_NAME: 'uuid',   REMARK: 'Уникальный номер запроса', getter: h => h.uuid},
			_type   : {TYPE_NAME: 'string', REMARK: 'Тип объекта',              getter: h => (h.rq || {}).type},
			_id     : {TYPE_NAME: 'string', REMARK: 'Уникальный номер объекта', getter: h => (h.rq || {}).id},
			_action : {TYPE_NAME: 'string', REMARK: 'Действие',                 getter: h => (h.rq || {}).action},

		}

		this.option_name = 'log'
		this.schema_name = 'log'
		this.archive_table_name_postfix = '__log'
		this.verbose = 0

    }
    
    add_definition (def) {
    
    	this.global_definitions [def.name] = def
    
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

	to_archive_table_name (name) {
		
		return name + this.archive_table_name_postfix
		
	}

	to_logging_table_label (label) {
		
		return label + ' (история изменений)'
		
	}
	
	to_logging_column (col, o = {}) {
	
		if (col === -Infinity) return col

		let c = {}; for (const k of ['name', 'REMARK', 'TYPE_NAME', 'COLUMN_SIZE', 'DECIMAL_DIGITS', 'COLUMN_DEF']) {
		
			if (!(k in col)) continue

			if (o.no_def && k == 'COLUMN_DEF') continue
		
			const v = col [k]
			
			if (v != null) c [k] = v
		
		}
	
		return c
	
	}
	
	to_logging_table (def) {

		const {name, label, columns} = def, options = def [this.option_name]
		
		let {except_columns, archive} = options

		let {pk} = def; if (!Array.isArray (pk)) pk = [pk]

		if (!archive) archive = {
			pk: ['_ts', ...pk],
		}

		archive.name = this.to_archive_table_name (name)

		let log = {
		
			name  : this.to_logging_table_name (name),
			
			label : this.to_logging_table_label (label),
			
			columns: {},
			
			pk: '_uuid',

			triggers: {},

			archive,

		}
		
		for (const [name, col] of Object.entries (this.columns)) {
		
			if (!('name' in col)) col.name = name
				
			const c = this.to_logging_column (col)
			
			log.columns [c.name] = c
		
		}		

		const x = new Set (except_columns || []); for (const [name, col] of Object.entries (columns)) 

			if (!x.has (name)) 

				log.columns [name] = this.to_logging_column (col, {no_def: true})

		return log

	}

}