const Event = require ('../Event.js')

module.exports = class extends Event {

    constructor (o) {
    
		let oo = {}; for (let k in o.o) switch (k) {
			case 'conf':
			case 'log_meta':
				break
			default:
				oo [k] = o.o [k]
		}
		
		let {category, phase} = o

		super ({
			category: category || 'http',
			phase,
			o: oo,
			parent: o.parent,
		})
		
	}

	get_message () {
	
		switch (this.phase) {
			case 'after'            : return super.get_message ()
			case 'before'           : return this.get_request_params ()
			case 'response_headers' : return this.code + ' ' + JSON.stringify (this.response_headers)
			case 'response_body'    : return JSON.stringify (this.response_body)
			default                 : return JSON.stringify ({...this, message: null})
		}

	}
	
	get_request_params () {
	
		let o = clone (this.o)
		
		delete o.url
		
		if (o.auth) o.auth = o.auth.split (':') [0] + ':XXXXXX'
		
		return JSON.stringify (o)
	
	}
						
}