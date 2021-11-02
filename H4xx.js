{

	const off = (new Date ()).getTimezoneOffset (), lag = off * 60000

	const TZ_HH_MM =
		(off > 0 ? '-' : '+') +
		(new Date (2000, 1, 1, 0, -2 * off, 0))
			.toJSON ()      // 2000-02-01T03:00:00.000Z in MSK
			.slice (11, 16)	// 03:00

	Date.prototype.toISOZString = Date.prototype.toISOString

	Date.prototype.toISOString = function () {
	
		return (new Date (this.getTime () - lag)) // Greenwich date with time like local one

			.toISOZString ().substr (0, 23)       // YYYY-MM-DDThh:mm:ss.iii

			+ TZ_HH_MM                            // with our TZ suffix appended

	}

}

{

	const console_log = console.log

	console.log = function () {

		let a = [new Date ().toISOString ()]

		for (let i of arguments)
			if (a.length == 1 && typeof i == 'string' && i.indexOf ('%s') > -1)
				a [0] += ' ' + i; else a.push (i)

		console_log.apply (console, a)

	}

}

global.clone = (o) => {
	if (typeof o != 'object') return o
    return JSON.parse (JSON.stringify (o))
}

global.darn = (o) => {
    console.log (o)
    return (o)
}

global.suicide = (x) => {
    darn ('[ERROR] ' + x)
    process.exit (1)
}

global.not_off = (i) => !i.off

global.dt_iso = (dt) => {
	let ymd = dt.substr (0, 10).split (/\D/)
	if (ymd [0].length == 2) ymd.reverse ()
	return ymd.join ('-')
}

global.is_uuid = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test (s)

global.ZERO_UUID = '00000000-0000-0000-0000-000000000000'
