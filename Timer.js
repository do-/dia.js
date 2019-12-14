module.exports = class {

	constructor (o) {
	
		if (!(o.period >= 1)) throw new Error ("Timer period must be at least 1 ms. Got options: " + JSON.stringify (o))
		
		if (typeof o.todo != 'function') throw new Error ("No valid `todo` set. Got options: " + JSON.stringify (o))
		
		this.o = o
		
	}
	
	from_to (from, to) {
		darn (`Timer: from_to (${from}, ${to}) called`)
		this.o.from = from
		this.o.to   = to
		darn ('Timer: o = ' + JSON.stringify (this.o))
	}
	
	clear () {
		darn ('Timer: clear () called')
		if (!this.t) return
		clearTimeout (this.t)
		delete this.t
		delete this.when
	}
	
	in (ms) {
	
		darn (`Timer: in (${ms}) called`)

		if (ms < 0) ms = 0

		let when = ms + new Date ().getTime ()
		
		darn ('Timer: the desired time is ' + new Date (when))

		if (this.next && when < this.next) {
		
			when = this.next
			
			darn ('Timer: adjusted to the next period ' + new Date (when))
		
		}

		if (this.o.from) {
		
			darn (`Timer: checking for ${this.o.from}..${this.o.to}`)

			let dt         = new Date (when)

			let hhmmss     = dt.toJSON ().slice (11, 19)

			let ge_from    = this.o.from <= hhmmss
			let le_to      =                hhmmss <= this.o.to
			
			let is_one_day = this.o.from <= this.o.to
			
			let is_in      = is_one_day ? ge_from && le_to : ge_from || le_to
			
			if (!is_in) {
			
				darn (`Timer: ${dt} is out of ${this.o.from}..${this.o.to}, adjusting`)
				
				if (is_one_day && !le_to) dt.setDate (1 + dt.getDate ())
				
				let [h, m, s] = this.o.from.split (':')
				
				dt.setHours   (h)
				dt.setMinutes (m)
				dt.setSeconds (s)				
				
				when = dt.getTime ()
			
			}
						
		}
				
		darn ('Timer: about to schedule at ' + new Date (when))

		if (this.t) {
		
			darn ('Timer: was previously scheduled at ' + new Date (this.when))
			
			if (this.when <= when) return darn ('Timer: nothing to do, exiting')
			
			this.clear ()

		}
		
		if (this.is_busy) {

			darn ('Timer: busy...')

			let is_reset_to = this.is_reset_to
			
			if (is_reset_to >= when) return darn ('Timer: was already reset to ' + new Date (is_reset_to) + ', nothing to do')
			
			this.is_reset_to = when

			return darn ('Timer: reset, now quitting')

		}		

		this.t = setTimeout (() => this.run (), when - new Date ().getTime ())

		darn ('Timer: now scheduled at ' + new Date (this.when = when))
		
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
	
		this.next = new Date ().getTime () + this.o.period
	
		darn ('Timer: run () called')
		
		this.is_busy = 1

			this.clear ()

			try {
				await this.o.todo ()
			}
			catch (x) {
				darn (x)
			}
		
		delete this.is_busy
		
		let when = this.is_reset_to; if (when) {

			darn ('Timer: about to reset...')			

			delete this.is_reset_to

			this.at (when)

		}
	
	}

}