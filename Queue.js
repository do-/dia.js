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

    	let	{name, type, action, label, period, tolerance, ts_scheduled_field, from, to} = o

    	if (ts_scheduled_field) this.ts_scheduled_field = ts_scheduled_field

    	let todo = async (log_meta) => {
				
			try {

				await this.do_main_job (log_meta)

			}
			finally {
			
				const {timer} = this; if (!timer.scheduled_event) try {

					let is_empty = await this.is_empty ()

					if (is_empty === false) timer.in (0, 'invoked because the queue is not empty')

				}
				catch (x) {
					darn (x)
				}
			
			}
			
		}

		let oo = {conf, name, label, period, todo, from, to}

		for (let k of ['tolerance', 'on_change']) if (k in o) oo [k] = o [k]

		this.timer = new Timer (oo)

	}
	
	to_record () {
	
		return this.timer.to_record ()
	
	}

	is_paused () {
	
		return this.timer.is_paused ()
	
	}

	pause () {
	
		return this.timer.pause ()
	
	}

	resume () {
	
		return this.timer.resume ()
	
	}
	
	async do_main_job (log_meta) {
	
    	let	
    	
    		{o, conf, timer} = this, 
    		
    		{type, action} = o,

			rq = {type, action},
			
			handler = conf.get_default_handler (rq), 
			
			pools   = conf.get_default_pools (rq), 
			
			user    = conf.get_default_user (rq),
			
			list    = await this.fetch ()
			
		if (list != null) {
				
			if (list.length == 0) return this.timer.log ('the queue is empty')

			rq.data = list [0]

			let {ts_scheduled_field} = this; if (ts_scheduled_field) {

				let ts_scheduled = rq.data [ts_scheduled_field]

				let dt = new Date (ts_scheduled)
				
				let comment = 'the queue contains ' 
				
				try {

					comment += JSON.stringify (rq.data)

				}
				catch (x) {

					comment += `{${ts_scheduled_field}: '${ts_scheduled}', ...}`

				}
				
				{

					let extra = list.length - 1; 

					if (extra > 0) comment += ' and ' + extra + ' more record' 

					if (extra > 1) comment += 's' 

				}

				if (dt > new Date ()) return this.timer.at (dt, comment)

			}

			rq.list = list
		
		}
			
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

	async fetch () {

		let {fetch} = this.o; if (!fetch) return null

		let list = await fetch ()
		
		return list

	}
	
	async init () {
	
		let {o, timer} = this, {cron} = o
		
		if (cron) {
		
			this.set_cron (cron)
		
		}
		else {
		
			let is_empty = await this.is_empty ()

			if (is_empty !== true) // skip autostart only when definitly empty, run it for undefined etc.
		
			this.timer.in (0, 'invoked at queue startup')
				
		}

	}

}