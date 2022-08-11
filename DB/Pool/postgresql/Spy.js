module.exports = class extends require ('../../Spy.js') {

    constructor (o = {}) {

		super (o)
		
		this.setting_name = o.setting_name || 'dia.request'

		this.columns._uuid.COLUMN_DEF = 'uuid_generate_v4 ()'
		this.columns._ts.COLUMN_DEF   = 'now()'		
	
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
    
    get_sql_params (handler) {
    
    	return {

    		sql    : 'SELECT set_config (?, ?, false)',

    		params : [

    			this.setting_name,

    			JSON.stringify (this.get_signature (handler)),

    		]

    	}

    }

}