const Event = require ('../Event.js')

module.exports = class extends Event {

    constructor (o) {

		if (!o.request) throw new Error ('Request handler not provided')
		
		o.uuid = o.request.uuid

		super (o)
		
	}

	get_message () {
	
		switch (this.phase) {
		
			case 'before' : return ''

			case 'after'  : return super.get_message ()
			
			default:

				let {method_name, rq, user, session} = this.request

				return [
					method_name,
					JSON.stringify (rq),
					user ? user.id || user.uuid : null,
					session ? session.id : null,
				].filter (i => i).join (' ')
				
		}

	}

}