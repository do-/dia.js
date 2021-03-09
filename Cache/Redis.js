const Cache = require ('../Cache')
const redis  = require ('redis')

module.exports = class extends Cache {

    constructor (a) {

    	super (a)

    	this.ttl /= 1000

        this._ = redis.createClient (this.redis)

    }
    
    cb (ok, fail) {
    	return (x, d) => (x ? fail (x) : ok (d))    	
    }
    
    async to_del (k) {
    	
    	if (k == null) return
    	
    	let v = await this.to_get (k)
    
    	if (v != null) await new Promise ((ok, fail) => {
			this._.del (k, this.cb (ok, fail))
    	})
    	
    	return v
    	
    }

    async to_set (k, v) {

    	await new Promise ((ok, fail) => {
			this._.set (k, JSON.stringify (v), 'EX', this.ttl, this.cb (ok, fail))
    	})
    	
    	return v
    
    }    
    
    async to_get (k) {

    	let v = await new Promise ((ok, fail) => {
			this._.get (k, this.cb (ok, fail))
    	})
    	
    	return JSON.parse (v)
                        
    }

    async to_get_all_keys (k) {

        let v = await new Promise ((ok, fail) => {
            this._.keys ("*", this.cb (ok, fail))
        })

        return v

    }

}