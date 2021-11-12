const assert = require ('assert')

const S_PERIOD      = Symbol ('period')
const S_TOLERANCE   = Symbol ('tolerance')
const S_COUNT_FAILS = Symbol ('cnt_fails')
const S_NEXT_DATE   = Symbol ('next_date')
const S_MESSAGE     = Symbol ('message')

module.exports = class {

	constructor (timer, options) {

		assert (timer, 'timer not set')

		const {executor} = timer
		assert (executor, 'timer executor not set')

		this.timer = timer
		timer.throttle = this
		
		let {period, tolerance} = options
		
		const _t = get_tolerance_from_period (period); if (_t !== null) {

			if (tolerance == null) tolerance = _t; else assert.strictEqual (tolerance, _t)

		} 
					
		this.tolerance = tolerance
		this.period    = period
		
		this.clear ()
		this.reset ()	
		
		executor.on ('start',    () => this.register_start ())
		executor.on ('data',     () => this.reset ())
		executor.on ('error', error => this.register_error (error))

	}
	
	get tolerance () {

		return this [S_TOLERANCE]

	}

	set tolerance (v) {
	
		if (v == null) return this [S_TOLERANCE] = null
		
		assert_non_negative_int (v, 'tolerance')
		
		if (v === 0) v = 1 // 'zero tolerance' means stop after 1st fail, not 0th one
		
		this [S_TOLERANCE] = v
	
	}

	get period () {

		return this [S_PERIOD]

	}

	set period (v) {

		if (v == null) v = [0]

		if (!Array.isArray (v)) v = [v]

		const {length} = v; assert (length > 0, `Zero length period array is not allowed`)
		
		for (let i = 0; i < length - 1; i ++) {
		
			if (typeof v [i] === 'string') v [i] = parseInt (v [i], 10)

			assert_non_negative_int (v [i], 'period')

		}
		
		this [S_PERIOD] = v

	}
	
	get cnt_fails () {

		return this [S_COUNT_FAILS]

	}

	reset () {
	
		this [S_COUNT_FAILS] = 0
	
	}
	
	clear () {
		
		this [S_NEXT_DATE] = null
		this [S_MESSAGE]   = null
		
	}

	register_start () {

		const {period, cnt_fails} = this, {length} = period

		const delay = period [Math.min (cnt_fails, length - 1)]

		if (delay === 0) return this.clear ()

		this [S_NEXT_DATE] = Date.now () + delay

		this [S_MESSAGE] = `delayed until ${delay} ms since the last run`

	}

	register_error (error) {

		this [S_COUNT_FAILS] ++

		const {tolerance} = this; if (tolerance === null) return

		const {cnt_fails} = this; if (cnt_fails < tolerance) return

		const {timer} = this, {executor} = timer

		let label = 'failed ' + cnt_fails + ' time' 
		
		if (cnt_fails > 1) label += 's'
		
		label += ', going to be paused.'

		timer.log_write (executor.log_event.set ({label}))
	
		timer.pause (error)

	}

	adjust (date) {

		const time = this [S_NEXT_DATE]
		
		if (time == null || time < date.getTime ()) return null

		date.setTime (time)

		return this [S_MESSAGE]

	}

}

const assert_non_negative_int = (v, k) => {

	assert (Number.isInteger (v), `Invalid ${k} value: ${v} (must be integer number)`)

	assert (v >= 0, `Invalid ${k} value: '${v}' (must be non negative)`)

}

const get_tolerance_from_period = period => {

	if (!Array.isArray (period)) return null
	
	const {length} = period
	
	if (period [length - 1] !== null) return null

	period.pop ()

	return length

}
