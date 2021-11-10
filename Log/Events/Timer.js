const Event = require ('../Event.js')

module.exports = class extends Event {

    constructor (o) {

		const {timer} = o; if (!timer) throw new Error ('Timer not provided')

		o.timer_name = timer.name

		const {uuid} = timer; if (!o.parent) o.parent = {uuid}

		delete o.timer

		if (!o.category) o.category = 'queue'

		super (o)

	}

	get_message () {
	
		switch (this.phase) {
		
			case 'after'  : return super.get_message ()
			
			default: return this.timer_name + ' ' + this.label
				
		}

	}

}