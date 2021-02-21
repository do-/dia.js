"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var primitiveLiteral_1 = require("./primitiveLiteral");
var expressions_1 = require("./expressions");
var query_1 = require("./query");
var resourcePath_1 = require("./resourcePath");
var odataUri_1 = require("./odataUri");
exports.parserFactory = function (fn) {
    return function (source, options) {
        options = options || {};
        var raw = new Uint16Array(source.length);
        var pos = 0;
        for (var i = 0; i < source.length; i++) {
            raw[i] = source.charCodeAt(i);
        }
        var result = fn(raw, pos, options.metadata);
        if (!result)
            throw new Error("Fail at " + pos);
        if (result.next < raw.length)
            throw new Error("Unexpected character at " + result.next);
        return result;
    };
};
var Parser = /** @class */ (function () {
    function Parser() {
    }
    Parser.prototype.odataUri = function (source, options) { return exports.parserFactory(odataUri_1.default.odataUri)(source, options); };
    Parser.prototype.resourcePath = function (source, options) { return exports.parserFactory(resourcePath_1.default.resourcePath)(source, options); };
    Parser.prototype.query = function (source, options) { return exports.parserFactory(query_1.default.queryOptions)(source, options); };
    Parser.prototype.filter = function (source, options) { return exports.parserFactory(expressions_1.default.boolCommonExpr)(source, options); };
    Parser.prototype.keys = function (source, options) { return exports.parserFactory(expressions_1.default.keyPredicate)(source, options); };
    Parser.prototype.literal = function (source, options) { return exports.parserFactory(primitiveLiteral_1.default.primitiveLiteral)(source, options); };
    return Parser;
}());
exports.Parser = Parser;
function odataUri(source, options) { return exports.parserFactory(odataUri_1.default.odataUri)(source, options); }
exports.odataUri = odataUri;
function resourcePath(source, options) { return exports.parserFactory(resourcePath_1.default.resourcePath)(source, options); }
exports.resourcePath = resourcePath;
function query(source, options) { return exports.parserFactory(query_1.default.queryOptions)(source, options); }
exports.query = query;
function filter(source, options) { return exports.parserFactory(expressions_1.default.boolCommonExpr)(source, options); }
exports.filter = filter;
function keys(source, options) { return exports.parserFactory(expressions_1.default.keyPredicate)(source, options); }
exports.keys = keys;
function literal(source, options) { return exports.parserFactory(primitiveLiteral_1.default.primitiveLiteral)(source, options); }
exports.literal = literal;
//# sourceMappingURL=parser.js.map