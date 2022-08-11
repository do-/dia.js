const DEFAULT_SETTING_NAME = 'dia.request'

module.exports = class extends require ('../../Spy.js') {

    constructor (o = {}) {

		super (o)
		
		this.setting_name = o.setting_name || DEFAULT_SETTING_NAME

		this.columns._uuid.COLUMN_DEF = 'uuid_generate_v4 ()'
		this.columns._ts.COLUMN_DEF   = 'now()'

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