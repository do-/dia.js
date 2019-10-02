const CookieSession = require ('./CookieSession')

module.exports = class extends CookieSession {

	constructor (h, o) {
		if (!o.timeout && o.sessions.ttl) o.timeout = o.sessions.ttl / 60000
		super (h, o)
	}
		
    async keep_alive () {
    	return await this.o.sessions.to_set (this.id, this.user)
    }

    async start () {
        await super.start ()
        await this.keep_alive ()
    }
    
    async finish () {
    	Promise.all ([
    		super.finish (),
    		this.o.sessions.to_del (this.id)
    	])
    }

    async get_user () {

        if (!this.id) return this.h.no_user ()
        
        if (this.user = await this.o.sessions.to_get (this.id)) return this.keep_alive ()

		darn (`session ${this.id} not found`)
		
		return this.h.no_user ()

    }

}