const Dia = require ('../../Dia.js')

module.exports = class extends Dia.DB.Client {

    async release () {
        return await this.backend.release ()
    }
    
    async select_all (sql, params) {
        if (!params) params = []
        let label = sql + ' ' + JSON.stringify (params)
        console.time (label)
        let result = await this.backend.query (sql, params)
        console.timeEnd (label)
        return result.rows
    }
    
    async select_hash (sql, params) {
        let all = await this.select_all (sql, params)
        return all.length ? all [0] : {}
    }
    
    async select_scalar (sql, params) {
        let r = await this.select_hash (sql, params)
        for (let k in r) return r [k]
        return null
    }

}