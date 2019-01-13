module.exports = class {

    constructor (o) {
        this.options = o
    }
    
    async load_schema () {
    
        try {
            var db = await this.acquire ()
            await db.load_schema ()
        }
        finally {
            this.release (db)
        }

    }

}