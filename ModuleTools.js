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

exports.new_uuid = () => {

    let id = ''
    
    let f = [
        () => {id += '-'},
        () => {
            let s = Math.floor (((1 << 16) - 1) * Math.random ()).toString (16)
            for (let j = 0; j < 4 - s.length; j ++) id += '0'
            id += s
        },
    ]
    
    for (i of [1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1]) f [i] ()
    
    return id

}
