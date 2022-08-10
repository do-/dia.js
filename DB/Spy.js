module.exports = class {

    constructor (o = {}) {

		this.columns = {
			_id_rq  : {TYPE_NAME: 'uuid',   REMARK: 'Уникальный номер запроса', getter: h => h.uuid, NULLABLE: false},
			_type   : {TYPE_NAME: 'string', REMARK: 'Тип объекта', getter: h => (h.rq || {}).type},
			_id     : {TYPE_NAME: 'string', REMARK: 'Уникальный номер объекта', getter: h => (h.rq || {}).id},
			_action : {TYPE_NAME: 'string', REMARK: 'Действие', getter: h => (h.rq || {}).action},		
		}

		for (const [k, v] of Object.entries (o.columns || {})) 
		
			if (v === undefined) delete this.columns [k]; else this.columns [k] = v

    }

    get_signature (h) {

    	let o = {}; for (const [k, {getter}] of Object.entries (this.columns)) {

    		const v = getter (h)

    		o [k] = v == null ? null : v // undefined as null

    	}

    	return o

    }

}