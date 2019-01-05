const {Pool} = require ('pg')
const wrapper = require ('../Client/postgresql.js')

module.exports = class {

    constructor (o) {
        this.options = o
        this.backend = new Pool (o)
    }
    
    async acquire () {  // darn (`${this.backend.totalCount} ${this.backend.idleCount} ${this.backend.waitingCount}`)
        let raw = await this.backend.connect ()
        let c = new wrapper (raw)
        
/*    
        if (this.backend.is_txn_pending) {
            darn ('[WARNING] Got a dirty connection, rolling back uncommitted transaction')            
            (async () => {await this.rollback ()}) ()
        }
*/
        c.model = this.model
        return c
    }

    async release (client) {
        return await client.release ()
    }

}