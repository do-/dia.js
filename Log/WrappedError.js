module.exports = class extends Error {

    constructor (e, o = {}) {

		super (e.message)
		
		for (let [k, v] of [...Object.entries ({...e, ...o})]) 
		
			if (!(k in this) && v !== undefined) 
				
				this [k] = v

	}

}