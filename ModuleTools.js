exports.new_uuid = () => {

    let id = ''
    
    let f = [
        () => {id += '-'},
        () => {
            let s = Math.floor (((1 << 16) - 1) * Math.random ()).toString (16)
            for (let j = 0; j < 4 - s.length; j ++) id += '0'
            id += s
        },
    ]
    
    for (i of [1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1]) f [i] ()
    
    return id

}
