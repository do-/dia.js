const Event = require ('../Event.js')

module.exports = class extends Event {

    constructor (error) {

		if (!(error instanceof Error)) throw new Error ('Invalid argument: must be an Error')

		let o = {error}
		
		let {log_meta} = error; delete error.log_meta; if (log_meta) {
		
			let {parent} = log_meta; delete log_meta.parent; if (parent) {

				for (let k of ['uuid', 'category', 'parent']) o [k] = parent [k]

			}

			for (let k in log_meta) if (!(k in o)) o [k] = log_meta [k]
		
		}

		o.level = 'error'

		super (o)

	}

	get_message () {
			
		let {error} = this, {message, stack} = error, o = {stack}
		
		let f = false; for (let k in error) switch (k) {
			case 'message':
			case 'path':
				break
			default: 
				o [k] = error [k]
				f = true
		}
		
		return message + ' ' + JSON.stringify (o)

	}

}