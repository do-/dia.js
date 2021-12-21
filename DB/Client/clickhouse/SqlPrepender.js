const {Transform} = require ('stream')

module.exports = class extends Transform {

	constructor (sql) {

		super ()

		this.sql       = sql

		this.is_virgin = true

	}
			
	_transform (chunk, encoding, callback) {
	
		if (this.is_virgin) {
		
			this.push (this.sql + ' FORMAT TSV\n')

			this.is_virgin = false
		
		}

		this.push (chunk)

		callback ()

	}

}