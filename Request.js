const Dia = require ('./Dia.js')
const url  = require ('url')

module.exports = class Request {

    constructor (o) {
        this.uuid = Dia.new_uuid ()
        for (i in o) this [i] = o [i]
        this.read_params ()
        this.process_params ()
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

    read_params () {
        let rq = this.http_request
        if (rq) this.read_http_params (rq)
    }

    read_http_params (rq) {
        let uri = url.parse (rq.url)
        let params = new URLSearchParams (uri.search);
        this.q = {}
        for (var k of ['type', 'id', 'action', 'part']) if (params.has (k)) this.q [k] = params.get (k)
    }
    
    out_json (code, data) {
        let rp = this.http_response
        rp.statusCode = code
        rp.setHeader ('Content-Type', 'application/json')
        rp.end (JSON.stringify (data))
    }

    out (data) {
        this.out_json (200, this.to_message (data))
    }
    
    carp (x) {
        console.log (this.uuid, x)
        this.out_json (500, this.to_fault (x))
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