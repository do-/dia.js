const HTTP = require ('../../HTTP')
const WWWAuthSession = require ('./WWWAuthSession')

module.exports = class extends WWWAuthSession {

	get_schema_name () {return 'Basic'}

	constructor (h, o = {}) {
		
		super (h, o);

    	[this.user, this.password] = Buffer.from (this.id, 'base64').toString ('utf-8').split (':')

	}

}