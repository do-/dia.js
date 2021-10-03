const Timer = require ('./Timer.js')

module.exports = class {

	constructor (o) {
	
		let {conf} = o; if (!(this.conf = conf)) throw new Error ('conf not set')
		delete o.conf

    	if (!o.name && o.type) o.name = o.type
    	if (!o.type && o.name) o.type = o.name
    	
		if (!(this.name = o.name)) throw new Error ('no name nor type is set: ' + JSON.stringify (o))

		if (!o.action) o.action = 'check'

		this.o = o

		conf.add_queue (this)

    	let	{name, type, action, label, period} = o
    	    	
    	let

			rq = {type, action},
			
			handler = conf.get_default_handler (rq), 
			
			pools   = conf.get_default_pools (rq), 
			
			user    = clone (conf.get_default_user (rq)), 
			
			todo    = [handler, {rq, pools, conf, user}]
			
		this.timer = new Timer ({conf, name, label, period, todo}) 
		
	}

	set_ticker (v) {

		this.timer.set_ticker (v)

	}
	
	set_cron (cron) {
	
		let gen = this.conf.get_cron_parser ()
		
		let ticker = gen (cron)
		
		this.set_ticker (ticker)

	}
	
	async init () {
	
		let {o, timer} = this, {cron} = o
		
		if (cron) {
		
			this.set_cron (cron)
		
		}
		else {
		
			this.timer.on ()
		
		}

	}

}