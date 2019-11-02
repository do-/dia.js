// If you find this weird, read https://stormpath.com/blog/where-to-store-your-jwts-cookies-vs-html5-web-storage

const jwt           = require ('jsonwebtoken')
const CookieSession = require ('./CookieSession')

module.exports = class extends CookieSession {

	constructor (h, o) {
		super (h, o)
		for (let k of ['claim', 'sign', 'verify']) if (!o [k]) o [k] = {}
		o.sign.expiresIn = o.timeout + 'm'
	}
	
	async get_private_key () {
		return 'z'
	}
	
	async get_public_key () {
		return 'z'
	}
		
    async keep_alive () {
    	let c = clone (this.o.claim)
    	c.sub = this.user
		this.id = jwt.sign (c, await this.get_private_key (), this.o.sign)
		this.set_cookie_on ()
    }

    async start () {
        await this.keep_alive ()
    }
    
    async finish () {
    	await super.finish ()
    }

    async get_user () {

        if (!this.id) return this.h.no_user ()
        
        try {
        
        	this.user = jwt.verify (this.id, await this.get_public_key (), this.o.verify).sub

        	await this.keep_alive ()

        	return this.user

        }
        catch (x) {

        	darn (x)

        	return this.h.no_user ()

        }

    }

}