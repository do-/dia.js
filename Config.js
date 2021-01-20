const fs = require ('fs')

module.exports = class {

    constructor (o = '') {

    	if (typeof (o) == 'string') o = {_config: {path: o}}

    	let {path, encoding} = o._config

        const conf = JSON.parse (fs.readFileSync (
        	path     || '../conf/elud.json', 
        	encoding || 'utf8'
        ))

        for (let k in conf) this [k] = conf [k]

	}

}