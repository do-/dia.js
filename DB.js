exports.Pool = (o) => {

    let dsn = o.connectionString
    
    if (!dsn) throw 'No connectionString: ' + JSON.stringify (o)
    
    let product = dsn.split (':') [0]
    
    let clazz = require ('./DB/Pool/' + product + '.js')
    
    return new clazz (o)

}

exports.Client = require ('./DB/Client.js')