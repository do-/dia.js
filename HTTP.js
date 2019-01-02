const http = require ('http')
const url  = require ('url')

exports.listen = (handler) => http.createServer (handler).listen ($_CONF.listen.port, $_CONF.listen.host, () => {
    darn (`Dia.js server running at http://${$_CONF.listen.host}:${$_CONF.listen.port}/`);
})

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