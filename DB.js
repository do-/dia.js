global.$_DB = {}

var dsn = $_CONF.db.connectionString

if (!dsn) throw 'db.connectionString is not set'

var product = dsn.split (':') [0]

darn (`Loading ${product} db driver...`)

reExport ()

async function reExport () {

    try {
        var m = require ('./DB/' + product + '.js')
        for (var i in m) exports [i] = m [i]
    }
    catch (x) {
        darn ('[ERROR] ' + x)
        process.exit (1)
    }
    
}