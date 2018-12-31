global.darn = (o) => {
    console.log (new Date ().toISOString (), o)
    return (o)
}

darn ("Dia.js is loading...")

reExport ('Conf');
reExport ('ModuleTools');
reExport ('HTTP');

function reExport (module_name) {
    var m = require ('./' + module_name + '.js')
    for (var i in m) exports [i] = m [i]
}