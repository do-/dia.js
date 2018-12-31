const { Pool } = require ('pg')

$_DB.pool = new Pool ($_CONF.db)

$_DB.select_loop = (src, cb, params) => {
//    if (!params) params
}