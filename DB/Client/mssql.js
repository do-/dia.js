const Dia = require ('../../Dia.js')
const { Readable } = require('stream');

module.exports = class extends Dia.DB.Client {

    async release (success) {

        this.backend.release ()

        return

    }

    log_label (sql, params) {

    	return (this.log_prefix || '') + sql.replace (/^\s+/g, '').replace (/\s+/g, ' ') + ' ' + JSON.stringify (params)

    }

    ph2np (sql, params = []) {

        let chunks = sql.split (/\?/),
            out_sql = chunks.shift (),
            out_params = []

        for (let i = 0; i < chunks.length; i++) {

            let p_name = 'p' + i;

            out_sql += ' @' + p_name + ' ' + chunks [i]

            out_params.push ([p_name, params [i]])
        }

        return [out_sql, out_params]

    }

    async do (sql, params = []) {

        let log_event = this.log_start (sql, params)

    	return new Promise ((ok, fail) => {

            const request = this.backend.request();

            [sql, params] = this.ph2np (sql, params);

            params.forEach (p => request.input (p [0], p[1]));

			request.query (sql, x => {

				this.log_finish (log_event)

				return x ? fail (x) : ok ()

			})

    	})

    }

    async select_hash (sql, params) {

        let log_event = this.log_start (sql, params)

    	return new Promise ((ok, fail) => {

            const request = this.backend.request();

            [sql, params] = this.ph2np (sql, params);

            params.forEach (p => request.input (p [0], p[1]));

			request.query (sql, (x, all, fields) => {

				this.log_finish (log_event)

				return x ? fail (x) : ok (all.recordset [0] || {})

			})

    	})

    }

    async select_all (sql, params) {

        let log_event = this.log_start (sql, params)

    	return new Promise ((ok, fail) => {

            const request = this.backend.request();

            [sql, params] = this.ph2np (sql, params);

            params.forEach (p => request.input (p [0], p[1]));

			request.query (sql, (x, all) => {

				this.log_finish (log_event)

				return x ? fail (x) : ok (all.recordset)

			})

    	})

    }

    async select_stream (sql, params, o) {

        let log_event = this.log_start (sql, params)

        const request = this.backend.request();

        [sql, params] = this.ph2np (sql, params);

		params.forEach (p => request.input (p [0], p[1]));

        request.stream = true

        o = o || {};
        o.objectMode = true;

        var stream = new Readable(o);

        stream._read = function() {
            request && request.resume();
        };

        stream.once('end', function() {
            process.nextTick(function () {
                stream.emit('close');
            });
        });

        request.on('recordset', columns => {
            stream.emit('columns', columns);
        })

        request.on('row', row => {
            if (!stream.push(row)) request.pause();
            stream.emit('result', row);
        });

        request.on('done', () => {
            stream.push(null);
        })

        request.on('error', function(err) {
            stream.emit('error', err);
        });

    	request.query (sql, params)

    	stream.on ('end', () => this.log_finish (log_event))

    	return stream

    }

}