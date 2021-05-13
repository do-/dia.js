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
			
			case 'params' : 

				let {method_name, rq} = this.request

				return [
					method_name,
					JSON.stringify (rq),
				].join (' ')
				
			case 'user' : 

				let {user, session} = this.request

				return [
					user ? user.id || user.uuid : null,
					session ? session.id : null,
				].filter (i => i).join ('@')
				
		}

	}

}