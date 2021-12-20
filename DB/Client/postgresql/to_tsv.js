const {Transform} = require ('stream')
const esc_tsv = require ('../util/esc_tsv.js')

const to_string	= v => {

	if (v == null || v === '') return ''

	if (v instanceof Buffer) return '\\\\x' + v.toString ('hex')

	if (v instanceof Date) return v.toJSON ().slice (0, 19)

	switch (typeof v) {

		case 'boolean': 
			return v ? '1' : '0'

		case 'number': 
		case 'bigint': 
			return '' + v

		case 'object':
			v = JSON.stringify (v)

	}

	return esc_tsv (v)

}

module.exports = class extends Transform {

	constructor (cols) {

		super ({
			readableObjectMode: false,					
			writableObjectMode: true, 		
		})

		this.cols = cols

	}

	_transform (chunk, encoding, callback) {
	
		const {cols} = this, {length} = cols
	
		let s = ''; for (let i = 0; i < length; i ++) {
		
			if (i !== 0) s += '\t'
			
			s += to_string (chunk [cols [i]])

		}
		
		s += '\n'
		
		callback (null, s)
	
	}

}