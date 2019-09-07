const Dia = require ('./Dia.js')
const url  = require ('url')
const Handler = require ('./Handler')

exports.Handler = class extends Handler {
	
    constructor (o, resolve, reject) {
    	o.__async = {resolve, reject}
        super (o)
    }
    
    send_out_data (data) {
    	this.__async.resolve (data)
    }

    send_out_error (x) {
    	this.__async.reject (x)
    }

    get_module_name () {
        let type = this.rq.type
        if (!type) throw 'Type MUST be defined'
        return type
    }
	
}