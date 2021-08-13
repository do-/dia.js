module.exports = class extends Error {

    constructor (e, o = {}) {

		super (e.message)

		this.stack = e.stack

		this.path = [o.log_meta.parent]
		
		for (let [k, v] of [...Object.entries ({...e, ...o})]) 
		
			if (!(k in this) && v !== undefined) 
				
				this [k] = v

	}

	get_sigil () {
		return '!'
	}
}