const EventEmitter = require ('events')
const LogEvent     = require ('./Log/Events/Timer.js')
const ErrorEvent   = require ('./Log/Events/Error.js')
const WrappedError = require ('./Log/WrappedError.js')
const PlannedEvent = require ('./Timer/PlannedEvent.js')

const Dia = require ('./Dia.js')

const MAX_INT = 2147483647

module.exports = class extends EventEmitter {

	////////// Reading params

	constructor (o) {
		
		super ()
		
		if (!(this.conf = o.conf)) throw new Error ('Sorry, conf is now mandatory here')
		
		if (o.on_change) this.addListener ('change', o.on_change)
		
		this.name = o.name; if (!this.name) throw new Error ('Timer name not set')
		
		this.o = o
		
		this.conf.add_timer (this)
		
		for (let k of ['period', 'delay']) o [k] = this.zero_or_more (o [k])
		
		this._is_paused = !!o.is_paused
		
		this._cnt_fails = 0
		
		this.log_meta = {
			...(o.log_meta || {}),
			timer: this
		}
		
		{
		
			let K = 'tolerance'; if (K in o) {
			
				let v = o [K]
				
				if (typeof v == 'string') v = parseInt (v)

				if (!(v >= 0)) throw new Error (`Illegal ${K} value for ${this.name}: '${o[K]}'`)

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
		
		this.lambda = () => this.run ()

		this.is_to_reset = false

		this.scheduled_event = null				
		this.running_event = null				

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

    	let r = {}

    	if (this.running_event)   r.is_busy       = true
    	if (this.scheduled_event) r.ts_scheduled  = this.scheduled_event.date.toJSON ()
    	if (this.next)            r.ts_closest    = new Date (this.next).toJSON ()
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
		
		this.emit ('change', state, this.name)
	
	}	

	////////// Logging

	log (s, ms, log_event) {

		let m = !ms ? '' : ': ' + new Date (ms).toJSON ()

		m += ' ' + s
		
    	this.log_write (new LogEvent ({
    		...this.log_meta,
    		parent: log_event,
			label: m
		}))

	}

    log_write (e) {

    	this.conf.log_event (e)

    	return e
    
    }
    
	log_start (label) {
		
    	return this.log_write (new LogEvent ({
    		...this.log_meta,
    		parent: null,
			phase: 'before',
			label
		}))

	}

    log_finish (e) {
        	
    	return this.log_write (e.finish ())

    }
			
	////////// Setting up

	clear (comment) {

		let {scheduled_event} = this
		
		if (scheduled_event) scheduled_event.cancel (comment)	
	
	}
	
	in (ms, comment) {

		this.at (Date.now () + ms, comment)

	}
	
	on (comment) {

		this.in (this.o.delay, comment)

	}
	
	at (ts, comment) {
	
		if (comment == null) {
		
			comment = `at (${ts}) called`
			
			let s = (new Error ('?')).stack.split (/[\n\r]+/).slice (1).find (s => !/Timer.js:/.test (s))
			
			if (s) {
			
				let a = s.split (/[\(\)]/); if (a.length === 3) comment += ' from ' + a [1]

			}

		}

		new PlannedEvent (this, ts instanceof Date ? ts : new Date (ts), comment)

	}	

	try_reset () {

		let {running_event} = this; if (running_event == null) return false

		return running_event.try_reset ()

	}

	get_period () {
	
		let {period} = this.o, {length} = period
		
		let i = this._cnt_fails || 0; if (i >= length) i = length - 1
	
		return period [i]
	
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

		let {log_meta, conf} = this

		log_meta.parent = x.parent || log_event

		conf.log_event (new WrappedError (x, {log_meta}))

		if (this.o.stop_on_error) this.clear ('Stop on error')

		this.error = x
	
	}
		
	finish () {

		if (this.tick ()) return

		let {o: {done, fail}, result, error} = this; if (!done) return

		if (error) return fail (error)

		done (result)

	}

	promise (comment) {

		return new Promise ((done, fail) => {

			let {o} = this

			o.stop_on_error = true

			o.done = done
			o.fail = fail

			this.on (comment || 'Starting as Promise')

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
		
		this.clear ('Pause')

	}

	resume () {
	
		let {_wh_paused} = this

		this._is_paused = false
		this._ts_paused = null
		this._er_paused = null
		this._wh_paused = null
		
		if (_wh_paused) this.at (_wh_paused, 'Was paused, resuming')
	
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
				
		this.at (when, 'Tick occured')
		
		return when
	
	}

}