const { Client } = require ('pg')

$_DB.cn = new Client ($_CONF.db)

$_DB.get_banner = () => {
    return (`${$_DB.cn.user}@${$_DB.cn.host}:${$_DB.cn.port}/${$_DB.cn.database}`)
}

$_DB.connect = () => {
    darn ('Connecting to the database...')
    return $_DB.cn.connect ()
}

$_DB.select_loop = (src, cb, params) => {
//    if (!params) params
}