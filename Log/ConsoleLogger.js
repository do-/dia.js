module.exports = class {

    constructor (o = {}) {

		this.category = o.category || 'app'
		
	}
	
	write (e) {

		let {level, prefix, uuid, phase, request, resource_name, message} = e

		let parts = [level, this.category, prefix]
		
		if (request) parts.push (request.get_log_fields ())

		parts.push (resource_name)
		parts.push (uuid)

		parts.push (
			phase == 'after'  ? '<' : 
			phase == 'before' ? '>' : 
			'-'
		)

		parts.push (message)
		
		console.log (parts.filter (i => i != null).join (' '))

	}
	
}