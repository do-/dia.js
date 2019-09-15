const HTTP = require ('../HTTP')

exports.Handler = class extends HTTP.Handler {

	get_http_static_server () {
		return this.http_static_server
	}

	get_module_name () {}

	get_method () {
    	return this.get_http_static_server
    }
    
    send_out_data (server) {
		server.serve (this.http.request, this.http.response)
    }

}