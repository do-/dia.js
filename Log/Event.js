const Dia = require ('../Dia.js')

module.exports = class {

    constructor (o = {}) {

		for (let k in o) this [k] = o [k]

		if (!('level' in this)) this.level = 'info'

		this.ts   = new Date ()
		this.uuid = Dia.new_uuid ()
		
		this.reset_message ()

	}
	
	finish () {
		this.phase = 'after'
		this.ts_to = new Date ()
		this.duration = this.ts_to - this.ts
		this.reset_message ()
		return this
	} 
	
	get_message () {
		if (this.phase == 'after') return this.duration + ' ms'
		return ''
	}

	reset_message () {
		this.message = this.get_message ()
	}
	
	get_sigil () {
		switch (this.phase) {
			case 'after'  : return '<'
			case 'before' : return '>'
			default       : return '-'
		}
	}

}