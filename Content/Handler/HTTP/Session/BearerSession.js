const HTTP = require ('../../HTTP')
const Session = require ('./Session')

module.exports = class extends Session {

	constructor (h, o = {}) {
	
		if (!o.realm) o.realm = 'REQUIRED'
	
		super (h, o)

    	let auth = this.h.http.request.headers.authorization; 
    	
    	if (!auth) {
    		this.h.http.response.setHeader ('WWW-Authenticate', `Bearer realm="${o.realm}"`)
    		throw 401
    	}    	

    	let [sch, token] = auth.split (' ')
    	
    	if (sch != 'Bearer')
    		this.h.http.response.setHeader ('WWW-Authenticate', `Bearer realm="${o.realm}"`)
    		throw 401
    	}

		this.id = token

	}

}