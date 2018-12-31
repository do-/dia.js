const http = require ('http')
const fs   = require ('fs')
const url  = require ('url')
const path = require ('path')

global.darn = (o) => {
    console.log (new Date ().toISOString (), o)
    return (o)
}

darn ("Dia.js is loading...")

load_conf ()

function load_conf () {
    var fn = path.resolve (process.env.DIA_JS_CONFIGURATION_FILE_PATH || '../conf/elud.json')
    darn (`Dia.js is loading configuration from ${fn}...`)
    global.$_CONF = JSON.parse (fs.readFileSync (fn, 'utf8'))
    darn (` ...ok`)
}

global.$_REQUEST = {}

exports.listen = (handler) => http.createServer (handler).listen ($_CONF.listen.port, $_CONF.listen.host, () => {
  darn (`Dia.js server running at http://${$_CONF.listen.host}:${$_CONF.listen.port}/`);
})

exports.parse_request = (rq) => {
    var uri = url.parse (rq.url)
    var params = new URLSearchParams (uri.search);
    $_REQUEST = {}; for (var k of ['type', 'id', 'action', 'part']) if (params.has (k)) $_REQUEST [k] = params.get (k)
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

var inc_fresh = {}

exports.require_fresh = () => {

    const check = (abs, mtime) => {
        var old = inc_fresh [abs]
        if (old == mtime) return
        if (old < mtime) delete require.cache [abs]
        inc_fresh [abs] = mtime
    }

    var abs = path.resolve ('Content/' + $_REQUEST.type + '.js')
    check (abs, fs.statSync (abs).mtime)
    return require (abs)

}