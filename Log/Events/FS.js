const {Transform} = require ('stream')
const Event = require ('../Event.js')

module.exports = class extends Event {

    constructor (o) {

		if (!o.file_id) throw new Error ('File ID not provided')
		if (!o.action) throw new Error ('Action not provided')
		
		super ({category: 'f_s', ...o})
		
		if (this.action == 'append') this.size = BigInt (0)

	}
	
	get_meter () {
	
		this.size = BigInt (0)
	
		let me = this

		return new Transform ({transform (chunk, encoding, callback) {
		
			me.measure (chunk)

			callback (null, chunk)			

		}})        	

	}
		
	set_size (_size) {

		this.size = _size

		return this

	}
	
	measure (chunk) {

		this.size += BigInt (chunk.length)
		
		if (!this.units) this.units = Buffer.isBuffer (chunk) ? 'B' : 'C'

		if (this.action == 'append') {
		
			this.delta = this.size
			
			delete this.size
		
		}		
		
		return this
	
	}

	get_message () {

		let s = super.get_message (); if (s) {

			if (this.phase == 'after') {

				if ('delta' in this) s += ', +' + this.delta + ' ' + (this.units || 'B')

				if ('size'  in this) s += ', ' + this.size + ' B'

			}

			return s

		}

		let {action, file_id} = this
		
		return action + ' ' + file_id

	}

}