const HTTP = require ('../HTTP')
const fs   = require ('fs')
const path = require ('path')

module.exports = class extends HTTP.Handler {

	get_module_name () {}

	get_method () {return () => {
	
		let url = this.http.request.url
		
		if (url.charAt (1) == '_' && url.charAt (2) == '_') {
			url = '/_/' + url.substr (1).split ('/').slice (1).join ('/')
		}
		else {
			url = '/index.html'
		}
				
		let abs = path.resolve ('../../front/root' + url)		
		
		if (!fs.existsSync (abs)) throw '404 File Not Found'
		
		return abs
		
	}}
	
	mime (ext) {switch (ext) {
		case 'htm':
		case 'html':
			return 'text/html; charset=utf-8'
		case 'js':
			return 'application/javascript; charset=utf-8'
		case 'css':
			return 'text/css'
		case 'svg':
			return 'image/svg+xml'
		case 'png':
			return 'image/png'
		default: 
			return 'application/octet-stream'
	}}
	
    send_out_data (fn) {
        let rp = this.http.response
        rp.statusCode = 200
        rp.setHeader ('Content-Type', this.mime (fn.split ('.').pop ()))
        rp.end (fs.readFileSync (fn))
    }
    
    get_log_banner () {
        return this.http.request.url
    }

}