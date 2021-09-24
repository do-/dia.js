const fs         = require ('fs')
const path       = require ('path')
const {Readable} = require ('stream')
const zlib       = require ('zlib')

module.exports = class {

    constructor (o) {    

		for (let k of ['root', 'rq', 'log_meta']) 
		
			if (!(this [k] = o [k])) 
			
				throw new Error (k + ' not defined')

    }
    
	async release () {
		// do nothing
	}			

    get_name () {

    	return this.rq.type
    
    }
    
	abs (p) {
	
		return path.join (this.root, p)
		
	}
	
	async construct_directory_path (id, fn, o) {
	
		let p = this.get_name () + '/' + new Date ().toJSON ().slice (0, 10).replace (/-/g, '/')

		return new Promise ((ok, fail) => 
		
			fs.mkdir (this.abs (p), {recursive: true}, x => 
			
				x ? fail (x) : ok (p)
				
			)
		
		)

	}

	async construct_file_name (id, fn, o) {
	
    	let is_gz = /\.gz/.test (fn); if (is_gz) fn = fn.slice (0, fn.length - 3)
    	
    	let file_name = id + path.extname (fn)
    	
    	if (is_gz) file_name += '.gz'
    	
    	return file_name

	}
	
	async construct_file_path (id, fn, o = {}) {
		
		let [d, f] = await Promise.all ([
			this.construct_directory_path (id, fn, o),
			this.construct_file_name      (id, fn, o),
		])

		return d + '/' + f

	}
	
	async size (path) {

		let abs = this.abs (path)
	
		if (!fs.existsSync (abs)) return 0

		return new Promise ((ok, fail) => {
		
			fs.stat (abs, (x, d) => x ? fail (x) : ok (d.size))
			
		})

	}
	
	async append (path, chunk, encoding) {

		if (encoding) chunk = Buffer.from (chunk, encoding)

		let abs = this.abs (path)

		await new Promise ((ok, fail) => {

			fs.appendFile (abs, chunk, (x) => x ? fail (x) : ok ())

		})
		
		return await this.size (path)

	}

	async get (path) {
		
		let abs = this.abs (path)
	
		if (!fs.existsSync (abs)) return Readable.from ([])

    	return fs.createReadStream (abs)

	}

	async put (path, o) {

    	return fs.createWriteStream (this.abs (path), o)

	}

	async delete (path) {

		let abs = this.abs (path)
	
		if (!fs.existsSync (abs)) return
		
		return new Promise ((ok, fail) => {

			fs.unlink (abs, x => x ? fail (x) : ok ())
			
		})

	}
	
	async gzip (path, options = {}) {
		
		if (!options.level) options.level = 9
				
		let new_path = path + '.gz'
		
		let [is, os] = await Promise.all ([
			this.get (path),
			this.put (new_path),
		])

		return new Promise ((ok, fail) => {		

			os.on ('error', fail).on ('close', () => 			
				this.delete (path)
					.catch (fail)
					.then (() => ok (new_path))			
			)
		
			is.on ('error', fail)
				.pipe (zlib.createGzip (options))
				.pipe (os)

		})

	}

}