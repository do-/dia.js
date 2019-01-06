const Dia = require ('./Dia.js')
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

    constructor (o) {
    
        super (o)
        let handler = this
        
        this.Session = class {
        
            constructor (o) {
                this.h = handler
                this.o = o
            }
            
            new_id () {
                return Dia.new_uuid ()
            }

            start () {
                if (this.id) this.finish ()
                this.id = this.new_id ()
            }

            finish () {
                delete this.id
            }
            
            async get_user () {
                return undefined
            }

        }

        this.CookieSession = class extends this.Session {
        
            constructor (o) {
                super (o)
                if (!o.cookie_name) throw 'cookie_name is not set'
                let cookies = this.h.http_request.headers.cookie
                if (!cookies) return
                for (let chunk of cookies.split (';')) {
                    let [k, v] = chunk.trim ().split ('=')
                    if (k != o.cookie_name) continue
                    this.id = v
                    break
                }
            }
            
            start () {
                super.start ()
                this.h.http_response.setHeader ('Set-Cookie', this.o.cookie_name + '=' + this.id + '; HttpOnly');
            }
            
        }
        
    }

    check () {
        if (!this.http_request) throw '400 Empty http_request'
        if (!this.http_response) throw 'Empty http_response'
    }

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
    
        if (this.http_request.headers ['content-type'] != 'application/json') return

        try {
            let o = JSON.parse (this.body)
            if (Array.isArray (o)) throw '400 A plain object, not an array expected'
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
    
    get_module_name () {
        let type = this.q.type
        if (!type) throw '204 No content for you'
        return type
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