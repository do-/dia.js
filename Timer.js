const LogEvent = require ('./Log/Events/Text.js')
const ErrorEvent = require ('./Log/Events/Error.js')
const WrappedError = require ('./Log/WrappedError.js')

const Dia = require ('./Dia.js')

module.exports = class {

	zero_or_more (p) {
	
		if (Array.isArray (p)) return p.map (i => i === null ? null : this.zero_or_more (i))

		if (p == null) return 0
		
		if (typeof p !== 'number') p = parseInt (p)
		
		if (isNaN (p)) return 0
		
		return p < 0 ? 0 : p

	}

	constructor (o) {
		
		if (!(this.conf = o.conf)) throw new Error ('Sorry, conf is now mandatory here')

		this.o = o
		
		this.conf.add_timer (this)
		
		for (let k of ['period', 'delay']) o [k] = this.zero_or_more (o [k])
		
		this._is_paused = !!o.is_paused
		
		this._cnt_fails = 0

		if (!o.log_meta) o.log_meta = {}
		if (!o.log_meta.category) o.log_meta.category = 'queue'
		
		{
		
			let K = 'tolerance'; if (K in o) {
			
				let v = o [K]
				
				if (typeof v == 'string') v = parseInt (v)

				if (!(v >= 0)) throw new Error (`Illegal ${K} value for ${o.name}: '${o[K]}'`)

				this [K] = v

			}			
			
		}
		
		if (!Array.isArray (o.period)) o.period = [o.period]
		
		{
		
			let {period} = o, {length} = period; if (period [length - 1] == null) {
			
				period.pop (); for (let i of period) if (i == null) throw new Error ('Only last period value may be set as null')
				
				let tolerance = length
				
				if ('tolerance' in this) {

					if (this.tolerance != tolerance) throw new Error (`Contradicting tolerance values: ${this.tolerance} vs. ${tolerance}`)

				}
				else {
				
					this.tolerance = tolerance
					
				}				
			
			}
		
		}
				
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
				
        this.uuid = Dia.new_uuid ()

		this.log_label = [this.uuid, o.name, 'timer: '].join (' ')
		
		this.locks = {}
		
	}
	
	is_paused () {
		return !!this._is_paused
	}
	
	pause () {
		this._is_paused = true
	}

	resume () {
	
		this._is_paused = false
		
		if (this.check_reset ()) return
		
		let {when} = this
		
		this.clear ()
		
		this.at (when)
	
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
		clearTimeout (this.t)
		delete this.t
		delete this.when
	}
	
	in (ms) {
	
		this.log (`in (${ms}) called`)

		if (ms < 0) ms = 0

		let when = ms + Date.now ()
		
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

		if (this.when) {
					
			this.log (`was scheduled at ${new Date (this.when)}...`)

			if (this.when <= when) {
			
				this.log ('...already going to happen, so nothing to do here')

				return 

			}
			else {

				this.log ('...cancelling obsolete schedule')

				this.clear ()

			}

		}
		
		if (this.is_busy) {

			this.log ('busy...')

			let {is_reset_to} = this; 
			
			if (is_reset_to >= when) {
			
				this.log ('nothing to do: was already reset to', new Date (is_reset_to))
				
				return

			}
			else {

				this.is_reset_to = when

				return this.log ('reset, now quitting')

			}

		}
		
		if ('t' in this) throw new Error ('at this point, no way the timer could be set')
		
		this.when = when
		
		let cb = () => this.run (), delta = this.when - Date.now ()
		
		if (delta > 2147483647) throw new Error ('Sorry, delays as big as ' + delta + ' ms are not supported. The maximum is 2147483647 ms ~ 24.8 days')

		this.t = delta <= 0 ? setImmediate (cb) : setTimeout (cb, delta)

		this.log ('scheduled at', this.when)

	}
	
	on () {

		this.in (this.o.delay)

	}
	
	at (when) {

		if (when instanceof Date) when = when.getTime ()
		
		this.in (when - Date.now ())

	}

	to_record () {

    	let {next, when, is_busy, o} = this, {name, label, delay, period} = o

    	const toJSON = t => !t ? null : new Date (t).toJSON ()

    	return {name, label, delay, period,
    		is_busy      : !!is_busy,
    		ts_scheduled : toJSON (when),
    		ts_closest   : toJSON (next),
    	}

	}
	
	report_result (result) {
	
		this.result = result
	
		this._cnt_fails = 0
	
	}

	report_error (x) {
		
		this._cnt_fails ++

		if ('tolerance' in this && this._cnt_fails >= this.tolerance) {

			this.log (`After ${this._cnt_fails} fail(s), the tolerance is exhausted. The timer will be paused.`)
	
			this.pause ()

		}

		let {o, conf} = this, {log_meta} = o

		if (x.parent) log_meta.parent = x.parent

		conf.log_event (new WrappedError (x, {log_meta}))

		if (this.o.stop_on_error) this.clear ()

		this.error = x
	
	}
	
	get_period () {
	
		let {period} = this.o, {length} = period
		
		let i = this._cnt_fails || 0; if (i >= length) i = length - 1
	
		return period [i]
	
	}

	async run () {
	
		if (this.is_paused ()) {
		
			this.log ('run () called when paused, bailing out')
			
			return
		
		}
		
		if (this.is_busy) {

			this.log ('run () called when busy, going to reset...')
			
			this.on ()
			
			return this.log ('...reset done, exiting run ()')

		}
	
		this.next = Date.now () + this.get_period ()
		
		let log_meta = clone (this.o.log_meta)
	
		log_meta.parent = this.log ('run () called, next time may be at', this.next)
		
		this.is_busy = true
		
		{

			this.clear ()
			
			delete this.result

			try {
				
				let result = await this.o.todo (log_meta)
			
				this.report_result (result)

			}
			catch (x) {

				this.report_error (x)

			}
			
		}

		delete this.is_busy
		
		this.check_reset ()
		
		if (!this.when) this.finish ()

	}
	
	check_reset () {
	
		const K = 'is_reset_to'
		
		let when = this [K]; if (!when) return null
		
		delete this [K]
		
		this.log ('about to reset...')			

		this.at (when)
		
		return when
	
	}
	
	set_ticker (v) {
	
		this.o.ticker = v
		
		this.tick ()
	
	}
	
	get_next_tick () {
	
		let {ticker} = this.o; if (!ticker) return null
		
		return ticker ()
	
	}
	
	tick () {
	
		let when = this.get_next_tick (); if (!when) return null
		
		this.clear ()
		
		this.at (when)
		
		return when
	
	}

	finish () {
	
		if (this.tick ()) return

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