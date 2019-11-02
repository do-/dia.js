const http = require ('http')

module.exports = class {

    constructor (conf) {    
    	this.conf = conf
    }
    
	create_http_handler (http) {
	
		// return some ../HTTP.js descendant from here

	}
	
	create_http_server () {

		return http.createServer (
			(request, response) => this.create_http_handler ({request, response}).run ()
		)

	}
	
	async init () {
		
		return new Promise ((ok, fail) => {
		
			(this._ = this.create_http_server ())
				
				.listen (this.conf.listen, x => x ? fail (x) : ok ())
		
		})
	
	}
	
}