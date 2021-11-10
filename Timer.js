const EventEmitter = require ('events')
const LogEvent     = require ('./Log/Events/Text.js')
const ErrorEvent   = require ('./Log/Events/Error.js')
const WrappedError = require ('./Log/WrappedError.js')

const Dia = require ('./Dia.js')

const MAX_INT = 2147483647

module.exports = class extends EventEmitter {

	////////// Reading params

	constructor (o) {
		
		super ()
		
		if (!(this.conf = o.conf)) throw new Error ('Sorry, conf is now mandatory here')
		
		if (o.on_change) this.addListener ('change', o.on_change)
		
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

		this.log_label = o.name
		
		this.lambda = () => this.run ()

		this.is_to_reset = false
				
		this.clear ()
		
	}
	
	zero_or_more (p) {
	
		if (Array.isArray (p)) return p.map (i => i === null ? null : this.zero_or_more (i))

		if (p == null) return 0
		
		if (typeof p !== 'number') p = parseInt (p)
		
		if (isNaN (p)) return 0
		
		return p < 0 ? 0 : p

	}

	from_to (from, to) {
		this.o.from = from
		this.o.to   = to
	}
	
	////////// Presentation

	to_record () {

    	let {next, when, is_busy} = this, r = {}
    	
    	if (this.is_busy)    r.is_busy       = true
    	if (this.when)       r.ts_scheduled  = new Date (this.when).toJSON ()
    	if (this.next)       r.ts_closest    = new Date (this.next).toJSON ()
    	if (this._is_paused) {
    		r.is_paused = true
    		if (this._ts_paused) r.ts_paused = new Date (this._ts_paused).toJSON ()
    		if (this._er_paused) r.error     = this._er_paused
    	}

		return r

	}

	notify () {
	
		let state = JSON.stringify (this.to_record ())
		
		if (this._last_state == state) return
		
		this._last_state = state
		
		this.emit ('change', state, this.o.name)
	
	}	

	////////// Logging

	log (s, ms, log_event) {

		let m = this.log_label + ' ' + s

		if (ms) m += ' ' + new Date (ms).toJSON ()
		
    	this.log_write (new LogEvent ({
    		...this.o.log_meta,
    		parent: log_event || this,
			label: m
		}))

	}

    log_write (e) {

    	this.conf.log_event (e)

    	return e
    
    }
    
	log_start (s) {
		
    	return this.log_write (new LogEvent ({
    		...this.o.log_meta,
    		parent: this,
			phase: 'before',
			label: this.log_label + ' ' + s
		}))

	}

    log_finish (e) {
        	
    	return this.log_write (e.finish ())

    }
			
	////////// Calculating moment
	
	apply_from_to (when, log_event) {
	
		const {from, to} = this.o; if (from == null) return when
	
		let dt         = new Date (when)

		let hhmmss     = dt.toJSON ().slice (11, 19)

		let ge_from    = from <= hhmmss
		let le_to      =                hhmmss <= to
		
		let is_one_day = from <= to
		
		let is_in      = is_one_day ? ge_from && le_to : ge_from || le_to
		
		if (is_in) return when

		if (is_one_day && !le_to) dt.setDate (1 + dt.getDate ())

		let [h, m, s] = from.split (':')

		dt.setHours   (parseInt (h, 10))
		dt.setMinutes (parseInt (m, 10))
		dt.setSeconds (parseInt (s, 10))
		dt.setMilliseconds (0)

		when = dt.getTime ()

		this.log (`adjusted to time window ${from}..${to}`, when, log_event)

		return when

	}
	
	apply_prev (when, log_event) { // If it was scheduled earlier, use old value
	
		let prev = this.clear ()
			
		if (prev == null) return when
		if (prev >= when) return when

		this.log ('rolled back to', prev, log_event)

		return prev
	
	}
	
	apply_next (when, log_event) { // If the next good moment is later, use it instead
	
		const {next} = this
		
		if (next == null) return when
		if (next <= when) return when
	
		this.log ('adjusted to the next period', next, log_event)

		return next

	}

	get_nearest_moment (ms, log_event) {

		let when = Date.now ()
		
		if (ms > 0) when += ms

		this.log ('planning to', when, log_event)

		when = this.apply_prev    (when, log_event)
		when = this.apply_next    (when, log_event)
		when = this.apply_from_to (when, log_event)
		
		return when

	}

	////////// Setting up

	clear () {
	
		let {when} = this
		
		clearTimeout (this.t)
		
		this.t    = null
		this.when = null

		return when
	
	}
	
	in (ms) {

		const log_event = this.log_start (`in (${ms}) called`)

		const when = this.get_nearest_moment (ms, log_event)
		
		const delta = when - Date.now (); if (delta > MAX_INT) throw new Error ('Sorry, delays as big as ' + delta + ' ms are not supported. The maximum is ' + MAX_INT + ' ms ~ 24.8 days')

		this.when = when

		this.t = delta <= 0 ?
			setImmediate (this.lambda) : 			
			setTimeout   (this.lambda, delta)

		this.notify ()

		this.log_finish (log_event)

	}
	
	on () {

		this.in (this.o.delay)

	}
	
	at (when) {

		if (when instanceof Date) when = when.getTime ()
		
		this.in (when - Date.now ())

	}	

	////////// Running
	
	get_period () {
	
		let {period} = this.o, {length} = period
		
		let i = this._cnt_fails || 0; if (i >= length) i = length - 1
	
		return period [i]
	
	}

	async run () {

		const was_busy = this.is_busy

		this.is_busy   = true

		this.t         = null

		this.when      = null
	
		if (this.is_paused ()) {
		
			this.is_busy = was_busy

			return this.log ('run () called when paused, bailing out')
			
		}
					
		if (was_busy) {
		
			this.is_to_reset = true

			return this.log ('run () called when busy, noted')
			
		}

		this.next = Date.now () + this.get_period ()

		this.notify ()
		
		const log_event = this.log_start ('run () called, next time may be at ' + new Date (this.next).toJSON ())
	
		let log_meta = {
			...this.o.log_meta,
			category: 'app',
			parent: log_event,
		}

		{
			
			try {
			
				this.result = null
	
				let result = await this.o.todo (log_meta)
			
				this.report_result (result)

			}
			catch (x) {

				this.report_error (x, log_event)

			}
			
		}

		this.is_busy = false
		
		this.notify ()

		if (this.is_to_reset) {
		
			this.in (0)		
		
		}
		else if (!this.when) {
		
			this.finish ()
		
		}
		
		this.log_finish (log_event)

	}

	report_result (result) {
	
		this.result = result
	
		this._cnt_fails = 0
	
	}

	report_error (x, log_event) {
		
		this._cnt_fails ++

		if ('tolerance' in this && this._cnt_fails >= this.tolerance) {

			this.log (`After ${this._cnt_fails} fail(s), the tolerance is exhausted. The timer will be paused.`, null, log_event)
	
			this.pause (x)

		}

		let {o, conf} = this, {log_meta} = o

		log_meta.parent = x.parent || log_event

		conf.log_event (new WrappedError (x, {log_meta}))

		if (this.o.stop_on_error) this.clear ()

		this.error = x
	
	}
		
	finish () {

		if (this.tick ()) return

		let {o: {done, fail}, result, error} = this; if (!done) return

		if (error) return fail (error)

		done (result)

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

	////////// Pause

	is_paused () {
	
		return !!this._is_paused
	
	}
	
	pause (x) {
	
		this._is_paused = true

		this._ts_paused = Date.now ()

		this._wh_paused = this.when

		if (x) this._er_paused = x.message || x
		
		this.clear ()

	}

	resume () {
	
		let {_wh_paused} = this

		this._is_paused = false
		this._ts_paused = null
		this._er_paused = null
		this._wh_paused = null
		
		this.clear ()
		
		if (_wh_paused) this.at (_wh_paused)
	
	}
	
	////////// Ticker

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

}