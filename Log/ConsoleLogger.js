module.exports = class {

    constructor (o = {}) {

		this.category = o.category || 'app'
		
	}
	
	write (e) {

		console.log ([
			this.category,
			e.level,
			e.path.join ('/'),
			e.resource_name,
			e.get_sigil (),
			e.message,
		].filter (i => i != null && i != '').join (' '))

	}
	
}