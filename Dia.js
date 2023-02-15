if (process.env.NODE_ENV != 'test') {
    console.log (new Date ().toString (), "Dia.js is loading...")
}

require ('./H4xx.js')

reExport ('ModuleTools')

this.Handler = require ('./Content/Handler.js')
this.HTTP    = require ('./Content/Handler/HTTP.js')
this.DB      = require ('./DB.js')
this.Cache   = require ('./Cache.js')
this.Config  = require ('./Config.js')
this.Logger  = require ('./Log/ConsoleLogger.js')

function reExport (module_name) {

    try {
        var m = require ('./' + module_name + '.js')
        for (var i in m) exports [i] = m [i]
    }
    catch (x) {
        suicide (x)
    }

}

this.factory = class {

    constructor (clazz, o = {}) {    
    	let {check_options} = clazz.prototype; if (check_options) check_options (o)
		this.clazz = clazz
		this.o     = o
    }
    
    async acquire (o) {    
		return new (this.clazz) ({...this.o, ...o})
    }

}