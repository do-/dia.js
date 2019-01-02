const {Pool} = require ('pg')
const wrapper = require ('../Client/postgresql.js')

module.exports = class {

    constructor (o) {
        this.options = o
        this.backend = new Pool (o)
    }
    
    async acquire () {  // darn (`${this.backend.totalCount} ${this.backend.idleCount} ${this.backend.waitingCount}`)    
        return new wrapper (await this.backend.connect ())        
    }

    async release (client) {
        return await client.release ()
    }

}