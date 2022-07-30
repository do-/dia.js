const wrapper = require ('../Client/ods_dw.js')

module.exports = class extends require ('../Pool.js') {

    constructor (o) {

        super (o)

        const [ods_name, dw_name] = o.connectionString.slice ('ods_dw://'.length).split ('+')
        
        this.ods_name = ods_name
        this.dw_name = dw_name

    }

    async acquire (o = {}) {    
		return this.inject (new wrapper ({}), o)
    }

    async release (client) {
    }

}