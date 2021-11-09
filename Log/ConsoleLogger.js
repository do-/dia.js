const MESSAGE = Symbol.for ('message')

module.exports = class {

    constructor (o = {}) {

		this.category = o.category || 'app'

	}
	
	after_category (e) {

		const {level, path, resource_name, message} = e
		
		let s = level + ' '

		{

			const {length} = path; for (let i = 0; i < length; i ++) {

				if (i > 0) s += '/'

				s += path [i]

			}

		}

		if (resource_name) s += ' ' + resource_name
		
		if ('get_sigil' in e) s += ' ' + e.get_sigil ()

		s += ' ' + message
		
		return s

	}
	
	transform (e) {

		e [MESSAGE] = new Date ().toISOString () + ' ' + e.category + ' ' + this.after_category (e)

		return e

	}
	
	write (e) {

		console.log (this.category + ' ' + this.after_category (e))

	}

}