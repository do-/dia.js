const assert = require ('assert')

const get_hhmmss = (options, key) => {

	const RE_HHMMSS = /^[0-2][0-9]:[0-5][0-9]:[0-5][0-9]$/

	let v = options [key], carp = () => 'Invalid `' + key + '` value: ' + v + '. Must be HH:MM:SS with HH between 00 and 23'

	assert.strictEqual (typeof v, 'string')

	assert (v <= '23', carp ())

	assert (RE_HHMMSS.test (v), carp ()) // njsscan-ignore: regex_dos

	return v

}

module.exports = class {

	constructor (options) {
	
		this.from = get_hhmmss (options, 'from')
		this.to   = get_hhmmss (options, 'to')
		
		assert.notStrictEqual (this.from, this.to)

		this.indexOf = this.from < this.to ? this.indexOf_from_to : this.indexOf_to_from

		this.message = `adjusted to time window ${this.from}..${this.to}`;

		[this.hh, this.mm, this.ss] = this.from.split (':').map (i => parseInt (i, 10))

	}
	
	indexOf_from_to (hhmmss) { return (
		hhmmss <  this.from ? -1 : 
		hhmmss <= this.to   ?  0 :
		                       1
	)}

	indexOf_to_from (hhmmss) { return (
		hhmmss <= this.to   ?  0 : 
		hhmmss <  this.from ? -1 :
		                       0
	)}
		
	slide (date, position) {

		if (position === 1) date.setDate (1 + date.getDate ())

		date.setHours        (this.hh)
		date.setMinutes      (this.mm)
		date.setSeconds      (this.ss)
		date.setMilliseconds (0)

	}
	
	adjust (date) {

		let position = this.indexOf (date.toJSON ().slice (11, 19))

		if (position === 0) return null

		this.slide (date, position)

		return this.message

	}

}