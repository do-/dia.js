module.exports = class {

    constructor (o) {

        for (let i in o) this [i] = o [i]

        this._ = {}

        if (this.ttl) this._t = {}

    }
    
    clearTimeout (k) {

    	if (!this.ttl) return

    	clearTimeout (this._t [k])
    	
    	delete this._t [k]
    
    }

    async to_del (k) {

    	this.clearTimeout (k)
    	
    	let v = this._ [k]
    	
    	delete this._ [k]
    	
    	return v

    }    
    
    async to_set (k, v) {
    
    	this.clearTimeout (k)
    
    	this._ [k] = v 
    	
    	if (this.ttl) this._t [k] = setTimeout (async () => {
    	
    		darn (`${this.name}: ${k} expired`)
    		
    		this.to_del (k)
    	
    	}, this.ttl)
    	
    	return v
    
    }    
    
    async to_get (k, f) {

        let v = this._ [k]
                
        if (v != null || !f) return v

		v = await f (k)

		if (v == null) return v

		return await this.to_set (k, v)
        
    }

}