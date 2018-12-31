const { Client } = require ('pg')

$_DB.cn = new Client ($_CONF.db)

$_DB.connect = async () => {
    darn ('Connecting to the database...')
    await $_DB.cn.connect ()
    darn (` ${$_DB.cn.user}@${$_DB.cn.host}:${$_DB.cn.port}/${$_DB.cn.database} ok.`)
}