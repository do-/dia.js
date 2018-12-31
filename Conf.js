const fs   = require ('fs')
const path = require ('path')

var fn = path.resolve (process.env.DIA_JS_CONFIGURATION_FILE_PATH || '../conf/elud.json')

darn (`Loading configuration from ${fn}...`)

global.$_CONF = JSON.parse (fs.readFileSync (fn, 'utf8'))

darn (` ...ok`)