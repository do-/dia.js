const Abstract   = require ('./Abstract.js')
const fs         = require ('fs')
const path       = require ('path')
const {Readable} = require ('stream')

let Base = class extends Abstract {

    constructor (o) {    

		super (o)

		for (let k of ['root']) 
		
			if (!(this [k] = o [k])) 
			
				throw new Error (k + ' not defined')

    }
    
	abs (p) {

		// nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
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

	async new_path (id, fn, o = {}) {
		return this.construct_file_path (id, fn, o)
	}
	
	size_sync_abs (abs) {
	
		return fs.statSync (abs).size
	
	}
	
	async size (path) {

		let abs = this.abs (path)
	
		if (!fs.existsSync (abs)) {
		
			this.warn (abs + ' not found, returning zero size')

			return 0
			
		}
		
		return this.size_sync_abs (abs)

	}
	
	async append_buffer (path, chunk, encoding) {

		let abs = this.abs (path)

		let log_event = this.log_start (path, 'append').measure (chunk)
		
		try {

			await new Promise ((ok, fail) => {

				fs.appendFile (abs, chunk, (x) => x ? fail (x) : ok ())

			})

			let size = this.size_sync_abs (abs)
			
			log_event.set_size (size)

			return size

		}
		finally {

			this.log_finish (log_event)

		}
    	
	}

	async get (path) {
		
		let abs = this.abs (path)
	
		if (!fs.existsSync (abs)) {
		
			this.warn (abs + ' not found, returning empty stream')
		
			return Readable.from ([])
		
		}
		
		let log_event = this.log_start (path, 'get')
    	
    	return fs.createReadStream (abs)
    		.on ('close', () => this.log_finish (log_event))
    		.pipe (log_event.get_meter ())

	}

	async put (path, o) {
	
		let log_event = this.log_start (path, 'put')
		
		let abs = this.abs (path)

    	return fs.createWriteStream (abs, o)

    		.on ('close', () => {
    			
    			try {

    				log_event.set_size (this.size_sync_abs (abs))

    			}
    			finally {

    				this.log_finish (log_event)

    			}

    		})

	}

	async delete (path) {

		let abs = this.abs (path)
	
		if (!fs.existsSync (abs)) return this.warn (abs + ' not found, returning empty stream')
		
		let log_event = this.log_start (path, 'delete'), log_finish = () => this.log_finish (log_event)

		return new Promise ((ok, fail) => {

			fs.unlink (abs, x => log_finish (x ? fail (x) : ok ()))
			
		})

	}
	
	async construct_gzip_file_path (old_path) {

		let fn = old_path.split ('/').pop (), [id] = fn.split ('.')
	
		return this.construct_file_path (id, fn + '.gz')

	}

}

Base.prototype.check_options = function (o) {

	let {root} = o; if (!root) throw new Error ('`root` option not set')
	
	if (!fs.existsSync (root)) throw new Error ('Root directory not found: ' + root)

	if (!fs.statSync (root).isDirectory ()) throw new Error ('This is not a directory: ' + root)
	
	if (!o.read_only) {

		let temp

		try {
			temp = fs.mkdtempSync (path.normalize (root) + path.sep)
		}
		catch (e) {
			throw new Error ("Can't create subdirectory in " + root + '. Perhaps, some permissions are missing or the directory path is wrong: ' + e.message)
		}

		try {
			fs.rmdirSync (temp)
		}
		catch (e) {
			throw new Error ("Managed to create temporary directory " + temp + "but can't remove it. Something wrong with file permissions: " + e.message)
		}

	}

}

module.exports = Base