const TYPE_MAP = new Map ([
	[0, 'string'],
	[1, 'number'],
	[2, 'date'],
])

const AGGR_MAP = new Map ([
	['sum',   'SUM'],
	['min',   'MIN'],
	['max',   'MAX'],
	['avg',   'AVG'],
	['count', 'COUNT'],
])

const _sqlize_sum = list => {

	for (let i = 0; i < list.length; i ++) {

		let s = list [i]
		
		const aggr = AGGR_MAP.get (s.summaryType); if (!aggr) throw new Exception ('Invalid summaryType in ' + JSON.stringify (s))

		s.name = 'sum_' + i

		s.sql = aggr + '(t.' + s.selector + ') AS ' + s.name

	}

}

const _sqlize_group = list => {

	for (let i = 0; i < list.length;) {

		let s = list [i ++]
		
		s.no = i
		
		s.name = 'group_' + s.no

		s.sql = 'COALESCE(t.' + s.selector + ",'') AS " + s.name

		s.order = s.no 
		
		if (s.desc) s.order += ' DESC'
		
		s.order += ' NULLS FIRST'

	}

}

const _filter_params = a => {

	const {length} = a, is_last_array = Array.isArray (a [length - 1])

	if (length === 2 && a [0] === '!' && is_last_array) return _filter_params_unary (a)

	if (length === 3 && !is_last_array) return _filter_params_binary (a)

	if (length % 2 === 1 && is_last_array) return _filter_params_complex (a)
	
	throw new Error ('Invalid filter structure :' + JSON.stringify (a))

}

const _filter_params_complex = a => {

	let q = '', p = []
	
	for (let i of a) if (Array.isArray (i)) {
		
		const {filter, params} = _filter_params (i)
		
		q += '(' + filter + ')'
		
		p = [...p, ...params]
		
	} else q += i

	return {filter: '(' + q + ')', params: p}
	
}

const _filter_params_unary = a => {

	const {filter, params} = _filter_params (a [1])
	
	return {filter: 'NOT(' + filter + ')', params}

}

const _filter_params_binary = a => {

	let filter = '', params = [], [name, op, value] = a
	
		if (filter) filter += ' AND '
		
		filter += name
		
		if (op.length > 2) value = String (value).replace (/\\/g, '\\\\')
		
		switch (op) {
		
			case "=":
			case "<>": 
			case ">":
			case ">=": 
			case "<":
			case "<=": 
				filter += op + '?'
				params.push (value)
				break
				
			case "startswith":
				filter += ' ILIKE ?'
				params.push (value + '%')
				break

			case "endswith":
				filter += ' ILIKE ?'
				params.push ('%' + value)
				break

			case "contains":
				filter += ' ILIKE ?'
				params.push ('%' + value + '%')
				break

			case "notcontains":
				filter += ' ILIKE ?'
				params.push ('%' + value + '%')
				break
				
			default:
				throw new Error ('Unknown operator: ' + JSON.stringify (a))

		}
			
	return {filter, params}
	
}

const _tree_add = (a, key, is_last) => {

	const node = {key, items: is_last ? null: []}
	
	a.push (node)
	
	return node

}

const _tree_get = (a, key, is_last) => {

	const {length} = a; if (length === 0) return _tree_add (a, key, is_last)

	const last = a [length - 1]; if (last.key === key) return last

	return _tree_add (a, key, is_last)

}

const _tree_put = (a, path, data) => {

	const key = path.shift ()
	
	let node = _tree_get (a, key, path.length === 0)
	
	const {items} = node
	
	if (items !== null) return _tree_put (items, path, data)
	
	for (const i in data) node [i] = data [i]
		
}

module.exports = class {

	constructor (lo) {

		const {filter, take, skip, sort} = lo
		
		if (filter && filter.length !== 0) {
		
			const fp = _filter_params (filter)
			
			this [fp.filter] = fp.params
		
		}
		
		if (sort && sort.length !== 0) this.ORDER = '' + sort.map (({selector, desc}) => {

			if (!desc) return selector
			
			return selector + ' DESC'
			
		})
	
		if (take) this.LIMIT = [take, skip]

	}

}