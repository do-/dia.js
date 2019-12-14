const url = require ('url')
const http = require ('http')

module.exports = class {

    constructor (o = {}) {
    
    	if (o.url) {
    	
    		let u = url.parse (o.url)
    		
    		for (let k of ['protocol', 'hostname', 'port', 'path']) o [k] = u [k]
    	
    	}
    
        this.o = o
        
    }
    
    async acquire () {

        return new class {
        
			constructor (o) {		
				this.o = o				
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
				}
				
			}
			
			to_error (rp) {

				let x = new Error (rp.statusCode + ' ' + rp.statusMessage)
			
				x.code = rp.statusCode
			
				x.body = rp_body
				
				return x

			}

			async response (o, body) {
			
				let has_body = body != null
			
				o = Object.assign ({method: has_body ? 'POST' : 'GET'}, this.o, o)
				
				if (has_body && !o.headers && body.length > 1) o.headers = {'Content-Type': this.guess_content_type (body.charAt (0))}

				return new Promise ((ok, fail) => {

					darn (this.log_prefix + ' HTTP rq ' + JSON.stringify ([o, body]))

					try {

						let rp_body = ''

						let rq = http.request (o, rp => {

							rp.setEncoding ('utf8')	

							rp.on ('error', x => fail (x))	
							
							rp.on ('data', s => rp_body += s)	

							rp.on ('end', () => {

								darn (this.log_prefix + ' HTTP rp ' + JSON.stringify ([rp.headers, rp_body]))
								
								switch (rp.statusCode) {
									case 200 : return ok   (rp_body)
									default  : return fail (this.to_error (rp))
								}

							})

						})

						rq.on ('error', x => fail (x))	

						has_body ? rq.end (body) : rq.end ()

					}
					catch (x) {

						fail (x)

					}

				})

			}
        
        } (this.o)
        
    }    

}