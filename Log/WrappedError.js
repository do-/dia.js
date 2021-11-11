module.exports = class extends Error {

    constructor (e, o = {}) {

		super (e.message)

		this.stack = e.stack
		this.level = 'error'
		
		const {log_meta} = o, {parent} = log_meta

		this.path     = parent.path		
		this.category = parent.category

		for (let [k, v] of [...Object.entries ({...e, ...(o.log_meta || {})})])

			if (!(k in this) && v !== undefined) 
				
				this [k] = v

	}

	get_sigil () {
		return '!'
	}
	
}