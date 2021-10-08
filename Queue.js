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

    	let	{name, type, action, label, period, delay} = o
    	    	
    	let todo = async (log_meta) => {
				
			try {
				await this.do_main_job (log_meta)
			}
			finally {
			
				try {

					let is_empty = await this.is_empty ()

					if (is_empty === false) // reset when definitly not empty, not undefined etc.
		
					this.timer.in (0)

				}
				catch (x) {
					darn (x)
				}
			
			}
			
		}
			
		this.timer = new Timer ({conf, name, label, period, todo, delay}) 
		
	}
	
	to_record () {
	
		return this.timer.to_record ()
	
	}
	
	async do_main_job (log_meta) {
	
    	let	
    	
    		{o, conf, timer} = this, 
    		
    		{type, action} = o,

			rq = {type, action},
			
			handler = conf.get_default_handler (rq), 
			
			pools   = conf.get_default_pools (rq), 
			
			user    = conf.get_default_user (rq) 
			
		return new Promise ((ok, fail) => {
			(new handler ({rq, pools, conf, user, timer, log_meta, queue: this}, ok, fail)).run ()
		})
	
	}

	set_ticker (v) {

		this.timer.set_ticker (v)

	}
	
	set_cron (cron) {
	
		let gen = this.conf.get_cron_parser ()
		
		let ticker = gen (cron)
		
		this.set_ticker (ticker)

	}
	
	async is_empty () {

		let {is_empty} = this.o;

		switch (typeof is_empty) {
			case 'function' : return is_empty ()
			default         : return is_empty
		}

	}
	
	async init () {
	
		let {o, timer} = this, {cron} = o
		
		if (cron) {
		
			this.set_cron (cron)
		
		}
		else {
		
			let is_empty = await this.is_empty ()

			if (is_empty !== true) // skip autostart only when definitly empty, run it for undefined etc.
		
			this.timer.in (0)
				
		}

	}

}