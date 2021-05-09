const Dia = require ('./Dia.js')
const fs = require ('fs')
const Path = require ('path')
const ConsoleLogger = require ('./Log/ConsoleLogger.js')

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
		
		this._inc_fresh = {}
		
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

			for (let part of fs.readdirSync (lib)) {

				let get = i => i

				switch (part) {

					case 'Model':
						get = get_subdirs

					case 'Content':
						slice [part] = get (Path.join (lib, part))

				}

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

	get _content_paths () {

		delete this._content_paths;
	
		let value = Object.values (this._slices)
		
			.map (i => i.Content)
			
				.filter (i => i)
				
		Object.defineProperty (this, '_content_paths', {value, writable: false, configurable: true})
		
		return value

	}
	
	get_content_paths (name) {
	
		let fn = name + '.js', {_content_paths} = this
		
		let paths = _content_paths.filter (i => fs.existsSync (Path.resolve (i, fn)))
		
		if (paths.length == 0) darn (`Didn't find ${fn} in ${_content_paths}`)
		
		return paths
	
	}
	
	adjust_log_event (e) {
	
		if (!('uuid'  in e)) e.uuid  = Dia.new_uuid ()

		if (!('ts'    in e)) e.ts    = new Date ()

		if (!('level' in e)) e.level = 'info'

		if (e.phase == 'after' && !('duration' in e)) {
			e.duration = (e.ts_to = new Date ()) - e.ts
			e.message  = e.duration + ' ms'
		}

	}

	log_event (e) {

		this.adjust_log_event (e)

		this.get_logger (e.category).write (e)

	}
	
	get_logger (category) {
	
		return new ConsoleLogger ({category})
	
	}

}