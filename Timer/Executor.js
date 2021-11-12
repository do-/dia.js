const assert       = require ('assert')
const EventEmitter = require ('events')
const LogEvent     = require ('../Log/Events/Timer.js')
const WrappedError = require ('../Log/WrappedError.js')

module.exports = class extends EventEmitter {

	constructor (timer, options) {

		assert (timer, 'timer not set')
		
		super ()
		
		this.todo             = this.get_todo (options)
		assert.strictEqual (typeof this.todo, 'function')
		
		this.timer            = timer
		this.timer.executor   = this
		
		this.is_busy          = false
		this.is_to_reset      = false

		this.result           = null
		this.error            = null
		
		this.on ('error',  error => this.log_error (error))
		this.on ('finish',    () => this.reset_if_needed ())

	}		
	
	async run (parent_log_event) {
	
		if (!this.is_ok_to_run (parent_log_event)) return

		this.is_busy = true
		this.result  = null
		this.error   = null

		const {timer} = this, lm = {...timer.log_meta, parent: parent_log_event}
		
		this.log_event = timer.log_write (new LogEvent ({...lm, phase: 'before', label: 'run () called'}))

		this.emit ('start')

		try {

			const data = await this.todo ({log_meta: {...lm, category: 'app'}})
			
			this.emit ('data', this.result = data)
					
		}
		catch (x) {

			this.emit ('error', this.error = x)
	
		}
		finally {

			this.is_busy = false

			timer.log_finish (this.log_event)

			this.emit ('finish')

		}

	}
	
	log_error (error) {
	
		const {timer} = this
	
		timer.log_write (new WrappedError (error, {log_meta: {
			...timer.log_meta,
			parent: this.log_event
		}}))

	}
	
	reset_if_needed () {
	
		if (!this.is_to_reset) return
		
		this.is_to_reset = false
		
		this.timer.on ('Reset, because was invoked during `run ()`')
	
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

			this.log_info (log_event, 'run () was called when running and ready to reset')

		}
		else {

			this.is_to_reset = true

			this.log_info (log_event, 'run () was called when running, reset planned')

		}
		
		return false

	}
	
	is_not_paused (log_event) {
	
		if (!this.timer.is_paused ()) return true
		
		this.timer.current_pause.is_to_reset = true
		
		this.log_info (log_event, 'run () was called when paused, bailing out')

		return false

	}	

	log_info (log_event, label) {

		this.timer.log_write (log_event.set ({
			label, 
			phase: 'progress'
		}))

	}
	
}