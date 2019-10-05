const Cache = require ('../Cache')
const memcached  = require ('memcached')

module.exports = class extends Cache {

    constructor (o) {
    
    	super (o)

        this._ = new memcached (this.memcached)

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
			this._.set (k, v, this.ttl / 1000, this.cb (ok, fail))
    	})
    	
    	return v
    
    }    
    
    async to_get (k) {

    	return new Promise ((ok, fail) => {
			this._.get (k, this.cb (ok, fail))
    	})
                        
    }

}