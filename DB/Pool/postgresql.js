const {Pool} = require ('pg')

module.exports = class {

    constructor (o) {
        this.options = o
        this.backend = new Pool (o)
    }
    
    async acquire () {
    
        darn (`${this.backend.totalCount} ${this.backend.idleCount} ${this.backend.waitingCount}`)
    
        return await this.backend.connect ()
    }

    async release (client) {
        return await client.release ()
    }

}