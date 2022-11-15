const assert = require ('assert')
const Dia = require ('../../Dia.js')

module.exports = class extends Dia.DB.Client {

	async warehouse (sql, params) {
	
		const {handler, pool: {ods_name, dw_name}} = this, [db_dw, db_ods] = [dw_name, ods_name].map (k => handler [k])

		const m = /\b(?:FROM|UPDATE)\s+"?([\w\.]+)"?/gism.exec (sql); assert (m, `Can't get table name from ${sql}`)
		
    	const def = this.model.get_relation (m [1]);                  assert (def, `Can't get table definition for ${sql}`)

    	const {archive} = def;                                        assert (archive, def.name + ' is not archivable')
		
		return db_dw.insert (archive.name,

			(await db_ods.select_stream (sql, params))

		)
	
	}

    async get (def) {

		const {handler, pool: {ods_name, dw_name}} = this, [db_dw, db_ods] = [dw_name, ods_name].map (k => handler [k])

		const d = await db_ods.get (def)

		for (let k in d) return d

		return db_dw.get (def)

    }

    async add_all_cnt (data, def, limit, offset) {

        let q = this.query (def)        

        if (limit == undefined) limit = q.limit
        if (limit == undefined) throw 'LIMIT not set for add_all_cnt: ' + JSON.stringify (def)

        if (offset == undefined) offset = q.offset
        if (offset == undefined) offset = 0
        
        const [all, cnt] = await this.select_all_cnt (q.sql, q.params, limit, offset)

        data [q.parts [0].alias] = all
        data.cnt = cnt
        data.portion = limit

        return data

    }	

	async select_all_cnt (original_sql, original_params, limit, offset) {
	
		const {handler, pool: {ods_name, dw_name}} = this
		
		let dbs = [dw_name, ods_name].map (k => handler [k]); if (/\bDESC$/i.test (original_sql.trim ())) dbs.reverse () // njsscan-ignore: regex_dos

		const st_cnts = dbs.map (db => db.select_scalar (db.to_counting_sql (original_sql), original_params))

		let cnt = (await Promise.all (st_cnts)).map (i => parseInt (i))

		let st_data = []; for (let i of [0, 1]) {

			let available = cnt [i]

			if (offset >= available) {
				offset -= available
				continue
			}

			let num = available - offset; if (num > limit) num = limit
			
			const db = dbs [i], [q, p] = db.to_limited_sql_params (original_sql, original_params, limit, offset)

			st_data.push (db.select_all (q, p))

			limit  -= num;                if (limit <= 0) break

			offset -= cnt [i];            if (offset < 0) offset = 0

		}

		return [

			await (async st => {

				switch (st.length) {

					case 0: return []

					case 1: return st [0]

					default:

						let r = await Promise.all (st_data)

						return [...r [0], ...r [1]]

				}

			}) (st_data)

			, cnt [0] + cnt [1]

		]

	}

}