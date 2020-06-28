const Dia = require ('../../Dia.js')

module.exports = class extends Dia.DB.Client {

    async release (success) {
/*    
        if (this.backend.is_txn_pending) try {        
            await this.finish_txn (success)
        }
        catch (x) {
            darn (x)
        }
*/

        this.backend.release ()
        
        return

    }
    
    log_label (sql, params) {
    
    	return (this.log_prefix || '') + sql.replace (/^\s+/g, '').replace (/\s+/g, ' ') + ' ' + JSON.stringify (params)
    
    }

    async select_hash (sql, params) {
    
        let label = (this.log_prefix || '') + sql.replace (/^\s+/g, '').replace (/\s+/g, ' ') + ' ' + JSON.stringify (params)
        
        console.time (label)

    	return new Promise ((ok, fail) => {
    	
			this.backend.query (sql, params, function (x, all, fields) {
			
				console.timeEnd (label)
						
				return x ? fail (x) : ok (all [0] || {})

			})

    	})
    
    }
    
    async select_all (sql, params) {
    
        let label = (this.log_prefix || '') + sql.replace (/^\s+/g, '').replace (/\s+/g, ' ') + ' ' + JSON.stringify (params)
        
        console.time (label)

    	return new Promise ((ok, fail) => {
    	
			this.backend.query (sql, params, function (x, all, fields) {
			
				console.timeEnd (label)
						
				return x ? fail (x) : ok (all)

			})

    	})
    
    }

/*    
    async select_stream (sql, params, o) {
    	
        let label = (this.log_prefix || '') + sql.replace (/^\s+/g, '').replace (/\s+/g, ' ') + ' ' + JSON.stringify (params)
        
        console.time (label)
        
    	let stream = this.backend.query (sql, params).stream (o)
    	
    	stream.on ('end', () => console.timeEnd (label))
    	
    	return stream

    }
*/
}