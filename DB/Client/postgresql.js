module.exports = class {

    constructor (backend) {
        this.backend = backend
    }

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

}