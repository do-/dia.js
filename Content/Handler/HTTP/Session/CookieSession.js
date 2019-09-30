const HTTP = require ('../../HTTP')
const Session = require ('./Session')

module.exports = class extends Session {

	constructor (h, o) {
	
		super (h, o)

		if (!o.cookie_name) throw 'cookie_name is not set'
		
		let cookies = this.h.http.request.headers.cookie
		
		if (!cookies) return
		
		for (let chunk of cookies.split (';')) {
			let [k, v] = chunk.trim ().split ('=')
			if (k != o.cookie_name) continue
			this.id = v
			break
		}
		
	}
	
	set_cookie (v) {
		this.h.http.response.setHeader ('Set-Cookie', this.o.cookie_name + '=' + v)
	}

	async start () {
		await super.start ()
		this.set_cookie (this.id + '; HttpOnly')
	}

	async finish () {
		await super.finish ()
		this.set_cookie (this.id + '0; Expires=Thu, 01 Dec 1994 16:00:00 GMT')
	}

}