const {Transform} = require ('stream')
const esc_tsv = require ('../util/esc_tsv.js')

const NULL = '\\N'

const to_safe_string = v => {

	if (v == null) return NULL

	if (v instanceof Date) return v.toJSON ()
	
	switch (v) {

		case Number.POSITIVE_INFINITY:
		case Number.NEGATIVE_INFINITY:
			return NULL

	}

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

const to_string = (v, field) => 

	v == null ? null_to_string (field) :

	not_null_to_string (v, field)


const not_null_to_string = (v, {TYPE_NAME}) => {

	const s = to_safe_string (v)

	switch (TYPE_NAME) {

		case "DATE":
		case "Date":
			return s.slice (0, 10)

		case "DATETIME":
		case "DateTime":
		case "TIMESTAMP":
			return s.slice (0, 19)
			
		default:
			return s

	}

}

const null_to_string = ({name, NULLABLE}) => {

	if (NULLABLE) return NULL
	
	let e = new Error ()
	
	e.null_field_name = name
	
	throw e

}

module.exports = class extends Transform {

	constructor (options) {

		const {table} = options; delete options.table

		options.writableObjectMode = true
		options.allowHalfOpen = false
		
		super (options)
		
		this.table = table
		this._transform = this._transform_0
	
	}

	to_line (r) {

		let l = ''; for (const field of this.fields) {
		
			if (l !== '') l += '\t'
			
			l += to_string (r [field.name], field)

		}

		l += '\n'
		
		return l

	}
	
	_transform_0 (r, encoding, callback) {

		const {columns} = this.table

		let fields = this.fields = []; for (const k in r) if (k in columns) fields.push (columns [k])

		if (fields.length === 0) return this.destroy (new Error (`No known fields (${Object.keys (columns)}) found in 1st record: ` + JSON.stringify (r)))

		this.emit ('fields', fields.map (i => i.name))

		this._transform = this._transform_1

		this._transform (r, encoding, callback)

	}
		
	_transform_1 (r, encoding, callback) {

		try {

			this.push (this.to_line (r))

			callback ()

		}
		catch (x) {

			let xx = x

			const {null_field_name} = x; if (null_field_name) {
			
				let message = `Null value not allowed for ${this.table.name}.${null_field_name}`

				try {

					message += ' Record: ' + JSON.stringify (r)

				}
				catch (xxx) {

					for (let f of fields) message += `, ${f} = ${r [f]}`

				}

				xx = new Error (message)
			
			}

			this.destroy (xx)

		}

	}

}