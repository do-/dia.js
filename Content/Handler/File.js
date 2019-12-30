const Handler = require ('../Handler')
const fs      = require ('fs')

exports.Handler = class extends Handler {

    check () {
    
		let fn = this.rq.path
		
        if (!fs.existsSync (fn)) throw 'File not found: ' + fn

		darn (this.uuid + ': found ' + fn)

    }

    async release_resources () {

    	await super.release_resources ()

 		try {

 			let fn = this.rq.path

			if (fs.existsSync (fn)) fs.unlinkSync (fn)

			darn (this.uuid + ': deleted ' + fn)

        }
		catch (x) {

			darn (x)

		}

    }	

}