module.exports = class extends require ('../../Spy.js') {

    constructor (o = {}) {

		super (o)

		this.setting_name = o.setting_name || 'dia.request'

		this.columns._uuid.COLUMN_DEF = 'uuid_generate_v4 ()'
		
		this.columns._ts.COLUMN_DEF   = 'now()'
		
		this.columns._tg_op = {
			TYPE_NAME: 'char', 
			COLUMN_SIZE: 1, 
			REMARK: 'Триггерная операция', 
			TRG_COLUMN_DEF: 'LEFT (TG_OP, 1)',
		}

		this.columns._is_to_copy = {
			TYPE_NAME: 'bool', 
			COLUMN_DEF: 'true', 
			REMARK: 'true, если запись зафиксирована и готова для архивирования',
		}
	
		this.add_definition (this.get_fetch_function_definition ())

    }
    
    get_fetch_function_name () {
    
    	return ('_get_' + this.setting_name).replace (/\./g, '_')
    
    }

    get_fetch_function_label () {
    
    	return 'Содержимое ' + this.setting_name
    
    }
    
    get_fetch_function_definition () {

    	return {

    		name  : this.get_fetch_function_name (),

    		label : this.get_fetch_function_label (),
    		
    		returns: 'jsonb',

			body: `
				BEGIN
					RETURN CURRENT_SETTING ('dia.request')::jsonb;
				EXCEPTION
					WHEN OTHERS THEN RETURN JSONB_BUILD_OBJECT ();
				END;
			`    		

    	}

    }

	to_logging_column (col, o = {}) {

		let c = super.to_logging_column (col, o)

		if (/^serial/i.test (c.TYPE_NAME)) c.TYPE_NAME = 'INT'
		
		if ('getter' in col) {

			c.TRG_COLUMN_DEF = `(_s->>'${c.name}')`

			if (!/(text|char|string)/i.test (c.TYPE_NAME)) c.TRG_COLUMN_DEF += `::${c.TYPE_NAME}`

		}
		else if ('TRG_COLUMN_DEF' in col) {
		
			c.TRG_COLUMN_DEF = col.TRG_COLUMN_DEF
			
		}

		return c

	}
    
    get_sql_params (handler) {
    
    	return {

    		sql    : 'SELECT set_config (?, ?, false)',

    		params : [

    			this.setting_name,

    			JSON.stringify (this.get_signature (handler)),

    		]

    	}

    }
    
	to_logging_table (def) {
	
		let logging_table = super.to_logging_table (def)
		
		if (!def.triggers) def.triggers = {}
		
		def.triggers.after_update_insert_delete = this.to_watching_trigger (logging_table)
		
		return logging_table
	
	}   
	
	to_insert_statement (record, logging_table) {

		let src = [], dst = []

		for (const {name, TYPE_NAME, TRG_COLUMN_DEF, COLUMN_DEF, getter} of Object.values (logging_table.columns)) {
		
			let value; if (name in this.columns) {

				value = TRG_COLUMN_DEF || COLUMN_DEF

				if (value == null) {

					darn (`Bizarre field: ${logging_table.name}.${name}, never to be set`)

					continue

				}

			}
			else {

				value = record + '.' + name

			}

			src.push (value)
			dst.push (name)			

		}

		return `INSERT INTO ${logging_table.name} (${dst}) VALUES (${src})`

	}
	
	is_nothing_changed (cols) {
	
		return cols
		
			.map (i => `NEW.${i} IS NOT DISTINCT FROM OLD.${i}`)
			
				.join (' AND ')
	
	}
	
	to_watching_trigger (logging_table) {
	
		let watched_cols = []; for (const name in logging_table.columns) if (!(name in this.columns)) watched_cols.push (name)

		return `
			
			DECLARE				
				_s JSONB;
			
			BEGIN

				IF TG_OP = 'UPDATE' AND ${this.is_nothing_changed (watched_cols)} THEN
					RETURN NEW;
				END IF;
				
				_s = ${this.get_fetch_function_name ()} ();

				IF TG_OP = 'DELETE' THEN
					${this.to_insert_statement ('OLD', logging_table)};
				ELSE
					${this.to_insert_statement ('NEW', logging_table)};
				END IF;

				RETURN NEW;
			
			END;

		`
	
	}
	
}