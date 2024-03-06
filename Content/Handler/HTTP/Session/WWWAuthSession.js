const HTTP = require ('../../HTTP')
const Session = require ('./Session')

module.exports = class extends Session {

	get_schema_name () {throw 'Abstract'}

	constructor (h, o = {}) {

		if (!o.realm) o.realm = 'REQUIRED'

		super (h, o)

		this.schema = this.get_schema_name ()

		this.realm = o.realm || 'REQUIRED'

		let croak = () => {
			this.h.http.response.setHeader ('WWW-Authenticate', `${this.schema} realm="${this.realm}"`)
			throw '401 Unauthorized'
		}

    	let auth = this.h.http.request.headers.authorization

    	if (!auth) return croak ()

    	let [sch, token] = auth.split (' ')

    	if (sch != this.schema) return croak ()

		this.id = token

	}

}