module.exports = {

	to_grid_packet: function (data) {

		let {from} = this.rq 

		delete data.portion
		
		let total_count = parseInt (data.cnt); delete data.cnt

    	for (let k in data) return {total_count, from, data: data [k]}
	
	},
	
	get_filter () {
	
		let {rq} = this
		
		return {LIMIT: [rq.limit, rq.from]}
	
	}

}