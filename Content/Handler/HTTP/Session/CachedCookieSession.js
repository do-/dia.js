const CookieSession = require ('./CookieSession')

module.exports = class extends CookieSession {

	constructor (h, o) {	
		super (h, o)
	}
		
    async get_user_by_id () {
		throw 'get_user_by_id is not defined'
    }

    keep_alive () {
    	this.o.sessions.set (this.id, this.user.uuid)
    	return this.user
    }

    async start () {  
        await super.start ()
        this.keep_alive ()
    }
    
    async finish () {            
        await super.finish ()
        this.o.sessions.del (this.id)
    }

    restrict_access () {
    	if (!this.h.is_anonymous ()) throw '401 Authenticate first'
        return undefined
    }
        
    async get_user () {

        if (!this.id) return this.h.no_user ()
        
        let uuid = this.o.sessions.get (this.id)

        if (!uuid) {
        	darn (`session ${this.id} not found`)
        	return this.h.no_user ()
        }
        
        this.user = await this.o.users.to_get (uuid, this.get_user_by_id)

        if (!this.user) {
        	darn (`session ${this.id}: valid user ${uuid} not found`)
        	return this.h.no_user ()
        }

        return this.keep_alive ()
                        
    }

}