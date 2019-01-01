var console_log = console.log

console.log = function () {

    let dt = new Date ()
    
    dt.setMinutes (dt.getMinutes () - dt.getTimezoneOffset ())

    let a = [dt.toISOString ().substr (0, 23)]

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