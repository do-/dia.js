const Dia = require ('../../Dia.js')

module.exports = class extends Dia.DB.Client {

    async release (success) {

        this.backend.release ()
        
        return

    }
    
    log_label (sql, params) {
    
    	return (this.log_prefix || '') + sql.replace (/^\s+/g, '').replace (/\s+/g, ' ') + ' ' + JSON.stringify (params)
    
    }
    
    async do (sql, params = []) {

        let log_event = this.log_start (sql, params)

    	return new Promise ((ok, fail) => {
    	
			this.backend.query (sql, params, x => {
			
				this.log_finish (log_event)
						
				return x ? fail (x) : ok ()

			})

    	})

    }    

    async select_hash (sql, params) {
    
        let log_event = this.log_start (sql, params)

    	return new Promise ((ok, fail) => {
    	
			this.backend.query (sql, params, (x, all, fields) => {
			
				this.log_finish (log_event)
						
				return x ? fail (x) : ok (all [0] || {})

			})

    	})
    
    }
    
    async select_all (sql, params) {
        
        let log_event = this.log_start (sql, params)

    	return new Promise ((ok, fail) => {
    	
			this.backend.query (sql, params, (x, all, fields) => {
			
				this.log_finish (log_event)
						
				return x ? fail (x) : ok (all)

			})

    	})
    
    }       

    async select_stream (sql, params, o) {
    	
        let log_event = this.log_start (sql, params)
        
    	let stream = this.backend.query (sql, params).stream (o)
    	
    	stream.on ('end', () => this.log_finish (log_event))
    	
    	return stream

    }

}