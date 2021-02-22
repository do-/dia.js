const path = require ('path')
const parser = require (path.resolve ('./Ext/Dia/Content/Handler/HTTP/Ext/odata/jaystack-odata-v4-parser/parser.js'))

module.exports = class {

	get_field (token) {	
		let {raw} = token		
		return raw	
	}

	get_value (token) {	

		let {raw, value} = token; switch (value) {
		
			case 'Edm.String':
				return raw.slice (1, raw.length - 1).replace (/''/g, "'") // '	

			default:
				return raw

		}

	}

	add_m_contains (token) {
		let [f, v] = token.value.parameters
		this.q += this.get_field (f) + ' ILIKE %?%'
		this.p.push (this.get_value (v))
	}

	add_m_startswith (token) {
		let [f, v] = token.value.parameters
		this.q += this.get_field (f) + ' ILIKE ?%'
		this.p.push (this.get_value (v))
	}

	add_m_endswith (token) {
		let [f, v] = token.value.parameters
		this.q += this.get_field (f) + ' ILIKE %?'
		this.p.push (this.get_value (v))
	}
	
	add_MethodCallExpression (token) {
		let {method} = token.value, k = 'add_m_' + method; if (!(k in this)) throw new Error (method + ' method is not supported')
		this [k].call (this, token)
	}

	add_EqualsExpression (token) {
		let {left, right} = token.value; if (right.value == 'null') {
			this.q += this.get_field (left) + ' IS NULL'
		}
		else {
			this.q += this.get_field (left) + ' = ?'
			this.p.push (this.get_value (right))
		}
	}

	add_NotEqualsExpression (token) {
		let {left, right} = token.value
		this.q += this.get_field (left) + ' <> ?'
		this.p.push (this.get_value (right))
	}

	add_LesserThanExpression (token) {
		let {left, right} = token.value
		this.q += this.get_field (left) + ' < ?'
		this.p.push (this.get_value (right))
	}

	add_LesserOrEqualsExpression (token) {
		let {left, right} = token.value
		this.q += this.get_field (left) + ' <= ?'
		this.p.push (this.get_value (right))
	}

	add_GreaterThanExpression (token) {
		let {left, right} = token.value
		this.q += this.get_field (left) + ' > ?'
		this.p.push (this.get_value (right))
	}

	add_GreaterOrEqualsExpression (token) {
		let {left, right} = token.value
		this.q += this.get_field (left) + ' >= ?'
		this.p.push (this.get_value (right))
	}

	add_NotExpression (token) {
		this.q += 'NOT ('
		this.add (token.value)
		this.q += ')'
	}

	add_AndExpression (token) {
		let {left, right} = token.value
		this.q += '(('
		this.add (left)
		this.q += ')AND('
		this.add (right)
		this.q += '))'
	}
	
	add_OrExpression (token) {
		let {left, right} = token.value
		this.q += '(('
		this.add (left)
		this.q += ')OR('
		this.add (right)
		this.q += '))'
	}
	
	add_BoolParenExpression (token) {
		this.add (token.value)
	}

	add (token) {
		let {type} = token, k = 'add_' + token.type; if (!(k in this)) throw new Error (type + ' tokens are not supported')
		this [k].call (this, token)
	}

    constructor (rq) {  
    	
    	let {$filter, $top, $skip, $orderby} = rq
    
        if ($orderby) this.ORDER = $orderby

        if ($top) this.LIMIT = [$top, $skip || 0]
        
        if ($filter) {
        
        	this.q = ''
        	this.p = []
        
        	this.add (parser.filter ($filter))
        	
        	this [this.q] = this.p
        	
        	delete this.q
        	delete this.p
        
        }
        
    }

}