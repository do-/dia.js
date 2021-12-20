const ESC = new Map ([
	['\\', '\\\\'],
	['\r', '\\r'],
	['\n', '\\n'],
	['\t', '\\t'],
].map (([k, v]) => [k.charCodeAt (0), v]))

const esc_tsv = s => {

	const {length} = s; if (length === 0) return s

	let result = '', from = 0, to = 0

	while (to < length) {
	
		const c = s.charCodeAt (to)

		if (ESC.has (c)) {

			result += s.slice (from, to)
			
			result += ESC.get (c)

			to ++

			from = to
		
		}
		else {

			to ++

		}

	}

	return result + s.slice (from)

}

module.exports = esc_tsv