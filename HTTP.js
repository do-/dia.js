const http = require ('http')
const url  = require ('url')

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

exports.out_json = (rp, code, data) => {
    rp.statusCode = code
    rp.setHeader ('Content-Type', 'application/json')
    rp.end (JSON.stringify (data))
}