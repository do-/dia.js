const path = require ('path')
const Event = require ('../Event.js')

const PATH_SEP = '/'

const normalize_path_sep = path.sep === PATH_SEP ? s => s : s => s.split (path.sep).join (PATH_SEP)

const ROOT = normalize_path_sep (path.resolve ('../..'))

module.exports = class extends Event {

    constructor (error) {

		if (!(error instanceof Error)) throw new Error ('Invalid argument: must be an Error')

		let o = {error} 
		
		const {log_meta} = error; if (log_meta) {

			let parent = null; for (let [k, v] of Object.entries (log_meta)) switch (k) {

				case 'parent':
					parent = v
					break			

				default:
					o [k] = v

			}

			if (parent) for (let k of ['uuid', 'category', 'parent']) o [k] = parent [k]

		}

		o.level = 'error'

		super (o)

	}

	get_message () {
			
		let {error} = this, {message, stack} = error, o = {stack}
		
		let lines = []; for (let i of stack.split ('\n')) {

			i = normalize_path_sep (i.trim ()).replace (ROOT, '')

			lines.push (i)

		}

		let our = -1; for (let i = lines.length - 1; i > 0 ; i --) {

			if (!lines [i].includes ('/Dia/') && !lines [i].includes ('/Content/')) continue

			our = i; break

		}

		if (our > -1) lines = lines.slice (0, our + 1)

		return lines.join (' ')

	}

}