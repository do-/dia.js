module.exports = class {

    constructor () {
    
    	this.global_definitions = {}

		this.columns = {

/*
			_tg_op:			'char[1] // Триггерная операция',
*/		
			_uuid   : {TYPE_NAME: 'uuid',      REMARK: 'Первичный ключ в самой таблице истории'},
			_ts     : {TYPE_NAME: 'timestamp', REMARK: 'Дата/время события'},

			_id_rq  : {TYPE_NAME: 'uuid',   REMARK: 'Уникальный номер запроса', getter: h => h.uuid},
			_type   : {TYPE_NAME: 'string', REMARK: 'Тип объекта',              getter: h => (h.rq || {}).type},
			_id     : {TYPE_NAME: 'string', REMARK: 'Уникальный номер объекта', getter: h => (h.rq || {}).id},
			_action : {TYPE_NAME: 'string', REMARK: 'Действие',                 getter: h => (h.rq || {}).action},

		}

		this.option_name = 'log'
		this.schema_name = 'log'
		this.archive_table_name_prefix = 'log_'
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
		
		return this.archive_table_name_prefix + '_' + name
		
	}

	to_logging_table_label (label) {
		
		return label + ' (история изменений)'
		
	}
	
	to_logging_column (col, o = {}) {
	
		let c = {}; for (const k of ['name', 'REMARK', 'TYPE_NAME', 'COLUMN_SIZE', 'DECIMAL_DIGITS', 'COLUMN_DEF']) {
		
			if (!(k in col)) continue

			if (o.no_def && k == 'COLUMN_DEF') continue
		
			const v = col [k]
			
			if (v != null) c [k] = v
		
		}
	
		return c
	
	}
	
	to_logging_table (def) {

		const {name, label, columns} = def, options = def [this.option_name], {except_columns} = options
		
		let {pk} = def; if (!Array.isArray (pk)) pk = [pk]; pk.unshift ('_ts')

		let log = {
		
			name  : this.to_logging_table_name (name),
			
			label : this.to_logging_table_label (label),
			
			columns: {},
			
			pk: '_uuid',

			triggers: {},

			archive: {
				name      : this.to_archive_table_name (name),
				pk,
//				threshold : log.threshold,
//				keep      : Object.keys (log.keep).length > 0,
			},

		}
		
		for (const [name, col] of Object.entries (this.columns)) {
		
			if (!('name' in col)) col.name = name
				
			const c = this.to_logging_column (col)
			
			log.columns [c.name] = c
		
		}		

		for (const col of Object.values (columns)) {
		
			if (except_columns && except_columns.includes (col.name)) continue
		
			const c = this.to_logging_column (col, {no_def: true})
			
			log.columns [c.name] = c
		
		}		

		return log

	}

}