global.$_DB = {}

var dsn = $_CONF.db ['connection-string']

if (!dsn) throw 'db.connection-string is not set'

var product = dsn.split (':') [0]

darn (`Loading ${product} db driver...`)

reExport (product)

function reExport (module_name) {

    try {
        var m = require ('./DB/' + module_name + '.js')
        for (var i in m) exports [i] = m [i]
    }
    catch (x) {
        darn ('[ERROR] ' + x)
        process.exit (1)
    }
    
}