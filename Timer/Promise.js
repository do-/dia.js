const assert = require ('assert')

module.exports = class extends Promise {

	constructor (timer, comment = 'starting as Promise') {

		assert (timer, 'timer not set')

		timer.throttle.tolerance = 1

		super ((ok, fail) => {

		timer.addListener ('stop', () => {

				const {result, error} = timer.executor

				if (error) return fail (error)

				return ok (result)

			})

		})

		timer.on (comment)

	}

}