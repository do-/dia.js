const EventEmitter = require ('events')
const LogEvent     = require ('./Log/Events/Timer.js')
const ErrorEvent   = require ('./Log/Events/Error.js')
const WrappedError = require ('./Log/WrappedError.js')
const PlannedEvent = require ('./Timer/PlannedEvent.js')
const TimeSlot     = require ('./Timer/TimeSlot.js')
const Pause        = require ('./Timer/Pause.js')
const Executor     = require ('./Timer/Executor.js')

const Dia = require ('./Dia.js')

const MAX_INT = 2147483647

module.exports = class extends EventEmitter {

	////////// Reading params

	constructor (o) {
		
		super ()
		
		if (!(this.conf = o.conf)) throw new Error ('Sorry, conf is now mandatory here')
		
		if (o.on_change) this.addListener ('change', o.on_change)
		
		this.name = o.name; if (!this.name) throw new Error ('Timer name not set')
		
		{
			
			const {from, to} = o
		
			if (from || to) this.from_to (from, to)

		}
		
		this.o = o
		
		this.conf.add_timer (this)
		
		for (let k of ['period']) o [k] = this.zero_or_more (o [k])
						
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

        this.uuid = Dia.new_uuid ()

		this.scheduled_event = null				
		this.running_event   = null
		
		this.current_pause   = null
		
		new Executor (this, {todo: o.todo})
		
		if (o.is_paused) this.pause ()

	}
	
	zero_or_more (p) {
	
		if (Array.isArray (p)) return p.map (i => i === null ? null : this.zero_or_more (i))

		if (p == null) return 0
		
		if (typeof p !== 'number') p = parseInt (p)
		
		if (isNaN (p)) return 0
		
		return p < 0 ? 0 : p

	}

	from_to (from, to) {

		this.time_slot =

			from == null && to == null ? null :

			new TimeSlot ({from, to})

	}
	
	////////// Presentation

	to_record () {

    	let r = {}, {scheduled_event, running_event, current_pause, next} = this

    	if (scheduled_event != null) r.ts_scheduled = scheduled_event.date.toJSON ()    
    	if (running_event   != null) r.is_busy      = true    	
    	if (next            != null) r.ts_closest   = new Date (next).toJSON ()
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

	get_period () {
	
		let {period} = this.o, {length} = period
		
		let i = this.executor.cnt_fails || 0; if (i >= length) i = length - 1
	
		return period [i]
	
	}
		
	finish () {

		if (this.scheduled_event != null || this.running_event != null) return

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

			this.on (comment || 'starting as Promise')

		})

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
	
		this.o.ticker = v
		
		this.tick ('ticker setup')
	
	}
	
	get_next_tick () {
	
		let {ticker} = this.o; if (!ticker) return null
		
		return ticker ()
	
	}
	
	tick (comment) {
	
		let when = this.get_next_tick (); if (!when) return null
				
		this.at (when, comment || 'tick occured')
		
		return when
	
	}

}