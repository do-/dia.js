const Dia = require ('../Dia.js')
const url = require ('url')
const http = require ('http')
const path = require ('path')
const fs   = require ('fs')

module.exports = class {

    constructor (o) {
        for (let i in o) this [i] = o [i]
        this.uuid = Dia.new_uuid ()
        this.__resources = []
    }
    
    import (c, m) {
    	let from = c.prototype, to = this.constructor.prototype
    	for (let i of m) to [i] = from [i]
    }
    
    get_log_banner () {
        return `${this.module_name}.${this.method_name}`
    }
    
    get_ttl () {
    	return 0
    }
    
    async get_data () {
    
    	let watch, main = this.get_method ().call (this), ttl = this.get_ttl (); 
    	
    	if (!(ttl > 0)) return main
    	
    	return Promise.race ([

    		new Promise (async (ok, fail) => {

    			try {
    			
    				let data = await main
    				
    				clearTimeout (watch)
    				
    				ok (data)
    				
    			}
    			catch (x) {
    			
    				fail (x)
    			
    			}

    		}),
    		
    		new Promise (async (ok, fail) => {

    			watch = setTimeout (() => 

    				fail (new Error ('Dia handler timeout expired: ' + ttl + ' ms elapsed'))

    				, ttl + 1
    			
    			)

    		}),

    	])

    }
    
    async commit () {
    
    	for (let db of this.__resources) if (db.commit) await db.commit ()

    }

    async run () {
        
        let old_uuid = this.uuid
        console.time (old_uuid)        

        try {
            this.check ()
            await this.read_params ()
            this.check_params ()
            this.session = this.get_session ()
            await this.acquire_resources ()
            if (!this.is_anonymous ()) this.user = await this.get_user ()
            if (!this.module_name) this.module_name = this.get_module_name ()
            if (!this.method_name) this.method_name = this.get_method_name ()
            console.log (this.uuid + ': ' + this.get_log_banner ())            
            let data = await this.get_data ()
            if (this.is_transactional ()) await this.commit ()
            this.send_out_data (data)
        }
        catch (x) {
            console.log (this.uuid, x)
            this.is_failed = true
            this.error = x
            this.send_out_error (x)
        }
        finally {

            try {
                await this.release_resources ()
            }
            catch (x) {
                darn (x)
            }
            finally {
            	if (old_uuid != this.uuid) console.log (`request id was changed: ${this.uuid} -> ${old_uuid}`)
                console.timeEnd (old_uuid)
            }

        }

    }

    check () {}
    
    async read_params () {}

    check_params () {}

    send_out_data () {}

    get_session () {
        return undefined
    }

    async get_user () {
        if (!this.session) return undefined
        return this.session.get_user ()
    }

    is_transactional () {
        return !!this.rq.action
    }
    
    is_anonymous () {
        return false
    }
    
    async acquire_resources () {

        if (this.pools) for (let k in this.pools) {
        
            let pool = this.pools [k]

            this [k] = pool.acquire ? await this.acquire_resource (pool, k) : pool

        }

    }

    async acquire_resource (pool, k) {
        let db = await pool.acquire ()
        db.log_prefix = this.uuid + ' ' + k + ':  '
        let {product} = pool; if (product) db.product = product
        this.__resources.push (db)
        if (db.begin && this.is_transactional ()) await db.begin ()
        return db
    }

    async release_resources () {    
        for (let resource of this.__resources) try {
            resource.release (!this.is_failed)
        }
        catch (x) {
            darn (x)
        }
    }

    get_method_name () {
        return 'get'
    }
    
    get_module () {
    
    	let {conf} = this; if (!(conf instanceof Dia.Config)) throw 'Since 2cfbbdb, this.conf must inherit Dia.Config, sorry.'

    	let {module_name, method_name} = this, fn = module_name + '.js', {_inc_fresh} = conf

    	let scanned = []; for (let p of conf.get_content_paths (module_name)) {
    	
    		let abs = path.resolve (p, fn); if (!fs.existsSync (abs)) continue
    		
			let {mtime} = fs.statSync (abs)

			if (abs in _inc_fresh && _inc_fresh [abs] < mtime) delete require.cache [abs]

			let module = require (abs)

			_inc_fresh [abs] = mtime

			if (method_name in module) return module
			
			scanned.push (abs)

    	}
    	
    	if (scanned.length > 0) darn (`Didn't find ${method_name} in ${scanned}`)
    	
    	return null

    }

    get_method () {

        let {module_name, method_name} = this, module = this.get_module ()

        if (!module) throw `Module / method not defined: ${module_name}.${method_name}`

        return (this.module = module) [method_name]

    }
    
    get_module_name () {

        return this.rq.type

    }

    send_out_error (x) {
    	darn (x)
    }

    call (method_name) {
    	return this.module [method_name].call (this)
    }

}