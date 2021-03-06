const LogEvent = require ('./Log/Events/Text.js')
const ErrorEvent = require ('./Log/Events/Error.js')
const WrappedError = require ('./Log/WrappedError.js')

const Dia = require ('./Dia.js')

module.exports = class {

	constructor (o) {
		
		if (!(this.conf = o.conf)) throw new Error ('Sorry, conf is now mandatory here')
		
		if (!o.log_meta) o.log_meta = {}
		if (!o.log_meta.category) o.log_meta.category = 'queue'

		o.period = (p => {
		
			if (p == null) return 0
			
			if (typeof p !== 'number') p = parseInt (p)
			
			if (isNaN (p)) return 0
			
			return p < 0 ? 0 : p
			
		}) (o.period)

		if (Array.isArray (o.todo)) {

			let [clazz, params] = o.todo; o.todo = () => new Promise ((ok, fail) => {
			
				if (!params.conf) params.conf = this.conf
				if (!params.pools) params.pools = params.conf.pools

				let h = new clazz (params, ok, fail)
				
				h.timer = this

				this.log ('launching request ' + h.uuid)

				h.run ()

			})

		}
		
		if (typeof o.todo != 'function') throw new Error ("No valid `todo` set. Got options: " + JSON.stringify (o))
		
		this.o = o
		
        this.uuid = Dia.new_uuid ()

		this.log_label = [this.uuid, o.label, 'timer: '].filter (i => i).join (' ')
		
		this.locks = {}
		
	}

	log (s, ms) {

		let m = this.log_label + s

		if (ms) {
			m += ' '
			m += new Date (ms).toJSON ()
		}
		
    	this.conf.log_event (new LogEvent ({
    		...this.o.log_meta,
			label: m
		}))

	}
	
	from_to (from, to) {
		this.log (`from_to (${from}, ${to}) called`)
		this.o.from = from
		this.o.to   = to
		this.log ('o = ' + JSON.stringify (this.o))
	}
	
	clear () {
		if (!this.t) return
		clearTimeout (this.t)
		delete this.t
		delete this.when
	}
	
	in (ms) {
	
		this.log (`in (${ms}) called`)

		if (ms < 0) ms = 0

		let when = ms + new Date ().getTime ()
		
		this.log ('the desired time is', when)

		if (this.next && when < this.next) {
		
			when = this.next
			
			this.log ('adjusted to the next period', when)
		
		}

		if (this.o.from) {
		
			this.log (`checking for ${this.o.from}..${this.o.to}`)

			let dt         = new Date (when)

			let hhmmss     = dt.toJSON ().slice (11, 19)

			let ge_from    = this.o.from <= hhmmss
			let le_to      =                hhmmss <= this.o.to
			
			let is_one_day = this.o.from <= this.o.to
			
			let is_in      = is_one_day ? ge_from && le_to : ge_from || le_to
			
			if (!is_in) {
			
				this.log (`${dt} is out of ${this.o.from}..${this.o.to}, adjusting`)
				
				if (is_one_day && !le_to) dt.setDate (1 + dt.getDate ())
				
				let [h, m, s] = this.o.from.split (':')
				
				dt.setHours   (h)
				dt.setMinutes (m)
				dt.setSeconds (s)				
				
				when = dt.getTime ()
			
				this.log ('adjusted to time window', when)
			
			}
						
		}

		if (this.t) {
					
			if (this.when <= when) return this.log (`already scheduled at ${new Date (this.when)}, exiting`)

			this.log ('cancelling previous schedule at', this.when)

			this.clear ()

		}
		
		if (this.is_busy) {

			this.log ('busy...')

			let is_reset_to = this.is_reset_to
			
			if (is_reset_to >= when) return this.log ('nothing to do: was already reset to', is_reset_to)
			
			this.is_reset_to = when

			return this.log ('reset, now quitting')

		}		

		this.t = setTimeout (() => this.run (), when - new Date ().getTime ())

		this.log ('now scheduled at', this.when = when)
		
	}
	
	on () {

		this.in (0)

	}
	
	at (when) {

		if (when instanceof Date) when = when.getTime ()
		
		this.in (when - new Date ().getTime ())

	}	
	
	get () {
	
		return new Date (this.when)
	
	}

	async run () {
	
		if (this.is_busy) {

			this.log ('run () called when busy, going to reset...')
			
			this.on ()
			
			return this.log ('...reset done, exiting run ()')

		}
	
		this.next = new Date ().getTime () + this.o.period
	
		this.log ('run () called, next time may be at', this.next)
		
		this.is_busy = 1
		
		{

			this.clear ()

			try {
			
				delete this.result

				this.result = await this.o.todo ()

			}
			catch (x) {

				let {o, conf} = this, {log_meta} = o

		    	conf.log_event (new WrappedError (x, {log_meta}))

				if (this.o.stop_on_error) {

					this.clear ()

					delete this.when

				}

				this.error = x

			}
			
		}

		delete this.is_busy
		
		let when = this.is_reset_to; if (when) {

			this.log ('about to reset...')			

			delete this.is_reset_to

			this.at (when)

		}
		
		if (!this.t && !this.when) this.finish ()

	}

	finish () {

		let {o, result, error} = this, {done, fail} = o

		if (error) {

			if (fail) fail (error)

		}
		else {

			if (done) done (result)

		}

	}

	promise () {

		return new Promise ((done, fail) => {

			let {o} = this

			o.stop_on_error = true

			o.done = done
			o.fail = fail

			this.on ()

		})

	}
	
	lock (keys) {

		let l = []
		
		let max = this.o.max_locks

		for (let k of keys) {

			if (max > 0 && Object.keys (this.locks).length >= max) break

			if (k in this.locks) continue
			
			let v = {
				key: k,
				acquire: () => v,
				release: () => {delete this.locks [k]}
			}
			
			l.push (this.locks [k] = v)

		}

		return l

	}

}