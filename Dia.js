var Date_prototype_toISOString = Date.prototype.toISOString
Date.prototype.toISOString = function () {

    let off = this.getTimezoneOffset ()
    
    let dt  = new Date (this.getTime ())
    dt.setMinutes (dt.getMinutes () - off)
    
    let s = Date_prototype_toISOString.call (dt).substr (0, 23)
            
    if (off < 0) {
        s += '+'
        off = -off
    }
    else {
        s += '-'
    }    
    
    let dd = (n) => {
        if (n < 10) s += '0'
        s += n
    }

    dd (Math.floor (off / 60))
    s += ':'
    dd (off % 60)    
    
    return s

}

var console_log = console.log

console.log = function () {

    let a = [new Date ().toISOString ()]

    for (let i of arguments) {

        if (a.length == 1 && typeof i == 'string' && i.indexOf ('%') > -1) {
            a [0] += ' ' + i          
        }
        else {
            a.push (i)
        }
        
    }
    
    console_log.apply (console, a)
    
}

global.darn = (o) => {
    console.log (o)
    return (o)
}

global.suicide = (x) => {
    darn ('[ERROR] ' + x)
    process.exit (1)
}

darn ("Dia.js is loading...")

reExport ('Conf')
reExport ('ModuleTools')
reExport ('DB')
reExport ('HTTP')
    
function reExport (module_name) {

    try {
        var m = require ('./' + module_name + '.js')
        for (var i in m) exports [i] = m [i]
    }
    catch (x) {
        suicide (x)
    }

}