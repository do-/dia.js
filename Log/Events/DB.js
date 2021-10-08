const Event = require ('../Event.js')

module.exports = class extends Event {

    constructor (o) {

		if (!o.sql) throw new Error ('SQL not provided')

		super ({category: 'db', ...o})

	}

	get_message () {

		let s = super.get_message (); if (s) return s

		let {sql, params} = this

		s += sql.replace (/\s+/g, ' ').trim ()

		if (params && params.length) s += ' [' + params.map (p => this.param_to_string (p)).join (', ') + ']'

		return s

	}
	
	param_to_string (p) {

		if (p == null) return 'NULL'
		
		switch (p) {
			
			case Infinity: 
				return 'Infinity'
			
			case -Infinity: 
				return '-Infinity'

			default:
				switch (typeof p) {
					case 'boolean' : 
					case 'number'  : 
						return p
					default       : 
						return "'" + ('' + p).replace (/'/g, "''") + "'" //'
				}
				
		}

	}

}