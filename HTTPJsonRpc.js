const HTTP = require ('./HTTP')

exports.Handler = class extends HTTP.Handler {

    async read_params () {
    
    	await super.read_params ()
    	
        let rq = this.rq

        this.uuid = rq.id

        let p = rq.params
        
        let [type] = this.http.request.url.split ('/').filter (s => s)

        p.type    = type
        p.action  = rq.method

        this.rq = p

    }

}