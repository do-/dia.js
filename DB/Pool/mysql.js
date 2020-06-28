const mysql = require ('mysql')

const wrapper = require ('../Client/mysql.js')

module.exports = class extends require ('../Pool.js') {

    constructor (o) {
    
        super (o)
        
        let [auth, dsn] = o.connectionString.slice ('mysql://'.length).split ('@')
        
        let [user, password] = auth.split (':')
        let [hp, database] = dsn.split ('/')
        let [host, port] = hp.split (':')

		let co = {host, port, user, password, database, connectTimeout: 1000}

        this.backend = new mysql.createPool (co)

    }
    
    async acquire () {

    	return new Promise ((ok, fail) => {

    		this.backend.getConnection ((x, raw) => {

    			if (x) return fail (x)
    		
		        let c = new wrapper (raw)

        		c.model = this.model
        		
        		ok (c)
        
    		})
    	
    	})

    }

    async release (client) {
        return client.release ()
    }
        
}