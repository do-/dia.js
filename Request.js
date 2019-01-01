const Dia = require ('./Dia.js')

module.exports = class Request {

    constructor (o) {
        this.uuid = Dia.new_uuid ()
        for (i in o) this [i] = o [i]
    }

}