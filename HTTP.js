const url      = require ('url')
const http     = require ('http')
const https    = require ('https')
const stream   = require ('stream')
const zlib     = require ('zlib')
const LogEvent = require ('./Log/Events/HTTP.js')
const HTTPError = require ('./HTTP/Error.js')
const WarningEvent = require ('./Log/Events/Warning.js')

module.exports = class {

    constructor (o = {}) {
    
    	if (o.url) {
    	
    		let u = url.parse (o.url)
    		
    		for (let k of ['protocol', 'hostname', 'port', 'path']) o [k] = u [k]
    	
    	}
    
        this.o = o
        
    }
        
    async acquire (ao = {}) {
    	
    	let {conf, log_meta} = ao

        return new class {
        
			constructor (o) {
				this.o = o
				this.log_meta = log_meta
				this._requests = []
			}

			async break () {

				for (const rq of this._requests) {

					const {socket} = rq; if (!socket) continue

					try {    	
						socket.destroy ()
					}
					catch (x) {    	
  				  		this.warn ('' + x)						
					}

				}

			}			

			set_parent_log_event (e) {

				let {log_meta} = this

				log_meta.parent = e

				log_meta.category = e.category

				return e

			}

			log_write (e) {

				conf.log_event (e)

				return e

			}
			
			warn (label, o = {}) {

				return this.log_write (new WarningEvent ({
					...(this.log_meta || {}),
					label,
					...o
				}))

			}			
			
			async release () {
				// do nothing
			}			
			
			guess_content_type (c) {
			
				switch (c) {
					case '<':
						return 'text/xml'
					case '{':
					case '[':
						return 'application/json'
					default:
						return 'text/plain'
				}
				
			}
			
			async response (o, body) {

				let rp_body = ''
				
				let rp = await this.responseStream (o, body)

				return new Promise ((ok, fail) => {

					rp.on ('end', () => {

						this.log_write (rp.log_event.set ({
							response_body: rp_body,
							phase: 'response_body',
						}))

						switch (rp.statusCode) {
							case 200 :
							case 201 :
									return ok   (rp_body)
							default  : 
									return fail (new HTTPError (o, rp, rp_body))
						}

					})

					rp.setEncoding ('utf8')							

					rp.on ('data', s => rp_body += s)
				
				})

			}
			
			async responseStream (o, body, log_event) {

				if (o.url) {

					let u = url.parse (o.url)

					for (let k of ['protocol', 'hostname', 'port', 'path']) o [k] = u [k]

				}

				let has_body = body != null
				
				let is_body_stream = has_body && (body instanceof stream.Readable || o.is_body_stream)

				o = Object.assign ({method: has_body ? 'POST' : 'GET'}, this.o, o)
								
				if (has_body && !is_body_stream && !o.headers && body.length > 1) o.headers = {'Content-Type': this.guess_content_type (body.charAt (0))}

				if (!log_event) {

					log_event = this.log_write (new (this.log_meta.event_class || LogEvent) ({
						...(this.log_meta || {}),
						o,
						phase: 'before',
					}))
				
				}
				else {

					this.log_write (log_event.set ({
						o,
						phase: 'retry',
					}))
					
				}

				return new Promise ((ok, fail) => {
					
					try {

						let rq = (/^https/.test (o.protocol) ? https : http).request (o, async rp => {
						
							let code    = rp.statusCode							
							let headers = rp.headers

							this.log_write (log_event.set ({
								code,
								response_headers: headers,
								phase: 'response_headers',
							}))

							{
							
								const 
									CONTENT_ENCODING = 'content-encoding', 
									enc = headers [CONTENT_ENCODING],
									wrapper =
										enc === 'gzip' ? zlib.createGunzip () :
										null
								
								if (wrapper) {
								
									rp = rp.pipe (wrapper)
									
									delete headers [CONTENT_ENCODING]

									rp.headers = headers									
									rp.statusCode = code
								
								}

							}

							rp.on ('error', x => fail (x))
							
							let {location} = headers; if (!location) {

								rp.on ('close', () => {this.log_write (log_event.finish ())})
								
								rp.log_event = log_event

								return ok (rp)

							}
							
				    		let u = url.parse (location)

				    		for (let k of ['protocol', 'hostname', 'port', 'path']) if (u [k]) o [k] = u [k]
				    		
				    		delete o.url

				    		ok (await this.responseStream (o, body))
							
						})
						
						this._requests.push (rq)

						rq.on ('error', x => fail (x))	

						is_body_stream ? body.pipe (rq) : has_body ? rq.end (body) : rq.end ()

					}
					catch (x) {

						fail (x)

					}

				})

			}
        
        } ({...this.o})
        
    }    

}