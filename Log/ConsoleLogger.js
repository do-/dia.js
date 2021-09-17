module.exports = class {

    constructor (o = {}) {

		this.category = o.category || 'app'

	}
	
	transform (e, o = {}) {
	
		e [Symbol.for ('message')] = [
			o.no_ts ? '' : new Date ().toISOString (),
			o.no_category ? '' : e.category,
			e.level,
			e.path.join ('/'),
			e.resource_name,
			e.get_sigil? e.get_sigil () : '',
			e.message,
		].filter (i => i != null && i != '').join (' ')

		return e

	}
	
	write (e) {

		this.transform (e, {no_ts: true, no_category: true})

		console.log (this.category + ' ' + e [Symbol.for ('message')])

	}

}