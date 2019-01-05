const Dia = require ('./Dia.js')
const url = require ('url')

module.exports = class {

    constructor (o) {
        for (let i in o) this [i] = o [i]
        this.uuid = Dia.new_uuid ()
        this.__resources = []
        this.run ()
    }

    async run () {
        
        console.time (this.uuid)        

        try {
            await this.read_params ()
            await this.acquire_resources ()
            this.module_name = this.get_module_name ()
            this.method_name = this.get_method_name ()
            let data = await this.get_method ().call (this)
            this.send_out_data (data)
        }
        catch (x) {
            this.is_failed = true
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
                console.timeEnd (this.uuid)
            }

        }

    }

    is_transactional () {
        return !!this.q.action
    }
    
    async acquire_resources () {    
        if (this.db_pools) for (let k in this.db_pools) this [k] = await this.acquire_db_resource (k)
    }

    async acquire_db_resource (name) {
        let db = await this.db_pools [name].acquire ()
        this.__resources.push (db)
        if (this.is_transactional ()) await db.begin ()
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

    get_module_name () {
        return this.q.type
    }

    get_method_name () {
        return 'get'
    }
    
    get_module () {
        return Dia.require_fresh (this.module_name)        
    }
    
    get_method () {
        let module = this.get_module ()
        if (!module) throw `Module not defined: ${this.module_name}`
        var method = module [this.method_name]
        if (!method) throw `Method not defined: ${this.module_name}.${this.method_name}`
        return method
    }

    async read_params () {
        this.q = {}
        if (this.http_request) return await this.read_http_params ()
    }

    read_http_head_params () {
        let uri = url.parse (this.http_request.url)
        let params = new URLSearchParams (uri.search);
        for (var k of ['type', 'id', 'action', 'part']) if (params.has (k)) this.q [k] = params.get (k)
    }
    
    read_body_params () {
        let o = JSON.parse (this.body)
        for (let i in o) this.q [i] = o [i]
    }

    async read_http_params (rq) {

        this.body = await Dia.HTTP.get_http_request_body (this.http_request)
        this.read_body_params ()
        delete this.body

        this.read_http_head_params ()

    }
    
}