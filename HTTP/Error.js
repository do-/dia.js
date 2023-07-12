const RE_FAULTSTRING = new RegExp ('<faultstring>([^<]+)<\/')

module.exports = class extends Error {

	constructor (o, rp, rp_body) {

		const {statusCode, statusMessage} = rp

		const status = statusCode + ' ' + statusMessage

		super (status)

		this.code   = statusCode
		this.status = status

		this.body = rp_body.trim ()

		this.parent = rp.log_event

		this.adjust_message ()

	}
	
	adjust_message () {
	
		const {body} = this; if (!body) return
		
		this.message = body
		
		{

			const m = RE_FAULTSTRING.exec (this.message)
			
			if (m) this.message = m [1]

		}	
	
	}

}