const HTTP = require ('../HTTP')
const fs   = require ('fs')
const path = require ('path')
const zlib = require ('zlib')

module.exports = class extends HTTP.Handler {

	get_module_name () {}

	get_method () {return () => {
	
		let url = this.http.request.url
		
		if (url.charAt (1) == '_' && url.charAt (2) == '_') {
			url = '/_/' + url.substr (1).split ('/').slice (1).join ('/')			
		}
		else if (url == '/favicon.ico' || url == '/robots.txt') {
			url = '/_mandatory_content' + url 
		}
		else {
			url = '/index.html'
		}
		
		if (url != '/index.html') this.http.response.setHeader ('Expires', 'Sun, 01 Jan 2119 00:00:00 GMT')
				
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
		case 'txt':
			return 'text/plain'
		case 'svg':
			return 'image/svg+xml'
		case 'png':
			return 'image/png'
		case 'ico':
			return 'image/x-icon'
		default: 
			return 'application/octet-stream'
	}}
	
    send_out_data (fn) {

        let rp = this.http.response
        rp.statusCode = 200
        rp.setHeader ('Content-Type', this.mime (fn.split ('.').pop ()))

		let str = fs.createReadStream (fn)
		
		if (/gzip/.test (this.http.request.headers ['accept-encoding'])) {
			rp.setHeader ('Content-Encoding', 'gzip')
			str = str.pipe (zlib.createGzip ())
		}
		
		return str.pipe (rp)

    }
    
    get_log_banner () {
        return this.http.request.url
    }

}