const Dia = require ('../Dia.js')

module.exports = class {

    constructor (o = {}) {

		if (!('level' in o)) o.level = 'info'

		o.ts = new Date ()

		if (!('uuid' in o)) {
		
			const {parent} = o; if (parent) {
			
				o.uuid = String (++ parent.cnt_children)
			
			}
			else {

				o.uuid = Dia.new_uuid ()

			}
		
		}

		o.path = []; for (let i = o; i; i = i.parent) o.path.unshift (i.uuid)
		
		if (!o.category) o.category = 'app'

		this.set (o)
		
		this.cnt_children = 0n

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

		let m = this.get_message ()

		if (m) this.message = m

		return this
	
	}
	
	get_sigil () {

		switch (this.level) {

			case 'error' : return '!'
			case 'warn'  : return '?'

			default: switch (this.phase) {
				case 'after'  : return '<'
				case 'before' : return '>'
				case 'auth'   : return 'A'
				default       : return '-'
			}

		}

	}
	
	is_to_skip () {
	
		return false
	
	}

}