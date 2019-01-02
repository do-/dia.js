module.exports = class {

    constructor (backend) {
        this.backend = backend
    }

    async select_vocabulary (t, o = {}) {
    
        if (!o.order) o.order = 2

        let filter = 'fake = 0'
        if (o.filter) filter += ` AND ${o.filter}`
        
        if ((o.label = o.label || 'label') != 'label') o.label = o.label.replace (/ AS.*/, '') + ' AS label'

        return this.select_all (`SELECT id, ${o.label} FROM ${t} WHERE ${filter} ORDER BY ${o.order}`)

    }

    async add_vocabularies (data, def) {

        for (let name in def) {            
            let o = def [name] || {}            
            if (!o.off) data [name] = await this.select_vocabulary (o.name || name, o)        
        }

        return data

    }

}