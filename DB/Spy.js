module.exports = class {

    constructor () {

		this.columns = {
			_id_rq  : {TYPE_NAME: 'uuid',   REMARK: 'Уникальный номер запроса', getter: h => h.uuid, NULLABLE: false},
			_type   : {TYPE_NAME: 'string', REMARK: 'Тип объекта', getter: h => (h.rq || {}).type},
			_id     : {TYPE_NAME: 'string', REMARK: 'Уникальный номер объекта', getter: h => (h.rq || {}).id},
			_action : {TYPE_NAME: 'string', REMARK: 'Действие', getter: h => (h.rq || {}).action},		
		}

		this.verbose = 0

    }

    get_signature (h) {

    	let o = {}; for (const [k, {getter}] of Object.entries (this.columns)) if (getter) {

    		const v = getter (h)

    		o [k] = v == null ? null : v // undefined as null

    	}

    	return o

    }

}