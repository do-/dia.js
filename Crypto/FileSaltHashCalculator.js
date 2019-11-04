const fs     = require ('fs')
const crypto = require ('crypto')

module.exports = class {

	constructor (o = {}) {
		
		if (!o.algorithm) o.algorithm = 'sha256'

		if (!('encoding' in o))	o.encoding = 'hex'

		for (let k in o) this [k] = o [k]

	}
	
	async encrypt (password, salt) {
            
		const hash   = crypto.createHash (this.algorithm)
		const input  = fs.createReadStream (this.salt_file)

		return new Promise ((resolve, reject) => {

			input.on ('error', reject)

			input.on ('end', () => {
				if (salt != null) hash.update (String (salt), 'utf8')
				hash.update (String (password), 'utf8')
				resolve (hash.digest (this.encoding))
			})

			input.pipe (hash, {end: false})

		})
            
	}

}