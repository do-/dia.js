const fs         = require ('fs')
const path       = require ('path')
const {Readable} = require ('stream')
const zlib       = require ('zlib')

module.exports = class {

    constructor (o) {    

		for (let k of ['root', 'log_meta']) 
		
			if (!(this [k] = o [k])) 
			
				throw new Error (k + ' not defined')

    }
    
    get_name () {
    
    	return this.log_meta.parent.rq.type
    
    }
    
	abs (fn) {
	
		return path.join (this.root, fn)
		
	}

    to_path (id, fn, o) {
    
    	return [

    		get_name (),

    		...(new Date ().toJSON ().slice (0, 10).split ('-')),

    		path.extname (path),

    	].join ('/')
    
    }
	
	create (id, fn, o = {}) {
	
		let p = this.to_path (id, fn, o)
		
		fs.mkdirSync (this.abs (p), {recursive: true})
		
		return p
	
	}
	
	async len (path) {

		let abs = this.abs (path)
	
		if (!fs.existsSync (path)) return 0

		return new Promise ((ok, fail) => {
		
			fs.stat (path, (x, d) => x ? fail (x) : ok (d.size))
			
		})

	}
	
	async append (path, chunk, encoding) {

		if (encoding) chunk = Buffer.from (chunk, encoding)

		await new Promise ((ok, fail) => {

			fs.appendFile (this.abs (path), chunk, (x) => x ? fail (x) : ok ())

		})
		
		return this.len (path)

	}

	get (path) {
		
		let abs = this.abs (path)
	
		if (!fs.existsSync (abs)) return Readable.from ([])

    	return fs.createReadStream (abs)

	}

	put (path, o) {

    	return fs.createWriteStream (this.abs (path), o)

	}

	del (path) {

		let abs = this.abs (path)
	
		if (!fs.existsSync (abs)) return
		
		fs.unlinkSync (abs)

	}
	
	async gzip (path, options = {}) {
		
		if (!options.level) options.level = 9
				
		return new Promise ((ok, fail) => {
		
			let new_path = path + '.gz'

			let os = this.put (new_path).on ('error', fail).on ('close', () => {
			
				try {
				
					fs.unlinkSync (this.abs (path))

					ok (new_path)
				
				}
				catch (e) {
				
					fail (e)
				
				}			
			
			})
		
			let is = this.get (path).on ('error', fail)
				.pipe (zlib.createGzip (options))
				.pipe (os)

		})

	}

}