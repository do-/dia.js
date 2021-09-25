const fs         = require ('fs')
const path       = require ('path')
const {Readable} = require ('stream')
const zlib       = require ('zlib')
const LogEvent     = require ('../Log/Events/FS.js')
const WarningEvent = require ('../Log/Events/Warning.js')

module.exports = class {

    constructor (o) {    

		for (let k of ['root', 'conf', 'rq', 'log_meta']) 
		
			if (!(this [k] = o [k])) 
			
				throw new Error (k + ' not defined')

    }
    
    log_write (e) {

    	this.conf.log_event (e)

    	return e
    
    }

    log_finish (e) {
        	
    	return this.log_write (e.finish ())

    }
    
    log_start (file_id, action) {

    	return this.log_write (new LogEvent ({
    		...(this.log_meta || {}),
			phase: 'before',
			file_id, 
			action,
    	}))

    }
    
    warn (label, o = {}) {

    	return this.log_write (new WarningEvent ({
    		...(this.log_meta || {}),
			label,
			...o
    	}))

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
	
	async append (path, chunk, encoding) {

		if (encoding) chunk = Buffer.from (chunk, encoding)

		let abs = this.abs (path)

		let log_event = this.log_start (path, 'append').measure (chunk)
		
		try {

			await new Promise ((ok, fail) => {

				fs.appendFile (abs, chunk, (x) => x ? fail (x) : ok ())

			})

			let size = await this.size (path)
			
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
    		.on ('data', chunk => log_event.measure (chunk))
    		.on ('close', () => this.log_finish (log_event))

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
	
	async gzip (old_path, o = {}) {

		let log_event = this.log_start (old_path, 'gzip')

		let {log_meta} = this, {parent} = log_meta; log_meta.parent = log_event
		
		try {

			if (!o.level) o.level = 9; let gzip = zlib.createGzip (o)

			let new_path = await this.construct_gzip_file_path (old_path)

			let [is, os] = await Promise.all ([
				this.get (old_path),
				this.put (new_path),
			])

			await new Promise ((ok, fail) => {		
				os.on ('error', fail).on ('close', () => ok (new_path))		
				is.on ('error', fail).pipe (gzip).pipe (os)
			})
			
			return new_path

		}
		finally {
		
			this.log_finish (log_event)
			
			log_meta.parent = parent
		
		}

	}

}