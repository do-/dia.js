console.log (new Date ().toString (), "Dia.js is loading...")

require ('./H4xx.js')

reExport ('Conf')
reExport ('ModuleTools')
//reExport ('DB')

this.Request = require ('./Request.js')
this.HTTP    = require ('./HTTP.js')

function reExport (module_name) {

    try {
        var m = require ('./' + module_name + '.js')
        for (var i in m) exports [i] = m [i]
    }
    catch (x) {
        suicide (x)
    }

}