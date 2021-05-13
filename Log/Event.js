const Dia = require ('../Dia.js')

module.exports = class {

    constructor (o = {}) {

		if (!('level' in o)) o.level = 'info'

		o.ts = new Date ()

		if (!('uuid' in o)) o.uuid = Dia.new_uuid ()

		o.path = []; for (let i = o; i; i = i.parent) o.path.unshift (i.uuid)
		
		if (!o.category) o.category = 'app'

		this.set (o)

	}
	
	finish () {	
	
		let ts_to = new Date ()
		
		return this.set ({
			ts_to,
			duration: ts_to - this.ts,
			phase: 'after',
		})

	} 
	
	get_message () {
		if (this.phase == 'after') return this.duration + ' ms'
		return ''
	}

	set (o = {}) {
	
		for (let k in o) this [k] = o [k]

		this.message = this.get_message ()
	
		return this
	
	}
	
	get_sigil () {

		switch (this.level) {

			case 'error':   return '!'
			case 'warning': return '?'

			default: switch (this.phase) {
				case 'after'  : return '<'
				case 'before' : return '>'
				default       : return '-'
			}

		}

	}

}