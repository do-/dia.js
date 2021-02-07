const parser = require ('odata-parser')

const ops = {
	eq: '=',
	ne: '<>',
	lt: '<',
	le: '<=',
	gt: '>',
	ge: '>=',
}

module.exports = class {

	to_kv_f_substringof (args) {
	
		let [{value}, {name}] = args
		
		return [name + ' ILIKE %?%', value]
		
	}

	to_kv_f (o, v) {
	
		return this ['to_kv_f_' + o.func] (o.args.map (i => i.func == 'tolower' ? i.args [0] : i))

	}

	to_kv (o) {
	
		let {type} = o, croak = () => {throw new Error ('Cannot filter on ' + JSON.stringify (o))}

		if (type == 'functioncall') return this.to_kv_f (o)

		let op = ops [type]; if (!op) croak ()
		
		let k, v = []; for (let i of ['left', 'right']) {
		
			let {type, name, value} = o [i]; switch (type) {
			
				case 'property':
					k = `${name} ${op} ?`
					break

				case 'literal':
					v.push (value)
					break

				default:
					croak ()

			}
			
		}
		
		return [k, v]
	
	}

	add_filter (o) {
	
		let [k, v] = this.to_kv (o)
		
		this [k] = v

	}
	
	parse_filter (src) {
	
		if (!src) return
		
		let o = parser.parse ('$filter=' + src) ['$filter']
		
		while (o.type == 'and') {
		
			this.add_filter (o.left)
			
			o = o.right
		
		}

		this.add_filter (o)
		
	}

    constructor (rq) {  
    	
    	let {$filter, $top, $skip, $orderby} = rq
    	
    	this.parse_filter ($filter)
    
        if ($orderby) this.ORDER = $orderby

        if ($top) this.LIMIT = [$top, $skip || 0]
        
    }

}