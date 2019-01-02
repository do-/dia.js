module.exports = class {

    constructor (backend) {
        this.backend = backend
    }

    async release () {
        return await this.backend.release ()
    }

}