const mssql = require ('mssql')

const wrapper = require ('../Client/mssql.js')

module.exports = class extends require ('../Pool.js') {

    constructor (o) {

        super (o)

        let [auth, dsn] = o.connectionString.slice ('mssql://'.length).split ('@')

        let [user, password] = auth.split (':')
        let [hp, database] = dsn.split ('/')
        let [server, port] = hp.split (':')

		let co = {server, port, user, password, database, connectTimeout: 1000, options: {enableArithAbort: true}}

        this.backend = new mssql.ConnectionPool (co)

    }

    async acquire () {

        let raw = await this.backend.connect ()
        let c = new wrapper (raw)

        c.model = this.model
        return c

    }

    async release (client) {
        return client.release ()
    }

    gen_sql_recreate_views () {
    
    	return Object.values (this.model.views)
    	
    		.map (({name, sql}) => 
    		
    			({sql: `CREATE OR ALTER VIEW ${name} AS ${sql}`})    		
    		
    		)

    }    

}