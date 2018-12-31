global.darn = (o) => {
    console.log (new Date ().toISOString (), o)
    return (o)
}

darn ("Dia.js is loading...")

reExport ('Conf')
reExport ('ModuleTools')
reExport ('DB')
reExport ('HTTP')

function reExport (module_name) {

    try {
        var m = require ('./' + module_name + '.js')
        for (var i in m) exports [i] = m [i]
    }
    catch (x) {
        darn ('[ERROR] ' + x)
        process.exit (1)
    }
    
}