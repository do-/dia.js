const HTTP = require ('./HTTP')

exports.Handler = class extends HTTP.Handler {

    async read_params () {
    
    	await super.read_params ()
    	
        let rq = this.rq
        
        let jsonrpc = rq.jsonrpc
        
        if (jsonrpc == null) throw "-32600 Missing jsonrpc version"
        if (jsonrpc != "2.0") throw `-32600 The ${jsonrpc} version is not supported, only 2.0.`
        
        let id = rq.id
        if (id == null) throw "-32600 Missing request id"
        id = id.toLowerCase ()
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test (id)) throw "-32602 Request id is not a UUID"
		this.uuid = id

        let p = rq.params
        
        let [type] = this.http.request.url.split ('/').filter (s => s)

        p.type    = type
        p.action  = rq.method

        this.rq = p

    }
    
	send_out_json_rpc (code, o) {	
		o.jsonrpc = "2.0"
		o.id = this.uuid
		this.send_out_json (code, o)
	}
	
	send_out_json_rpc_error (http_code, code, message, data) {	
		let error = {code, message}
		if (data) error.data = data
		this.send_out_json_rpc (http_code, {error})
	}
    
    send_out_data (result) {
        this.send_out_json_rpc (200, {result})
    }
    
    send_out_error (x) {
    
        if (/^-326\d\d /.test (x)) {
        
        	let code = x.substr (0, 6)
        	
        	let message = x.substr (7)
        	
        	let http_code = (() => {
				switch (code) {
					case "-32700": 
					case "-32600": 
					case "-32601": 
						return 400
					case "-32602": 
						return 422
					default: 
						return 500
				}
        	}) ()
        	
        	return this.send_out_json_rpc_error (http_code, code, message)
        	
        }

        if (/^\d\d\d /.test (x)) return this.send_out_text (x)

        let message = 
        	typeof x == 'string' ? x : 
        	x instanceof Error   ? x.message : 
        	''

        if (message.charAt (0) == '#') {
        	let v = this.to_validation_error (x)
        	return this.send_out_json_rpc_error (422, -32602, v.message, {field: v.field})
        }

        this.send_out_json_rpc_error (500, -32603, message)

    }

}