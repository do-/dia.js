module.exports = class {

    op (src) {switch (src) {
        case 'is':       return ' = ?'        
        case 'less':     return ' <= ?'        
        case 'more':     return ' >= ?'        
        case 'between':  return 'BETWEEN ? AND ?'
        case 'begins':   return ' ILIKE ?%'
        case 'ends':     return ' ILIKE %?'
        case 'contains': return ' ILIKE %?%'
        case 'in':       return ' IN '
        case 'not in':   return ' NOT IN '
        case 'null': throw '"null" must be replaced by "is" null'
        default: throw 'Unknown op: ' + src
    }}

    adjust_term (s) {
    
        if (s.operator == 'null') {
            s.operator = 'is'
            s.value = null
        }
        else if (s.value == null) {
            s.value = undefined
        }
        
        s.expr = s.field + this.op (s.operator)
        
        let dt_iso = (dt) => dt.substr (0, 10)
        
        if (Array.isArray (s.value)) {
        
            s.value = s.value.map (s.type == 'date' ? dt_iso : (o) => typeof o == 'object' ? o.id : o)            
            
        }
        else {
        
            s.value = String (s.value).trim ()            
            if (s.expr.indexOf ('LIKE') > -1) s.value = s.value.replace (/[\*\s]+/g, '%')
            if (s.type == 'date') s.value = dt_iso (s)
        
        }
    
    }
    
    set_and (search) {
        for (let term of search) this [term.expr] = term.value
    }
    
    set_or (search) {
    
        if (!search.length) return
        
        let [l, r] = [[], []]
        
        for (let term of search) {
            if (term.type == 'date') continue
            l.push (term.expr)
            r.push (term.value)
        }
        
        this [`(${l.join(' OR ')})`] = r
    
    }
        
    set_search (search, logic) {
    
        if (!search || !search.length || !logic) return
        
        for (let s of search) this.adjust_term (s)
    
        switch (logic) {
            case 'AND': return this.set_and (search)
            case 'OR' : return this.set_or  (search)
        }

    }

    set_sort (sort) {
    
        if (!sort) return
        
        this.ORDER = sort
            .map ((i) => `${i.field} ${i.direction.toUpperCase ()}`)
            .join (',')
            
    }

    constructor (q) {  
        this.set_sort (q.sort)
        this.set_search (q.search, q.searchLogic)
        if (q.limit > 0) this.LIMIT = [q.limit, q.offset]
    }

}