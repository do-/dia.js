module.exports = class {

    constructor (model, ...other) {

        this.model = model

        this.Part = class {

            constructor (value) {

                if (value instanceof Object) for (let k in value) this [k] = value [k]; else this [value] = {}
                
                for (let k in this) {
                    let v = this [k]
                    delete this [k]
                    let src = k.trim ()
                    
                    if (src.indexOf ('(') >= 0) {
                        let [pre, c, post] = src.split (/[\(\)]/)
                        this.cols = c ? c.split (',') : []
                        src = pre + post
                    }
                    else {
                        this.cols = undefined
                    }
                    
                    let [t, a] = src.split (/\s+AS\s+/)
                    this.table = t.trim ()
                    this.alias = (a || t).trim ()
this.src = src                    
                    this.filters = v
                }

            }
            
            adjust_cols () {
            
                let part = this
            
                this.Col = class {

                    constructor (src) {
                        let [expr, alias] = src.split (/\s+AS\s+/)
                        this.part = part
                        this.expr = expr.trim ()
                        this.alias = (alias || expr).trim ()
                    }

                }
                
                if (this.cols == undefined) this.cols = part.is_root ? ['*'] : ['id', 'label']
                
                let cols = []; for (let src of this.cols) {
                
                    cols.push (new this.Col (src))
                
                }
                
                this.cols = cols

            }

        }

        this.parts = other.map ((x) => new this.Part (x))
        this.parts [0].is_root = true
        for (let part of this.parts) part.adjust_cols ()

    }

}