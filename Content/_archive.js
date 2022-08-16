const assert    = require ('assert')
const is_object = i => typeof i === 'object'
const is_ods_dw = i => is_object (i) && i.product === 'ods_dw'

module.exports = {
    
////////////////////////////////////////////////////////////////////////////////

do_copy__archive:

    async function () {

    	const {rq: {id}} = this
    	
    	const db_fed = Object.values (this).find (is_ods_dw); if (!db_fed) throw new Error ('ods_dw resource not found')

    	return db_fed.warehouse (`UPDATE ${id} SET _is_copied = true WHERE _is_to_copy AND NOT _is_copied RETURNING *`)

    },

////////////////////////////////////////////////////////////////////////////////
	
do_purge__archive:

	async function () {

		const {rq: {id}} = this

    	const db_fed = Object.values (this).find (is_ods_dw); if (!db_fed) throw new Error ('ods_dw resource not found')

    	const db = Object.values (this).find (i => is_object (i) && i.model === db_fed.model.ods_model); if (!db) throw new Error ('ods resource not found')

		return db.delete (id, {_is_to_delete: true}, {vacuum: true})

	},

}