const HTTP = require ('../../HTTP')
const WWWAuthSession = require ('./WWWAuthSession')

module.exports = class extends WWWAuthSession {

	get_schema_name () {return 'Bearer'}

}