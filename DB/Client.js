const Dia = require ('../Dia.js')

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

    async add_all_cnt (data, def, limit, offset = 0) {

        let q = new Dia.DB.Query (this.model, def)

        let [all, cnt] = await this.select_all_cnt (q.sql, q.params, limit, offset)
                
        data.all = all
        data.cnt = cnt
        
        return data

    }

    async add (data, def) {
        let q = new Dia.DB.Query (this.model, def)
        data [q.parts [0].alias] = await this.select_all (q.sql, q.params)
        return data
    }    
    
    async list (def) {
        let q = new Dia.DB.Query (this.model, def)
        return await this.select_all (q.sql, q.params)
    }

    async fold (def, callback, data) {
        let q = new Dia.DB.Query (this.model, def)
        await this.select_loop (q.sql, q.params, callback, data)
        return data
    }
    
    async update (table, data) {

        let def = this.model.tables [table]
        if (!def) throw 'Table not found: ' + table

        if (Array.isArray (data)) {
            for (let d in data) await this.update (table, d)
            return
        }

        let pk = data [def.pk]
        if (pk == undefined) throw 'No primary key supplied for ' + table + ': ' + JSON.stringify (data)
        delete data [def.pk]

        let [fields, params] = [[], [], []]

        for (let k in data) {
            let v = data [k]
            if (typeof v === 'undefined') continue
            fields.push (`${k}=?`)
            params.push (v)
        }
        params.push (pk)

        return this.do (`UPDATE ${table} SET ${fields} WHERE ${def.pk}=?`, params)

    }

}