const LOGICAL_OPERATORS = new Set(['and', 'or', 'not']);
const IN_SET_OPERATORS = new Set(['in', 'not in']);
const PRODUCT = Symbol ('__product__')
const T_23_59 = Symbol ('__t_23_59__')
module.exports = class {

    op (src) {switch (src) {
        case 'is':       return ' = ?'        
        case 'less':     return ' <= ?'        
        case 'more':     return ' >= ?'        
        case 'less!':    return ' < ?'
        case 'more!':    return ' > ?'
        case 'between':  return ' BETWEEN ? AND ?'
        case 'begins':   return ' ILIKE ?%'
        case 'ends':     return ' ILIKE %?'
        case 'contains': return ' ILIKE %?%'
        case 'misses':   return ' NOT ILIKE %?%'
        case 'in':       return ' IN '
        case 'not in':   return ' NOT IN '
        case 'null': throw '"null" must be replaced by "is" null'
        default: throw 'Unknown op: ' + src
    }}

    get_params (term) {
        if (typeof term != 'object') {
            return term;
        }
        if (term.field === undefined && Array.isArray(term.value)) {
            return term.value.map(sub => this.get_params(sub)).reduce((acc, val) => acc.concat(val), []);
        }

        return term.value;
    }

    adjust_term (s, nested = false) {
        // Nested terms
        if (s.field === undefined) {
            if (!LOGICAL_OPERATORS.has(s.operator)) {
                throw 'Unsupported operator: ' + s.operator;
            }
            
            if (!Array.isArray(s.value)) s.value = [s.value];
            for (let sub of s.value) this.adjust_term(sub, true);
            s.expr = (s.operator == 'not') ? `(NOT ${s.value[0].expr})` :
                `(${s.value.map(sub => sub.expr).join(` ${s.operator.toUpperCase()} `)})`;
            s.value = this.get_params(s);
            return;
        }
    
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

        switch (s.operator) {
        
        	case 'null':
				s.value = null
				s.expr = s.field
        		break
        		
        	case 'not null':
				s.value = null
				s.expr = s.field + ' <>'
        		break
        		
        	case 'contains':
        		if (this [PRODUCT] === 'clickhouse') {
        			s.expr = `(positionCaseInsensitiveUTF8(${s.field}, ?) > 0)`
        			break
        		}

        	default:
				s.expr = s.field + this.op (s.operator)
				if (s.value == null) s.value = undefined
        
        }
        
        if (Array.isArray (s.value)) {

        	if (s.type == 'date') {        	
				s.value = s.value.map (dt_iso)
				s.value [1] += this [T_23_59]
        	}
        	else {        	
	            s.value = s.value.map ((o) => typeof o == 'object' ? o.id : o)
        	}
            
        }
        else if (s.value != null) {
        
            s.value = String (s.value).trim ()
            
            if (s.expr.indexOf ('LIKE') > -1) {

            	s.value = s.value
					.replace (/\%/g, '\\%')
					.replace (/_/g,  '\\_')
					.replace (/[\*\s]+/g, '%')
					
				s.expr += " ESCAPE '\\'"
					
            }

            if (s.type == 'date') {
            	s.value = dt_iso (s.value)
				if (s.operator == 'less') s.value += this [T_23_59]
            }
        
        }

        if (nested && s.field) {
            if (IN_SET_OPERATORS.has(s.operator)) {
                s.expr += `(${s.value.map(() => '?').join(',')})`;
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

    constructor (q, db) {  
        this [PRODUCT] = db ? db.product : 'postgresql'
        this [T_23_59] = ['clickhouse', 'ods_dw'].includes (this [PRODUCT]) ? 'T23:59:59' : 'T23:59:59.999'
        this.set_sort (q.sort)
        this.set_search (q.search, q.searchLogic)
        if (q.limit > 0) this.LIMIT = [q.limit, q.offset]
    }

}