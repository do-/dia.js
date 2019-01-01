const { Pool } = require ('pg')

$_DB.pool = new Pool ($_CONF.db)

$_DB.select_all = async (sql, params) => {

    if (!params) params = []
    
    return $_DB.pool.query (sql, params, (err, result) => {
    
        if (err) throw err
        
        return result.rows
    
    })

}