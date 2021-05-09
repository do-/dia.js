module.exports = class {

    constructor (o = {}) {

		this.category = o.category || 'app'
		
	}
	
	write (e) {

		console.log ([
			this.category,
			e.level,
			e.prefix,
//			(e.request ? e.request.get_log_fields () : ''),
			e.path.join ('/'),
			e.resource_name,
//			e.uuid,
			e.get_sigil (),
			e.message,
		].filter (i => i != null && i != '').join (' '))

	}
	
}