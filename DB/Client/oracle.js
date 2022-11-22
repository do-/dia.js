const Dia = require ('../../Dia.js')
const {Transform} = require ('stream')

module.exports = class extends Dia.DB.Client {

    async release (success) {
            
        let {backend} = this
        
    	try {
	        await backend.close ()
    	}
    	catch (x) {
    		darn (['Failed to close connection', backend, x])
    	}
    
    }
    
    async break () {
    	
    	try {
	        await this.backend.break ()
    	}
    	catch (x) {
    		this.warn ('' + x)
    	}
    	
    }

    async commit () {
        return this.backend.commit ()
    }
    
    async rollback () {
        return this.backend.rollback ()
    }
    
    fix_sql (original_sql) {    
        let parts = original_sql.split ('?')
        let sql = parts.shift ()
        let cnt = 0
        for (let part of parts) sql += `:${++cnt}${part}`        
        return sql    
    }

    to_limited_sql_params (original_sql, original_params, limit, offset) {
        let params = original_params.slice ()
        params.push (offset)
        params.push (limit + offset)
        const V = '"_row_num"'
        return [`SELECT t.* FROM (SELECT t.*, ROWNUM AS ${V} FROM (${original_sql}) t) t WHERE ${V} BETWEEN ? AND ?`, params]
    }

    async select_stream (original_sql, params, o = {}) {
    	
        let sql = this.fix_sql (original_sql)
        
        let log_event = this.log_start (sql, params)

		let is = this.backend.queryStream (sql, params)
    	
    	is.on ('end', () => this.log_finish (log_event))
    	
    	if (!('transform' in o)) {

			let cols; is.on ('metadata', m => cols = m.map (({name}) => name.toLowerCase ()))

			o.transform = new Transform ({

				objectMode: true,

				transform (a, encoding, callback) {

					let r = {}; for (let i = 0; i < cols.length; i ++) {

						let v = a [i]

						if (v != null && v instanceof Date) {

							let s = v.toISOString ()

							v = 
								v.getHours () > 0 ? s :
								v.getMinutes () > 0 ? s :
								v.getSeconds () > 0 ? s :
								v.getMilliseconds () > 0 ? s :
								s.slice (0, 10)

						}

						r [cols [i]] = v

					}

					callback (null, r)

				}

			})
			
	    	is.on ('error', e => o.transform.destroy (e))

    	}

		return o.transform ? is.pipe (o.transform) : is

    }

    async do (original_sql, params = []) {

        let sql = this.fix_sql (original_sql)

        let log_event = this.log_start (sql, params)
        
        try {
	        await this.backend.execute (sql, params)
        }
        finally {
			this.log_finish (log_event)
        }

    }

}