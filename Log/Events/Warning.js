const Event = require ('../Event.js')

module.exports = class extends Event {

    constructor (o) {

		if (!o.label) throw new Error ('Warning message not provided')

		o.level = 'warning'

		let {parent} = o; delete o.parent; if (parent) {
			
			for (let k of ['uuid', 'category', 'parent']) o [k] = parent [k]

		}

		super (o)

	}

	get_message () {
			
		let o = {}, {label} = this
		
		let f = false; for (let k in this) switch (k) {
			case 'category':
			case 'level':
			case 'ts':
			case 'uuid':
			case 'parent':
			case 'label':
			case 'path':
			case 'resource_name':
				break
			default: 
				o [k] = this [k]
				f = true
		}
		
		return !f ? label : label + ' ' + JSON.stringify (o)

	}

}