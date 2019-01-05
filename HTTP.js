const http = require ('http')
const url  = require ('url')
const Request = require ('./Request')

exports.listen = (handler) => {

    let o = $_CONF.listen

    http.createServer (handler).listen (o, () => {
        console.log ('Dia.js HTTP server is running at ', o)
    })

}

exports.get_http_request_body = async (rq) => {

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

exports.Request = class extends Request {

    send_out_json (code, data) {
        let rp = this.http_response
        rp.statusCode = code
        rp.setHeader ('Content-Type', 'application/json')
        rp.end (JSON.stringify (data))
    }

    send_out_text (code, text) {
        let rp = this.http_response
        rp.statusCode = code
        rp.setHeader ('Content-Type', 'text/plain')
        rp.end (text)
    }

    send_out_data (data) {
        this.send_out_json (200, this.to_message (data))
    }

    send_out_error (x) {

        if (parseInt (x) > 99) return send_out_text (code)

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