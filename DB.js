exports.Pool = (o, m) => {

    let dsn = o.connectionString
    
    if (!dsn) throw 'No connectionString: ' + JSON.stringify (o)
    
    let product = dsn.split (':') [0]
        
    let clazz = require ('./DB/Pool/' + product + '.js')
    
    let pool = new clazz (o)
    
    pool.model = m
    
    return pool

}

exports.Client = require ('./DB/Client.js')
exports.Model  = require ('./DB/Model.js')
exports.Query  = require ('./DB/Query.js')