const Event = require ('../Event.js')

module.exports = class extends Event {

    constructor (o) {

		if (!o.label) throw new Error ('Label not provided')

		super (o)
		
	}

	get_message () {
	
		switch (this.phase) {
		
			case 'after'  : return super.get_message ()
			
			default: return this.label
				
		}

	}

}