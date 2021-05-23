const Event = require ('../Event.js')

module.exports = class extends Event {

    constructor (o) {

		let {request} = o; if (!request) throw new Error ('Request handler not provided')
		
		for (let k of ['uuid', 'method_name', 'rq', 'user', 'session']) o [k] = request [k]
		
		delete o.request

		super (o)
		
	}

	get_message () {
	
		switch (this.phase) {
		
			case 'before' : return ''

			case 'after'  : return super.get_message ()
			
			case 'params' : 

				let {method_name, rq} = this

				return [
					method_name,
					JSON.stringify (rq),
				].join (' ')
				
			case 'user' : 

				let {user, session} = this

				return [
					user ? user.id || user.uuid : null,
					session ? session.id : null,
				].filter (i => i).join ('@')
				
		}

	}

}