const {Readable} = require ('stream')
const zlib       = require ('zlib')
const LogEvent     = require ('../Log/Events/FS.js')
const WarningEvent = require ('../Log/Events/Warning.js')

module.exports = class {

    constructor (o) {    

		for (let k of ['conf', 'rq', 'log_meta']) 
		
			if (!(this [k] = o [k])) 
			
				throw new Error (k + ' not defined')
				
		this.read_only = !!o.read_only
		
		if (this.is_read_only ()) for (let k of ['put', 'append', 'delete', 'gzip']) this [k] = this.carp_read_only

    }
    
    is_read_only () {
    	return this.read_only
    }

	carp_read_only () {
		throw Error ('This file store is read only')
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
    
	async new_path (id, fn, o = {}) {
		throw Error ('Not implemented')
	}
    			
	async size (path) {
		throw Error ('Not implemented')
	}
	
	async append_buffer (path, chunk) {
		throw Error ('Not implemented')
	}

	async append (path, chunk, encoding) {

		if (encoding) chunk = Buffer.from (chunk, encoding)
		
		return await this.append_buffer (path, chunk)

	}

	async get (path) {
		throw Error ('Not implemented')
	}

	async put (path, o) {
		throw Error ('Not implemented')
	}

	async delete (path) {
		throw Error ('Not implemented')
	}
	
	async construct_gzip_file_path (old_path) {
		throw Error ('Not implemented')
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