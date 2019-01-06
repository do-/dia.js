Date.prototype.toISOZString = Date.prototype.toISOString
Date.prototype.toISOString = function () {

    let off = this.getTimezoneOffset ()
    
    let dt  = new Date (this.getTime ())
    dt.setMinutes (dt.getMinutes () - off)
    
    let s = dt.toISOZString ().substr (0, 23)
            
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

    for (let i of arguments)
        if (a.length == 1 && typeof i == 'string' && i.indexOf ('%s') > -1)
            a [0] += ' ' + i; else a.push (i)

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