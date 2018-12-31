const http = require ('http')
const url  = require ('url')

exports.listen = (handler) => http.createServer (handler).listen ($_CONF.listen.port, $_CONF.listen.host, () => {
    darn (`Dia.js server running at http://${$_CONF.listen.host}:${$_CONF.listen.port}/`);
})

exports.get_request = (rq) => {
    var uri = url.parse (rq.url)
    var params = new URLSearchParams (uri.search);
    var $_REQUEST = {}
    for (var k of ['type', 'id', 'action', 'part']) if (params.has (k)) $_REQUEST [k] = params.get (k)
    return $_REQUEST
}

exports.out_json = (rp, code, page) => {
    rp.statusCode = code
    rp.setHeader ('Content-Type', 'application/json')
    rp.end (JSON.stringify (page))
    darn (`type=${$_REQUEST.type} id=${$_REQUEST.id} action=${$_REQUEST.action} part=${$_REQUEST.part}`)
}

exports.out_error = (rp, ex) => {
    function s4 () {return Math.floor((1 + Math.random()) * 0x10000).toString (16).substring (1)}
    var id = s4 () + s4 () + '-' + s4 () + '-' + s4 () + '-' + s4 () + '-' + s4 () + s4 () + s4 ()
    darn ([id, ex])
    exports.out_json (rp, 500, {success: false, id: id, dt: new Date ().toJSON ()})
}