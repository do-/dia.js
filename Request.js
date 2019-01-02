const Dia = require ('./Dia.js')
const url  = require ('url')

module.exports = class Request {

    constructor (o) {
        this.uuid = Dia.new_uuid ()
        console.time (this.uuid)        
        for (i in o) this [i] = o [i]
        this.run ()
    }

    async run () {
        
        try {
            await this.read_params ()
            await this.acquire_resources ()
            await this.process_params ()
        }
        catch (x) {
            this.carp (x)
        }
        
        try {
            await this.release_resources ()
        }
        catch (x) {
            darn (x)
        }
        
        console.timeEnd (this.uuid)

    }
    
    async acquire_resources () {
        if (this.db_pools) for (let k in this.db_pools) this [k] = await this.db_pools [k].acquire ()
    }

    async release_resources () {
        if (this.db_pools) for (let k in this.db_pools) await this.db_pools [k].release (this [k])
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

    async process_params () {
        this.module_name = this.get_module_name ()
        this.method_name = this.get_method_name ()
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

    out (data) {
        Dia.HTTP.out_json (this.http_response, 200, this.to_message (data))
    }
    
    carp (x) {
        console.log (this.uuid, '[ERROR]', x)
        Dia.HTTP.out_json (this.http_response, 500, this.to_fault (x))
    }
    
    to_message (data) {return {
        success: true, 
        content: data 
    }}

    to_fault (x) {return {
        success: false, 
        id: this.uuid, 
        dt: new Date ().toJSON ()
    }}
    
}