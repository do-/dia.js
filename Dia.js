console.log (new Date ().toString (), "Dia.js is loading...")

require ('./H4xx.js')

reExport ('ModuleTools')

this.Handler = require ('./Content/Handler.js')
this.HTTP    = require ('./Content/Handler/HTTP.js')
this.DB      = require ('./DB.js')
this.Cache   = require ('./Cache.js')
this.Config  = require ('./Config.js')

function reExport (module_name) {

    try {
        var m = require ('./' + module_name + '.js')
        for (var i in m) exports [i] = m [i]
    }
    catch (x) {
        suicide (x)
    }

}