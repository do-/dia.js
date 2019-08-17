module.exports = class {

    constructor (o) {
        for (let i in o) this [i] = o [i]
        this._ = {}
        if (this.ttl) setInterval (() => this.cleanup (), this.ttl)
    }
    
	time      () { return  new Date ().getTime () }
	
	threshold () { return this.time () - this.ttl }

    del      (k) { delete this._ [k]; return null }
    
    set   (k, v) { this._ [k] = [v, this.time ()] }    

    get (k) {
    
        let [v, t] = this._ [k] || [null, 0]
        
        if (this.ttl && t < this.threshold ()) {
    		darn ('expired ' + this.name + ' ' + k + ': ' + JSON.stringify (this._ [k]))
        	return this.del (k)
		}
		
        return v
        
    }
    
    async to_get (k, f) {
    
        let [v, t] = this._ [k] || [null, 0]
        
        if (this.ttl && t < this.threshold ()) {
    		darn ('expired ' + this.name + ' ' + k + ': ' + JSON.stringify (this._ [k]))
        	return this.del (k)
		}
        
        if (v == null && f) {
        	v = await f (k)
        	if (v == null) return null
        	this.set (k, v)
        }
        
        return v
        
    }
    
    cleanup () {
    
    	darn (this.name + " cleanup started")
    
    	let t = this.threshold ()
		
		for (let k in this._) if (this._ [k] [1] < t) {
    		darn ('expired ' + this.name + ' ' + k + ': ' + JSON.stringify (this._ [k]))
    		delete this._ [k]
    	}
    	
    }

}