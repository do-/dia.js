const http = require ('http')
const url  = require ('url')

exports.listen = (handler) => http.createServer (handler).listen ($_CONF.listen.port, $_CONF.listen.host, () => {
    darn (`Dia.js server running at http://${$_CONF.listen.host}:${$_CONF.listen.port}/`);
})