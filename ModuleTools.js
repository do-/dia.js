const path = require ('path')
const fs   = require ('fs')

var inc_fresh = {}

exports.require_fresh = (type) => {

    const check = (abs, mtime) => {
        var old = inc_fresh [abs]
        if (old == mtime) return
        if (old < mtime) delete require.cache [abs]
        inc_fresh [abs] = mtime
    }

    var abs = path.resolve ('Content/' + type + '.js')
    check (abs, fs.statSync (abs).mtime)
    return require (abs)

}