const LogEvent      = require ('../Log/Events/Timer.js')

const MAX_INT = 2147483647

const ST_NEW        = 0
const ST_SCHEDULED  = 1
const ST_CANCELLING = 2
const ST_RUNNING    = 3
const ST_FINISHED   = 4

const STATUS_LABEL = [
	'ST_NEW',
	'ST_SCHEDULED',
	'ST_CANCELLING',
	'ST_RUNNING',
	'ST_FINISHED',
]

module.exports = class {

	constructor (timer, date, label) {

		this.status      = ST_NEW		

		if (!timer) throw new Error ('timer not set')
		if (!date instanceof Date) throw new Error ('date must be Date')
		if (!label || typeof label !== 'string') throw new Error ('Invalid label')
	
		this.timer       = timer
		this.date        = date
		this.label       = label

		this.is_to_reset = false
		
		this.log_event   = this.timer.log_start (label)
		
		this.schedule ()

	}
		
	///// Logging

	log_time_shift (label) {
	
		this.log_info (
			this.date.toJSON () + ' '  + label
		)
	
	}
	
	log_info (label) {

		this.timer.log_write (this.log_event.set ({
			label, 
			phase: 'progress'
		}))

	}
	
	///// Workflow

	set_status (s) {
	
		if (!Number.isInteger (s)) throw new Error ('Invalid status: ' + s)

		let status_label = STATUS_LABEL [s]; if (status_label == null) throw new Error ('Invalid status: ' + s)

		this.status = s
		
		let {timer} = this
		
		if (this.status === ST_SCHEDULED) {		
			timer.scheduled_event = this		
		}
		else if (timer.scheduled_event === this) {		
			timer.scheduled_event = null
			this.timeout     = null
			this.date        = null		
		}

		if (this.status === ST_RUNNING) {		
			timer.running_event = this		
		}
		else if (timer.running_event === this) {		
			timer.running_event = null
			this.is_to_reset = false		
		}
		
//		this.log_info ('Switched to ' + status_label)

		timer.notify ()

	}

	finish (note) {

		if (note != null) this.log_info (note)

		this.set_status (ST_FINISHED)

		this.timer.log_finish (this.log_event)

	}
	
	schedule () {
	
		if (this.status !== ST_NEW) throw new Exception ('Wrong status:' + this.status)
	
		this.adjust ()

		const delta = this.date.getTime () - Date.now ()

		const lambda = () => {		
			this.timeout = null
			this.date    = null
			this.run ()
		}

		if (delta > MAX_INT) {
			this.date    = null
			this.finish ()
			throw new Error ('Sorry, delays as big as ' + delta + ' ms are not supported. The maximum is ' + MAX_INT + ' ms ~ 24.8 days')
		}
		
		let {timer} = this, {scheduled_event} = timer; if (scheduled_event) {
		
			let {date} = scheduled_event; if (date.getTime () <= this.date.getTime ()) {

				return this.finish ('Was already scheluled at ' + date.toJSON () + ', bailing out.')

			}
			else {

				this.log_info (`Conflicting event ${scheduled_event.log_event.uuid} detected: it was scheduled at ${date.toJSON ()}, current target is ${this.date.toJSON ()}, cancel it`)

				scheduled_event.cancel ()

			}

		}

		this.timeout = delta <= 0 ? setImmediate (lambda) : setTimeout (lambda, delta)

		this.set_status (ST_SCHEDULED)
		
		this.log_info ('Scheduled at' + this.date.toJSON ())
	
	}

	cancel (note) {

		switch (this.status) {
			case ST_CANCELLING : return
			case ST_SCHEDULED  : break
			default            : throw new Exception ('Wrong status:' + this.status)
		}

		let message = 'cancel requested'; if (note) message += ': ' + note

		this.log_info (message)
		this.set_status (ST_CANCELLING)
		
		clearTimeout (this.timeout)
		
		this.finish ()

	}

	try_reset () {
	
		switch (this.status) {

			case ST_RUNNING: 
				this.log_info ('run () called when already running, reset planned')
				this.is_to_reset = true
				return true

			default:
				return false

		}

	}

	async run () {

		if (this.status !== ST_SCHEDULED) throw new Exception ('Wrong status:' + this.status)
		
		const {timer} = this

		if (timer.try_reset ()) return this.finish ('try_reset () returned true, bailing out') 

		this.set_status (ST_RUNNING)

		if (timer.is_paused ()) return this.finish ('run () called when paused, bailing out') 

		timer.next = Date.now () + timer.get_period ()

		let log_event = timer.log_write (new LogEvent ({
		    ...timer.log_meta,
		    parent: this.log_event,
			label: 'run () called, next time may be at ' + new Date (timer.next).toJSON ()
		}))

		try {
			
			timer.result = null
	
			let result = await timer.o.todo ({log_meta: {
				...timer.log_meta,
				category: 'app',
				parent: log_event,
			}})
			
			timer.report_result (result)

		}
		catch (x) {
			
			timer.report_error (x, this.log_event)

		}
		finally {

			timer.log_finish (log_event)
			
			if (this.is_to_reset) timer.in (0, 'Reset, because invoked during `run ()`')

			this.finish ()
			
			if (this.scheduled_event == null && this.running_event == null) timer.finish ()

		}

	}

	///// Time adjustment		

	adjust () {

		this.log_time_shift ('is requested')

		this.adjust_to_nearest_available ()

		this.adjust_to_time_frame ()

	}

	adjust_to_nearest_available () { // If the next good moment is later, use it instead
	
		const {date, timer: {next}} = this
		
		if (next == null) return
		if (next <= date.getTime ()) return
	
		this.date = new Date (next)

		this.log_time_shift ('is the nearest available')
	
	}
		
	adjust_to_time_frame () {
	
		const {from, to} = this.timer.o; if (from == null) return
	
		let {date} = this, hhmmss = date.toJSON ().slice (11, 19)

		let ge_from    = from <= hhmmss
		let le_to      =                hhmmss <= to
		
		let is_one_day = from <= to
		
		let is_in      = is_one_day ? ge_from && le_to : ge_from || le_to
		
		if (is_in) return

		if (is_one_day && !le_to) date.setDate (1 + date.getDate ())

		let [h, m, s] = from.split (':')

		date.setHours   (parseInt (h, 10))
		date.setMinutes (parseInt (m, 10))
		date.setSeconds (parseInt (s, 10))
		date.setMilliseconds (0)
		
		this.log_time_shift (`is adjusted to time window ${from}..${to}`)

	}
		
}