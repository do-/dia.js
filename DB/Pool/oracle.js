const oracledb = require ('oracledb')
oracledb.autoCommit = true;

const wrapper = require ('../Client/oracle.js')

module.exports = class extends require ('../Pool.js') {

    constructor (o) {

        super (o)

        let [auth, connectionString] = o.connectionString.slice ('oracle://'.length).split ('@')

        let [user, password] = auth.split (':')
        
        this._pool_options = {user, password, connectionString}

    }

    async acquire (o = {}) {

		if (!this.backend) this.backend = await oracledb.createPool (this._pool_options)    
		
		let raw = await this.backend.getConnection ()
		
		await raw.ping ()
    
		return this.inject (new wrapper (raw), o)

    }

    async release (client) {    
        await client.release ()
    }

}