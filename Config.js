const fs = require ('fs')
const Path = require ('path')

const get_subdirs_1 = (p) => 

	fs.readdirSync (p)

		.map (f => Path.join (p, f))

			.filter (p => fs.statSync (p).isDirectory ())

const get_subdirs = (p) => 

	[p, ...get_subdirs_1 (p)
	
		.map (get_subdirs)
			
			.reduce ((a, b) => [...a, ...b], [])]
	
module.exports = class {

    constructor (o = '') {

    	if (typeof (o) == 'string') o = {_config: {path: o}}

    	let {path, encoding} = o._config

        const conf = JSON.parse (fs.readFileSync (
        	path     || '../conf/elud.json', 
        	encoding || 'utf8'
        ))

        for (let k in conf) this [k] = conf [k]

		this._slices = this.load_slices ()
		
	}
	
	is_slice_to_load (name) {

		return true

	}	
	
	load_slices () {
	
		let slices = {_: this.load_slice ('.')}
		
		try {
		
			let root = '../../slices'
		
			for (let name of fs.readdirSync (root)) 
			
				if (this.is_slice_to_load (name))

					slices [name] = this.load_slice (`${root}/${name}/back/lib`)

		}
		catch (x) {

			if (x.code != 'ENOENT') throw x

		}

		return slices
	
	}
	
	load_slice (lib) {
	
		lib = Path.resolve (lib)

		let slice = {lib}

		try {

			for (let part of fs.readdirSync (lib)) 
			
				switch (part) {
				
					case 'Content':
					case 'Model':

						slice [part] = get_subdirs (Path.join (lib, part))
				
				}
			

		}
		catch (x) {

			if (x.code != 'ENOENT') throw x

		}

		return slice

	}
	
	get _model_paths () {
	
		return Object.values (this._slices)
		
			.map (i => i.Model || [])
			
				.reduce ((a, b) => [...a, ...b], [])

	}

}