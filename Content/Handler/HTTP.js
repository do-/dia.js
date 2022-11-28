const Dia = require ('../../Dia.js')
const url  = require ('url'), {URLSearchParams} = url
const Handler = require ('../Handler')
const stream = require ('stream')
const contentDisposition = require ('content-disposition')

const bfj = require ('bfj'), BFJ_THRESHOLD = 1e6

class HttpError extends Error {

	constructor (line) {
	
		super (line.slice (4))
		
		this.http_line = line
		
		this.code = parseInt (line.slice (0, 3))
		
		this.is_not_an_error = this.code < 400 || this.code == 401
	
	}
	
}

exports.Handler = class extends Handler {

    to_error (x) {
    
    	if (typeof x == 'string' && /^\d\d\d /.test (x)) return new HttpError (x)

    	return super.to_error (x)
    	    	    	
    }

    check () {
        if (!this.http.request) throw '400 Empty http_request'
        if (!this.http.response) throw 'Empty http_response'
    }

    get_ttl () {
    	return 10000
    }

    async get_http_request_body (rq) {

    	let charset = this.get_charset ()

        return new Promise ((ok, fail) => {
        
            let body = '';
            
            rq.on ('data',  b => {
            	try {
	            	body += b.toString (charset)
	            }
            	catch (x) {
            		fail (x)
            	}            
            })
        
        	rq.on ('end' , () => {ok (body)})
        
        })    

    }

    get_charset () {
    	const default_charset = 'utf-8'
    	let s = this.http.request.headers ['content-type']
    	if (s == null) return default_charset
    	for (let part of s.split (/; /)) if (part.match (/^charset=/)) return part.substr (8)
    	return default_charset
    }
    
    get_content_type () {
    	let s = this.http.request.headers ['content-type']
    	if (s == null) return null
    	return s.split (';') [0]
    }
    
    parse_http_request_body_application_json () {

        try {
            let o = JSON.parse (this.body)
            if (Array.isArray (o)) throw '400 A plain object, not an array expected'
            for (let i in o) this.rq [i] = o [i]
        }
        catch (x) {
            throw '400 Broken JSON'
        }

    }

    parse_http_request_body_application_x_www_form_urlencoded () {
    
        try {
        
	    	new URLSearchParams (this.body).forEach ((v, k) => {
	    	
	    		switch (k) {
	    			case '__json': 
	    				this.rq = {...this.rq, ...JSON.parse (v)}
	    				break
	    			default:
	    				this.rq [k] = v
	    		}
	    	
	    	})
	    	
        }
        catch (x) {
            throw '400 Broken request'
        }

    }

    parse_http_request_body () {
    
    	switch (this.get_content_type ()) {
    		case 'application/json': return this.parse_http_request_body_application_json ()
    		case 'application/x-www-form-urlencoded': return this.parse_http_request_body_application_x_www_form_urlencoded ()
    	}
        
    }
    
    parse_x_headers () {
        let h = this.http.request.headers
        const pre = 'x-request-param-'
        const len = pre.length
        for (let k in h) if (k.substr (0, len) == pre) this.rq [k.substr (len)] = h [k]
    }
    
    get_restored_http_request () {

    	const crlf = "\r\n"

    	let rq = this.http.request

		let s = rq.method + ' ' + rq.url + ' HTTP/' + rq.httpVersion + crlf

		for (let k in rq.headers) {

			s += k.split ('-').map (t => t.charAt(0).toUpperCase () + t.substr (1).toLowerCase ()).join ('-')

			s += ': ' + rq.headers [k] + crlf

        }

		return s + crlf + this.body

    }

	async check_http_request_body_json () {

		const len = this.http.request.headers ['content-length']; if (parseInt (len) < BFJ_THRESHOLD) return false
	
		try {
		
			const o = await bfj.parse (this.http.request)

			if (Array.isArray (o)) throw '400 A plain object, not an array expected'

			for (let i in o) this.rq [i] = o [i]
			
			return true

		}
		catch (x) {
		
			throw '400 Broken JSON'
		
		}
	
	}
	
	async check_http_request_body () {
	
		const {method} = this.http.request; if (method !== 'POST' && method !== 'PUT') return
		
		if (this.get_content_type () === 'application/json' && bfj && await this.check_http_request_body_json ()) return

		this.body = await this.get_http_request_body (this.http.request)

		this.parse_http_request_body ()

	}
    
    async read_params () {
        
        this.rq = {}
        
        await this.check_http_request_body ()

        new URLSearchParams (url.parse (this.http.request.url).search).forEach ((v, k) => this.rq [k] = v)
        
        this.parse_x_headers ()

    }

    get_method () {

        if (!this.module_name) throw '204 No content for you'

        return super.get_method ()
    
    }
    
    get_log_banner () {
        let b = super.get_log_banner ()
        if (!this.session) return b
        return `${b} [${this.session.id ? this.session.id : 'NO SESSION'}]`
    }

    send_out_json (code, data) {
        let rp = this.http.response
        rp.statusCode = code
        rp.setHeader ('Content-Type', 'application/json')
        rp.end (JSON.stringify (data))
    }

    send_out_text (s) {
        let rp = this.http.response
        rp.statusCode = s.substr (0, 3)
        rp.setHeader ('Content-Type', 'text/plain')
        rp.end (s.substr (4))
    }
    
    send_out_stream (data) {
        let rp = this.http.response
        rp.statusCode = 200
        data.pipe (rp)
    }

    send_out_data (data) {
    
		if (data instanceof stream.Readable) {
	        this.send_out_stream (data)
		}
		else {
	        this.send_out_json (200, this.to_message (data))
		}
		
    }

    log_error (e) {

    	if (e.http_line && e.is_not_an_error) return

    	super.log_error (e)

    }

    send_out_error (x) {

        if (this.is_sent) return; this.is_sent = 1

    	let {http_line} = x; if (http_line) return this.send_out_text (http_line)
    	
    	if (x.is_validation_error) {
    		
    		let {field, message} = x;
    		
    		return this.send_out_json (422, {field, message})
    	
    	}

        this.send_out_json (500, this.to_fault (x))

    }

    to_message (data) {return {
        success: true, 
        content: data 
    }}

    to_fault (x) {return {
        success: false, 
        id: this.uuid, 
        dt: new Date ().toJSON ()
    }}
    
    no_user () {
    	if (this.is_anonymous ()) return undefined
		throw '401 Unauthorized'
    }
    
    set_download_headers (o, size) {
    
    	if (typeof o == 'string') o = {filename: o, size}
    
    	let rp = this.http.response
    	
		rp.setHeader ('Content-Type', 'application/octet-stream')
		
		for (let [k, n] of [
			['size',     'Content-Length'],
			['encoding', 'Content-Encoding'],
		]) if (o [k]) rp.setHeader (n, o [k])

		rp.setHeader ('Content-Disposition', contentDisposition (o.filename || o.file_name))

    }

}