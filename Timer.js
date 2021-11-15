const assert       = require ('assert')
const EventEmitter = require ('events')
const LogEvent     = require ('./Log/Events/Timer.js')
const ErrorEvent   = require ('./Log/Events/Error.js')
const PlannedEvent = require ('./Timer/PlannedEvent.js')
const TimeSlot     = require ('./Timer/TimeSlot.js')
const Pause        = require ('./Timer/Pause.js')
const Executor     = require ('./Timer/Executor.js')
const TimerPromise = require ('./Timer/Promise.js')
const Throttle     = require ('./Timer/Throttle.js')

const Dia = require ('./Dia.js')

const MAX_INT = 2147483647

module.exports = class extends EventEmitter {

	////////// Reading params

	constructor (o) {
		
		super ()

        this.uuid = Dia.new_uuid ()
		
		assert (this.conf = o.conf, 'conf not set')
		assert (this.name = o.name, 'name not set')
		
		this.conf.add_timer (this)

		if (o.on_change) this.addListener ('change', o.on_change)

		this.from_to (o.from, o.to)
					
		this.log_meta = {...(o.log_meta || {}), timer: this}

		this.scheduled_event = null				
		this.running_event   = null		
		
		new Executor (this, o)		
		this.executor.on ('finish', () => this.finish ())

		new Throttle (this, o)
		
		this.current_pause   = null
		if (o.is_paused) this.pause ()

		if (o.ticker)    this.set_ticker (o.ticker)

	}
	
	* adjusters () {
	
		yield this.throttle
		
		const {time_slot} = this; if (time_slot) yield time_slot

	}
	
	from_to (from, to) {

		if (from == null && to == null) return this.time_slot = null

		this.time_slot =

			from == null && to == null ? null :

			new TimeSlot ({from, to})

	}
	
	////////// Presentation

	to_record () {

    	let r = {}, {scheduled_event, running_event, current_pause} = this

    	if (scheduled_event != null) r.ts_scheduled = scheduled_event.date.toJSON ()    
    	if (running_event   != null) r.is_busy      = true    	
		if (current_pause   != null) current_pause.append_info (r)

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

		let {scheduled_event} = this; if (scheduled_event == null) return null 
		
		return scheduled_event.cancel (comment)
	
	}
	
	in (ms, comment) {

		this.at (Date.now () + ms, comment)

	}
	
	on (comment) {

		this.in (0, comment)

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
	
	is_idle () {

		if (this.scheduled_event != null) return false
		
		if (this.running_event != null) return false
		
		if (this.executor.is_to_reset) return false
		
		return true

	}
		
	finish () {

		if (!this.is_idle ()) return

		if (this.tick ()) return
		
		this.emit ('stop')

	}

	promise (comment) {

		return new TimerPromise (this, comment)

	}

	////////// Pause

	is_paused () {
	
		return this.current_pause != null
	
	}
	
	pause (error) {

		if (!this.is_paused ()) new Pause (this, {error})

	}

	resume (comment) {

		const {current_pause} = this; if (current_pause != null) current_pause.cancel ()

	}
	
	////////// Ticker

	set_ticker (v) {
	
		this.ticker = v
		
		this.tick ('ticker setup')
	
	}
	
	get_next_tick () {
	
		if (this.is_paused ()) return null
	
		let {ticker} = this; if (!ticker) return null
		
		return ticker ()
	
	}
	
	tick (comment) {
	
		let when = this.get_next_tick (); if (!when) return null
				
		this.at (when, comment || 'tick occured')
		
		return when
	
	}

}