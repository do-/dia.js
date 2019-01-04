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
    
    to_counting_sql (original_sql) {
        return original_sql.replace (/ORDER BY.*/, '').replace (/SELECT.*?\s+FROM\s+/, 'SELECT COUNT(*) FROM ')
    }

    async select_all_cnt (original_sql, original_params, limit, offset = 0) {
    
        let [limited_sql, limited_params] = this.to_limited_sql_params (original_sql, original_params, limit, offset)

        return Promise.all ([
            this.select_all (limited_sql, limited_params),
            this.select_scalar (this.to_counting_sql (original_sql), original_params),
        ])
    
    }

}