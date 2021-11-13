const assert  = require ('assert')
const MESSAGE = Symbol.for ('message')

module.exports = class {

    constructor (o = {}) {

		this.category = o.category || 'app'

	}
	
	after_category (e) {
		
		try {

			const {uuid, category, parent, level, path, resource_name, message} = e
			
			const carp = s => {		
				try {				
					return s + ': ' + JSON.stringify (e)
				}
				catch (x) {
					try {				
						return s + ': ' + JSON.stringify ({uuid, category, parent, level, path, resource_name, message})
					}
					catch (x) {
						return s
					}
				}			
			}

			assert (level    != null, carp ('Level not set'))
			assert (category != null, carp ('Category not set'))
			assert (path     != null, carp ('Path not set'))

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
		catch (x) {
		
			console.error (x)
		
		}

	}
	
	transform (e) {

		e [MESSAGE] = new Date ().toISOString () + ' ' + e.category + ' ' + this.after_category (e)

		return e

	}
	
	write (e) {

		console.log (this.category + ' ' + this.after_category (e))

	}

}