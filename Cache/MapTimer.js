const Cache = require ('../Cache')

module.exports = class extends Cache {

    constructor (o) {

        super (o)

        this._ = new Map ()

        this._t = new Map ()

    }
    
    clearTimeout (k) {

    	clearTimeout (this._t.get (k))

    	this._t.delete (k)

    }

    async to_del (k) {

    	this.clearTimeout (k)
    	
    	let v = this._.get (k)
    	
    	delete this._.delete (k)

    	return v

    }    
    
    async to_set (k, v) {
    
    	this.clearTimeout (k)
    
    	this._.set (k, v)
    	
    	this._t.set (k, setTimeout (async () => {
    	
    		darn (`${this.name}: ${k} expired`)
    		
    		this.to_del (k)
    	
    	}, this.ttl))

    	return v
    
    }    
    
    async to_get (k, f) {

        return this._.get (k)
                        
    }

}