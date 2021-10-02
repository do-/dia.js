const parser = require ('cron-parser')

module.exports = function (expression) {

	return function () {
	
		let interval = parser.parseExpression (expression)
		
		return interval.next ().toDate ()
	
	}

}