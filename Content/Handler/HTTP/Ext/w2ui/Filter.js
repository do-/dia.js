module.exports = class {

    op (src) {switch (src) {
        case 'is':       return ' = ?'        
        case 'less':     return ' <= ?'        
        case 'more':     return ' >= ?'        
        case 'between':  return ' BETWEEN ? AND ?'
        case 'begins':   return ' ILIKE ?%'
        case 'ends':     return ' ILIKE %?'
        case 'contains': return ' ILIKE %?%'
        case 'in':       return ' IN '
        case 'not in':   return ' NOT IN '
        case 'null': throw '"null" must be replaced by "is" null'
        default: throw 'Unknown op: ' + src
    }}

    adjust_term (s) {
    
        if (s.operator == 'between') {
        
        	let [from, to] = s.value || []

        	if (!from && !to) {
        		s.value = null
        	}
        	else if (from && !to) {
        		s.operator = 'more'
        		s.value = from
        	}
        	else if (!from && to) {
        		s.operator = 'less'
        		s.value = to
        	}
        	        
        }

        if (s.operator == 'null') {
            s.operator = 'is'
            s.value = null
            s.expr = s.field
        }
        else {
        	s.expr = s.field + this.op (s.operator)
        	if (s.value == null) s.value = undefined
        }

        let dt_iso = (dt) => dt.substr (0, 10)
        
        if (Array.isArray (s.value)) {
        
        	if (s.type == 'date') {        	
				s.value = s.value.map (dt_iso)
				s.value [1] += 'T23:59:59.999'        	
        	}
        	else {        	
	            s.value = s.value.map ((o) => typeof o == 'object' ? o.id : o)
        	}
            
        }
        else if (s.value !== null) {
        
            s.value = String (s.value).trim ()            
            if (s.expr.indexOf ('LIKE') > -1) s.value = s.value.replace (/[\*\s]+/g, '%')
            
            if (s.type == 'date') {
            	s.value  = dt_iso (s.value)
				if (s.operator = 'less') s.value += 'T23:59:59.999'        	
            }
        
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