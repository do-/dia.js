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
    
    async acquire (o = {}) {

    	return new Promise ((ok, fail) => {

    		this.backend.getConnection ((x, raw) => {

    			if (x) return fail (x)
    		
		        let c = new wrapper (raw)

        		c.model = this.model
		    	c.log_meta = o.log_meta
        		
        		ok (c)
        
    		})
    	
    	})

    }

    async release (client) {
        return client.release ()
    }
    
    gen_sql_recreate_views () {

        let result = []
        
        for (let name in this.model.views) {
        
        	let view = this.model.views [name]; view.depends = {}
        	
        	for (let word of view.sql.split (/\b/))
        	
        		if (this.model.views [word])

        			view.depends [word] = 1

        }
        
        let names = [], idx = {}
        
        let assert = name => {
        
        	if (idx [name]) return
        
        	for (let k in this.model.views [name].depends) assert (k)
        	
        	idx [name] = names.push (name)

        }
        
        for (let name in this.model.views) assert (name)

		let views = names.map (i => this.model.views [i])

        while (views.length && views [0]._no_recreate) views.shift ()

        result.push ({sql: `DROP VIEW IF EXISTS ${views.map (i => i.name)} CASCADE`, params: []})

        for (let view of views) {
            
            result.push ({sql: `CREATE VIEW ${view.name} AS ${view.sql}`, params: []})
            
        }

        return result

    }    
        
}