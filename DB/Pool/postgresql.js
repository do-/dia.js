const {Pool} = require ('pg')
const wrapper = require ('../Client/postgresql.js')

module.exports = class {

    constructor (o) {
        this.options = o
        this.backend = new Pool (o)
    }
    
    async acquire () {  // darn (`${this.backend.totalCount} ${this.backend.idleCount} ${this.backend.waitingCount}`)    
        let c = new wrapper (await this.backend.connect ())
        c.model = this.model        
        return c
    }

    async release (client) {
        return await client.release ()
    }

}