module.exports = class {

    constructor (o) {

        for (let i in o) this [i] = o [i]

    }
        
    async to_fetch (k, f) {

        let v = await this.go_get (k)
                
        if (v != null) return v

		v = await f (k)

		if (v == null) return v

		return await this.to_set (k, v)
        
    }

}