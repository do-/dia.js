const http = require ('http')
const url  = require ('url')
const Handler = require ('./Handler')

exports.listen = (handler) => {

    let o = $_CONF.listen

    http.createServer (handler).listen (o, () => {
        console.log ('Dia.js HTTP server is running at ', o)
    })

}

exports.Handler = class extends Handler {

    async get_http_request_body (rq) {

        return new Promise ((resolve, reject) => {

            let body = '';

            rq.on ('data', chunk => {
                body += chunk.toString ()
            })

            rq.on ('end', () => {        
                try {
                    resolve (body)
                }
                catch (x) {
                    reject (x)
                }            
            })

        })    

    }
    
    parse_http_request_body () {
        try {
            let o = JSON.parse (this.body)
            for (let i in o) this.q [i] = o [i]
        }
        catch (x) {
            throw '400 Broken JSON'
        }
    }

    async read_params () {
        
        this.q = {}
        
        switch (this.http_request.method) {
            case 'POST':
            case 'PUT':
                this.body = await this.get_http_request_body (this.http_request)
                this.parse_http_request_body ()
                break
        }
        
        let uri = url.parse (this.http_request.url)
        new URLSearchParams (uri.search).forEach ((v, k) => this.q [k] = v)

    }

    send_out_json (code, data) {
        let rp = this.http_response
        rp.statusCode = code
        rp.setHeader ('Content-Type', 'application/json')
        rp.end (JSON.stringify (data))
    }

    send_out_text (s) {
        let rp = this.http_response
        rp.statusCode = s.substr (0, 3)
        rp.setHeader ('Content-Type', 'text/plain')
        rp.end (s.substr (4))
    }

    send_out_data (data) {
        this.send_out_json (200, this.to_message (data))
    }

    send_out_error (x) {
        if (/^\d\d\d /.test (x)) return this.send_out_text (x)
        if (typeof x == 'string' && x.charAt (0) == '#') return this.send_out_json (422, this.to_validation_error (x))
        console.log (this.uuid, '[ERROR]', x)
        this.send_out_json (500, this.to_fault (x))
    }

    to_message (data) {return {
        success: true, 
        content: data 
    }}

    to_validation_error (x) {
        let [_, field, message] = /^#(.*)#:(.*)$/.exec (x)
        return {field, message}
    }

    to_fault (x) {return {
        success: false, 
        id: this.uuid, 
        dt: new Date ().toJSON ()
    }}

}