const Model = require ('../Model.js')
const assert = require ('assert')

const DEFAULTS = {
	extend_original : true,
	threshold       : 10,
	keep            : false,
}

module.exports = class extends Model {

    constructor (conf, o) {
    
        super ({conf, paths: []})

        this.ods_model = o.ods_model
        this.dw_model  = o.dw_model
        this.defaults  = o.defaults || {}
        
        for (const [k, v] of Object.entries (DEFAULTS)) if (!(k in this.defaults)) this.defaults [k] = v
        
        this.ods_model.on_after_resolve_column_references = () => this.fill_in ()

	}
	
	reload () {}
	
	fill_in () {

		const {ods_model} = this, {spy} = ods_model; if (spy) {
		
			for (const def of Object.values (spy.global_definitions)) {
			
				ods_model.add_definition (def)
				
			}
		
			for (const def of [...Object.values (ods_model.tables), ...Object.values (ods_model.partitioned_tables)]) if (spy.option_name in def) {
		
				const log_table = spy.to_logging_table (def)

				ods_model.add_definition (log_table)
			
			}
		
		}

		this.template = this.get_template ()			
			
		for (const def of [...Object.values (ods_model.tables), ...Object.values (ods_model.partitioned_tables)]) if ('archive' in def) {

			def.archive = this.adjust_options (def)

			this.dw_model.add_definition (this.to_dw (def))

			this.add_definition (this.to_ods_dw (def))

			if (def.archive.extend_original) this.apply_template (def)

		}

	}
	
	generate_name (def) {
	
		return def.name
	
	}

	generate_partition (def) {
	
		return {by: 'toYYYYMM(' + def.archive.pk [0] + ')'}
	
	}
	
	adjust_options (def) {
	
		const {archive, name} = def

		assert (Array.isArray (archive.pk), `${name}: invalid archive.pk`)
		assert.notStrictEqual (archive.pk.length, 0, `${name}: invalid archive.pk`)

		if (!('name' in archive))      archive.name      = this.generate_name (def)
		if (!('partition' in archive)) archive.partition = this.generate_partition (def)

		assert (!archive.except_columns || Array.isArray (archive.except_columns), `${name}: invalid archive.except_columns`)

		for (const [k, v] of Object.entries (this.defaults)) 

			if (!(k in archive) && v !== undefined)

				archive [k] = v

		return archive

	}
    
    to_ods_dw (def) {

    	const {name, label, pk, archive} = def, {except_columns} = archive

    	let columns = []; for (const [k, v] of Object.entries (clone (def.columns))) {

			if (except_columns && except_columns.includes (k)) continue

			if (!v) continue

			delete v.ref

			columns [k] = v

		}
				
		return {name, label, pk, columns, archive}

    }
    
    to_dw (def) {

    	const {name, label, pk, partition, except_columns} = def.archive

		const {on_cluster} = def

    	let columns = []; for (let [k, v] of Object.entries (def.columns)) {

			if (except_columns && except_columns.includes (k)) continue

			if (v !== -Infinity) {

				v = clone (v)

				delete v.ref

			}

			columns [k] = v

		}

		return {name, label, pk, partition, columns, on_cluster}

    }

    apply_template (def) {
    
    	const {template} = this, {archive} = def

		for (const k of ['columns', 'triggers']) {
		
			if (!(k in def)) def [k] = {}
		
			for (const {name, condition, src} of template [k]) {

				if (condition (def)) def [k] [name] = typeof src === 'object' ? {name, ...src} : src
				
			}

		}

    }
    
    get_template () {	

		return {

			columns: [
				
				{
				
					name: '_is_to_copy',
					
					condition: def => true,
					
					src: {TYPE_NAME: 'bool', COLUMN_DEF: '0', REMARK: 'true, если запись зафиксирована и готова для архивирования'},
				
				},
			
				{
				
					name: '_is_copied',
					
					condition: def => true,
					
					src: {TYPE_NAME: 'bool', COLUMN_DEF: '0', REMARK: 'true, если запись перенесена в dw'},
				
				},
			
				{
				
					name: '_is_to_delete',
					
					condition: def => true,
					
					src: {TYPE_NAME: 'bool', COLUMN_DEF: '0', REMARK: 'true, если запись можно удалить из основной OLTP-БД'},
				
				},
			
			],

			triggers: [
			
				{

					name: 'before_update_insert',
				
					condition: def => !def.archive.keep,

					src: function () {return `

						IF TG_OP = 'UPDATE' AND NOT OLD._is_copied AND NEW._is_copied THEN

							NEW._is_to_delete = true;

						END IF;

						RETURN NEW;

					`},
				
				},
				
				{

					name: 'after_update_insert',

					condition: def => parseInt (def.archive.threshold) > 0,
				
					src: function () {return `

						DECLARE
							_cnt int;

						BEGIN

							IF TG_OP = 'UPDATE' AND NOT OLD._is_copied AND NEW._is_copied THEN

								PERFORM pg_notify ('dia', '{"type":"_archive","action":"purge","id":"${this.name}"}');

							END IF;

							IF NEW._is_to_copy THEN

								IF TG_OP = 'INSERT' OR NOT OLD._is_to_copy THEN

									SELECT COUNT(*) INTO _cnt FROM ${this.name} WHERE _is_to_copy;

									IF _cnt >= ${this.archive.threshold} THEN

										PERFORM pg_notify ('dia', '{"type":"_archive","action":"copy","id":"${this.name}"}');

									END IF;

								END IF;

							END IF;

						RETURN NEW;

						END;

					`}
					
				},

			],

		}        	
    
    }

}