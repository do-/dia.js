const Dia = require ('../../../../Dia.js')

module.exports = class {

	constructor (h, o = {}) {
		if (!o.timeout) o.timeout = 15 // min
		this.h = h
		this.o = o
	}

	new_id () {
		return Dia.new_uuid ()
	}

	async start () {
		if (this.id) await this.finish ()
		this.id = this.new_id ()
	}

	async finish () {
		this.old_id = this.id
		delete this.id
	}

	async get_user () {
		return this.user
	}

}
