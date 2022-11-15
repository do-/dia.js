const Event = require ('../HTTP.js')
const url   = require ('url')

module.exports = class extends Event {
    
	get_message () {
	
		if (this.is_to_skip ()) return ''

		const {o: {path}, response_headers} = this
		
		this.path.pop ()
		this.path.push (this.uuid = response_headers ['x-clickhouse-query-id'])

		let o = {}, sum = response_headers ['x-clickhouse-summary']
		
		try {

			for (const [k, v] of Object.entries (JSON.parse (sum))) if (v != 0) o [k] = v

		}
		catch (x) {
		
			darn ([x, sum])
		
		}

		try {
		
			const q = new URLSearchParams (path)

			for (const k of ['session_id', 'session_timeout']) if (q.has (k)) o [k] = q.get (k)

		}
		catch (x) {
		
			darn ([x, path])
		
		}

		return JSON.stringify (o)

	}
	
	is_to_skip () {

		return this.phase !== 'response_headers'

	}	
						
}