const ESC = new Map ([
	['\\', '\\\\'],
	['\r', '\\r'],
	['\n', '\\n'],
	['\t', '\\t'],
].map (([k, v]) => [k.charCodeAt (0), v]))

const esc_tsv = s => {

	const {length} = s; if (length === 0) return s

	let result = '', from = 0, to = 0; while (to < length) {
	
		const c = s.charCodeAt (to); if (!ESC.has (c)) {
			
			to ++

			continue
			
		}

		result += s.slice (from, to) + ESC.get (c)

		from = ++ to

	}

	if (from === 0) return s

	return result + s.slice (from)

}

module.exports = esc_tsv