module.exports = class {

    constructor (model, other) {
    
        this.model = model
        this.cols  = []
        
        let query = this           
        
        this.Part = class {

            constructor (value) {
            
                if (value instanceof Object) for (let k in value) this [k] = value [k]; else this [value] = {}
                
                for (let k in this) {
                    let v = this [k]
                    delete this [k]
                    let src = k.trim ()

                    let join_hint
                    [src, join_hint] = src.split (/\s+ON\s+/)
                    if (join_hint) this.join_hint = join_hint
                    
                    if (src.indexOf ('(') >= 0) {
                        let [pre, c, post] = src.split (/[\(\)]/)
                        this.cols = c ? c.split (',') : []
                        src = pre + post
                    }
                    else {
                        this.cols = undefined
                    }
                    
                    let [t, a] = src.split (/\s+AS\s+/)
                    
                    t = t.trim ()
                    if (t.charAt (0) == '$') {
                        t = t.substr (1)
                        this.is_inner = 1
                    }                    
                    
                    this.table = t
                    if (!model.relations [this.table]) throw new Error ('Model misses the definition of ' + this.table)
                    this.alias = (a || t).trim ()
                    
                    let part = this

                    this.Filter = class {
                    
                        adjust_wildcards () {
                        
                            if (this.sql.indexOf ('%') < 0 ) return

                            let parts = this.sql.split (/(\%?\?\%?)/)
                            let i = 0
                            this.sql = ''

                            for (let part of parts) switch (part) {
                                case '?':
                                case '?%':
                                case '%?':
                                case '%?%':
                                    switch (part) {
                                        case '?%':
                                            this.params [i] += '%'
                                            break
                                        case '%?':
                                            this.params [i] = '%' + this.params [i]
                                            break
                                        case '%?%':
                                            this.params [i] = '%' + this.params [i] + '%'
                                            break
                                    }
                                    i ++
                                    part = '?'
                                default:
                                    this.sql += part
                            }
                        
                        }
                        
                        parse_col_etc_other (col_etc_other) {

                            let [_, col, etc, other] = col_etc_other
                            
                            this.cols = [col]

                            if (this.is_null) other = other.trim () == '<>' ? ' IS NOT NULL' : ' IS NULL'

                            if (!other) other = this.params.length == 1 && !this.subquery ? '=' : ' IN'

                            let sql = `(${part.alias}.${col}`
                            if (etc) sql += ` IS NULL OR ${part.alias}.${col}`

                            sql += other

                            if (!this.is_null && other.indexOf ('?') < 0) {

                                if (/IN$/.test (other)) {

                                    if (this.subquery) {                                    
                                        sql += ` (${this.subquery.sql})`
                                        this.params = this.subquery.params
                                    }
                                    else {
                                        sql += ' (?'
                                        for (let i = 0; i < this.params.length - 1; i ++) sql += ',?'
                                        sql += ')'
                                    }
                                    
                                }
                                else if (/BETWEEN$/.test (other)) {
                                    sql += '? AND ?'
                                }
                                else if (/LIKE$/.test (other)) {
                                    sql += ' ?'
                                }
                                else {
                                    sql += '?'
                                }

                            }

                            return sql + ')'
                        
                        }
                        
                        adjust_field_names (src) {

                            let re_name = /\b([a-z_][a-z_0-9]*)\b/
                            
                            let chunks = src.split (re_name)

                            let max_i = chunks.length - 1
                            
                            this.cols = []

                            for (let i = 0; i <= max_i; i ++) {
                                                        
                                let is_special = (c) => c == "'" || c == "."   
                                
                                if (i > 0) {
                                
                                    let prev = chunks [i - 1]
                                
                                	if (is_special (prev.charAt (prev.length - 1))) continue

                                	if (/::$/.test (prev)) continue
                                
                                }

                                if (i < max_i) {
                                
                                	let next = chunks [i + 1]

                                	if (is_special (next.charAt (0))) continue

                                	if (/^\s*\(/.test (next)) continue
                                
                                }

                                if (!re_name.test (chunks [i])) continue
                                
                                this.cols.push ('' + chunks[i])

                                chunks [i] = `${part.alias}.${chunks[i]}`

                            }

                            return chunks.join ('')
                            
                        }
                        
                        adjust_date_params (columns) {

                        	if (this.cols.length !== 1) return

                        	const def = columns [this.cols [0]]; if (!def) return

                        	const {TYPE_NAME} = def, is_ts = /^(DATETIME|TIMESTAMP)$/i.test (TYPE_NAME)

                        	if (!is_ts) return
                        	
                        	const fix = v => typeof v === 'string' && v.length === 10 ? v + 'T00:00:00' : v
                        	
                        	this.params = this.params.map (fix)
                        	
                        }
                        
                        adjust_date_filter (columns) {
                        
                        	if (this.params.length != 1) return
                        	let [param] = this.params
                        	
                        	if (typeof param != 'string') return
                        	if (param.length != 10) return
                        	
                        	if (!/ = \?$/.test (this.sql)) return

                        	if (this.cols.length != 1) return   
                        	let def = columns [this.cols [0]]; if (!def) return
                        	if (!/^(DATETIME|TIMESTAMP)$/.test (def.TYPE_NAME)) return
                        	
                        	let d = new Date (param); d.setDate (1 + d.getDate ())
                        	let [col] = this.sql.split (/ = /)
                        	
                        	this.sql    = `(${col} >= ? AND ${col} < ?)`
                        	this.params = [param + ' 00:00:00', d.toJSON ().slice (0, 10) + ' 00:00:00']

                        }

                        constructor (src, val, columns) {
                        
                            if (typeof val === 'object' && val != null && val.sql && val.params) this.subquery = val

                            if (val === null && typeof val === 'object') {
                                this.is_null = true
                                this.params = []
                            }
                            else {
                                this.params = Array.isArray (val) ? val : [val]
                            }
                            
                            src = src.trim ()
                            
                            let col_etc_other = /^(\w+)(\.\.\.)?(\s*(?:NOT\s+)?\S*)\s*$/.exec (src)

                            if (col_etc_other) {
                            
                                this.sql = this.parse_col_etc_other (col_etc_other)
                            
                            }
                            else {
                            
                                this.sql = this.adjust_field_names (src)
                                
                                this.adjust_date_filter (columns)
                                this.adjust_date_params (columns)
                                
                            }

                            this.adjust_wildcards ()

                        }

                    }

                    this.filters = []
                    
                    let def = model.relations [this.table]

                    if (typeof v !== 'object') v = {[def.pk]: v}

                    for (let fs in v) {
                    
                        let val = v [fs]

                        if (typeof val === 'undefined') continue
                        
                        switch (fs) {
                        
                            case 'ORDER':
                                query.order = val.trim ()
                                	.split (/\s*,\s*/)
                                	.map (i => i.indexOf ('.') > 0 ? i : this.alias + '.' + i)
                                	.join (',')
                                break
                                
                            case 'LIMIT':                            
                                query.set_limit (val)
                                break
                                
                            default:                            
                            	let existing = def.columns, filter = new this.Filter (fs, val, existing)
                            	if (0 == filter.cols.filter (name => !existing [name]).length) 
                            		this.filters.push (filter)

                        }

                    }

                }

            }
            
            adjust_cols () {
            
                let part = this
            
                this.Col = class {

                    constructor (src) {
                    
                        let [expr, alias] = src.split (/\s+AS\s+/)

                        this.part = part
                        this.expr = expr.trim ()

                        this.alias = (alias || expr).trim ()
                        
                        if (part.is_root) {
                            if (this.expr == this.alias) delete this.alias
                        }
                        else {
                            this.alias = `${part.alias}.${this.alias}`
                        }
                        
                        this.expr = part.alias + '.' + this.expr                        
                        this.sql = `\n\t${this.expr}`
                        if (this.alias) this.sql += ` AS "${this.alias}"`

                    }

                }
                
                if (this.cols == undefined) this.cols = ['*']

                let cols = []; for (let src of this.cols) {

                    if (src == '*') {
                        for (let c in model.relations [part.table].columns) cols.push (new this.Col (c))
                    }
                    else {
                        cols.push (new this.Col (src))
                    }

                }
                
                this.cols = cols
                
                for (let col of cols) query.cols.push (col)
                 
            }
            
            adjust_join () {
            
                let adjust_hint = (hint) => {
                    if (!hint) return undefined
                    if (hint.indexOf ('=') > -1) return hint                    
                    if (hint.indexOf ('.') < 0) hint = `${query.parts[0].alias}.${hint}`                    
                    return `${hint}=${this.alias}.${model.relations[this.table].pk}`
                }
                
                let find_ref_from_prev_part = () => {
                    for (let part of query.parts) {
                        if (part === this) return undefined
                        let table = model.relations [part.table]
                        if (!table) throw new Error ('Table not found: ' + part.table)
                        let cols = table.columns
                        let ref_col_names = []
                        for (let name in cols) if (cols [name].ref == this.table) ref_col_names.push (name)
                        switch (ref_col_names.length) {
                            case 0: continue
                            case 1: return `${part.alias}.${ref_col_names[0]}=${this.alias}.${model.relations[this.table].pk}`
                            default: throw new Error (`Ambiguous join condition for ${this.alias}`)
                        }
                    }
                }
                
                let find_ref_to_prev_part = () => {
                    let table = model.relations [this.table]
                    if (!table) throw new Error ('Table not found: ' + this.table)
                    let cols = table.columns
                    for (let part of query.parts) {
                        if (part === this) return undefined
                        let ref_col_names = []
                        for (let name in cols) if (cols [name].ref == part.table) ref_col_names.push (name)
                        switch (ref_col_names.length) {
                            case 0: continue
                            case 1: return `${this.alias}.${ref_col_names[0]}=${part.alias}.${model.relations[part.table].pk}`
                            default: throw new Error (`Ambiguous join condition for ${this.alias}`)
                        }
                    }
                }
                
                if (!this.is_root) {
                                        
                    if (!(                    
                        this.join_condition = adjust_hint (this.join_hint)
                            || find_ref_from_prev_part ()
                            || find_ref_to_prev_part ()                            
                    )) throw new Error ('No join condition found for ' + this.alias)
                    
                }
                                    
                this.sql = '\n\t'
                
                if (!this.is_root) {
                    this.sql += this.is_inner ? 'INNER' : 'LEFT'
                    this.sql += ' JOIN '
                }
                this.sql += this.table
                if (this.table != this.alias) this.sql += ` AS ${this.alias}`
                if (!this.is_root) {
                    this.sql += ` ON (${this.join_condition}`
                    for (let filter of this.filters) {
                        this.sql += ` AND ${filter.sql}`
                        for (let param of filter.params) query.params.push (
                            typeof param !== 'boolean' ? param :
                            param ? 1 :
                            0
                        )
                    }
                    this.sql += ')'
                }
                        
            }
           

        }

        this.parts = Array.isArray (other) ? other.map ((x) => new this.Part (x)) : [new this.Part (other)]
        this.parts [0].is_root = true
        for (let part of this.parts) part.adjust_cols ()

        this.params = []
        for (let part of this.parts) part.adjust_join ()
        
        let get_sql = (x) => x.sql
        
        this.sql = 'SELECT '
        this.sql += this.cols.map (get_sql)
        this.sql += '\nFROM '
        this.sql += this.parts.map (get_sql).join ('')
        
        let filters = this.parts [0].filters
        if (filters.length) {
            this.sql += '\nWHERE '
            this.sql += filters.map (get_sql).join ('\n\tAND ')
            for (let filter of filters) for (let param of filter.params) this.params.push (param)
        }
        
        if (this.limit) {
        	this.sql_cnt = 'SELECT COUNT(*) FROM ' + this.parts.filter (p => p.is_root || p.is_inner	).map (get_sql).join ('')
	        if (filters.length) this.sql_cnt += ' WHERE ' + filters.map (get_sql).join (' AND ')
        }

        if (this.order) this.sql += `\nORDER BY \n\t ${this.order}`

    }

    set_limit (val) {    
        if (Array.isArray (val)) return this.set_limit_offset (val)
        this.limit  = val
        this.offset = 0
    }

    set_limit_offset (val) {
        this.limit  = val [0]
        this.offset = val [1] || 0
    }

}