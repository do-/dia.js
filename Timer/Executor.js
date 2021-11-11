const assert       = require ('assert')
const LogEvent     = require ('../Log/Events/Timer.js')
const WrappedError = require ('../Log/WrappedError.js')

module.exports = class {

	constructor (timer, options) {

		assert (timer, 'timer not set')
		
		this.todo             = this.get_todo (options)
		assert.strictEqual (typeof this.todo, 'function')
		
		this.timer            = timer
		this.timer.executor   = this
		
		this.is_busy          = false
		this.is_to_reset      = false

		this.result           = null
		this.error            = null
		this.cnt_fails        = 0

	}		
	
	async run (parent_log_event) {
	
		if (!this.is_ok_to_run (parent_log_event)) return

		this.is_busy = true
		this.result  = null
		this.error   = null

		const {timer} = this 

		timer.next = Date.now () + timer.get_period ()
		
		this.log_event = timer.log_write (new LogEvent ({
		    ...timer.log_meta,
		    parent: parent_log_event,
			phase: 'before',
			label: 'run () called, next time may be at ' + new Date (timer.next).toJSON ()
		}))

		try {

			this.result = await this.todo ({log_meta: {
				...timer.log_meta,
				category: 'app',
				parent: parent_log_event,
			}})
			
			this.cnt_fails = 0
		
		}
		catch (x) {
					
			this.report_error (x)			
		
		}
		finally {

			this.is_busy = false

			timer.log_finish (this.log_event)
			
			this.log_event = null

			this.reset_if_needed ()

		}

	}
	
	reset_if_needed () {
	
		if (!this.is_to_reset) return
		
		this.is_to_reset = false
		
		this.timer.in (0, 'Reset, because invoked during `run ()`')
	
	}
	
	pause_if_needed () {

		const {timer} = this, {tolerance} = timer, {cnt_fails} = this
		
		if (timer.o.stop_on_error) timer.clear ('Stop on error')

		if (tolerance == null) return

		if (tolerance > cnt_fails) return
		
		let label = 'After ' + cnt_fails + ' fail' 
		
		if (cnt_fails > 1) label += 's'
		
		label += ', the tolerance is exhausted. The timer will be paused.'

		timer.log_write (this.log_event.set ({label}))
	
		timer.pause (this.error)

	}
	
	report_error (x) {
	
		this.error = x
		this.cnt_fails ++
		
		const {timer} = this, {log_meta} = timer, {log_event} = this, {category} = log_event
		
		timer.log_write (new WrappedError (x, {log_meta: {
			...timer.log_meta,
			parent: this.log_event
		}}))

		this.pause_if_needed ()

	}
	
	get_todo (options) {

		const {todo} = options

		if (Array.isArray (todo) && v.length === 2) {

			const [clazz, params] = todo

			if (!params.conf)  params.conf  = this.timer.conf

			if (!params.pools) params.pools = params.conf.pools

			return this.construct_todo (clazz, params)

		}
		
		return todo
	
	}
	
	construct_todo (clazz, params) {
	
		return () => new Promise ((ok, fail) => {
					
			let h = new clazz (params, ok, fail)
			
			h.timer = this.timer
	
//			this.timer.log ('launching request ' + h.uuid)
	
			h.run ()
	
		})
	
	}
	
	is_ok_to_run (log_event) {return (true
	
		&& this.is_not_busy   (log_event)
		
		&& this.is_not_paused (log_event)
	
	)}

	is_not_busy (log_event) {
	
		if (!this.is_busy) return true
		
		if (this.is_to_reset) {

			log_info (log_event, 'run () was called when running and ready to reset')

		}
		else {

			this.is_to_reset = true

			log_info (log_event, 'run () was called when running, reset planned')

		}
		
		return false

	}
	
	is_not_paused (log_event) {
	
		if (!this.timer.is_paused ()) return true
		
		log_info (log_event, 'run () was called when paused, bailing out')

		return false

	}	

	log_info (log_event, label) {

		this.timer.log_write (log_event.set ({
			label, 
			phase: 'progress'
		}))

	}
	
}