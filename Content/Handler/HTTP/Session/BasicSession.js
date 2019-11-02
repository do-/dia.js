const HTTP = require ('../../HTTP')
const Session = require ('./Session')

module.exports = class extends Session {

	constructor (h, o = {}) {
	
		if (!o.realm) o.realm = 'REQUIRED'
	
		super (h, o)

    	let auth = this.h.http.request.headers.authorization; 
    	
    	if (!auth) {
    		this.h.http.response.setHeader ('WWW-Authenticate', `Basic realm="${o.realm}"`)
    		throw 401
    	}    	

    	let [sch, b64] = auth.split (' '); if (sch != 'Basic') return

    	[this.login, this.password] = new Buffer (b64, 'base64').toString ('utf-8').split (':')

	}

}