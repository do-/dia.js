"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var utils_1 = require("./utils");
var lexer_1 = require("./lexer");
var primitiveLiteral_1 = require("./primitiveLiteral");
var nameOrIdentifier_1 = require("./nameOrIdentifier");
var expressions_1 = require("./expressions");
var ArrayOrObject;
(function (ArrayOrObject) {
    function complexColInUri(value, index) {
        var begin = lexer_1.default.beginArray(value, index);
        if (begin === index)
            return;
        var start = index;
        index = begin;
        var items = [];
        var token = ArrayOrObject.complexInUri(value, index);
        if (token) {
            while (token) {
                items.push(token);
                index = token.next;
                var end = lexer_1.default.endArray(value, index);
                if (end > index) {
                    index = end;
                    break;
                }
                else {
                    var separator = lexer_1.default.valueSeparator(value, index);
                    if (separator === index)
                        return;
                    index = separator;
                    token = ArrayOrObject.complexInUri(value, index);
                    if (!token)
                        return;
                }
            }
        }
        else {
            var end = lexer_1.default.endArray(value, index);
            if (end === index)
                return;
            index = end;
        }
        return lexer_1.default.tokenize(value, start, index, { items: items }, lexer_1.default.TokenType.Array);
    }
    ArrayOrObject.complexColInUri = complexColInUri;
    function complexInUri(value, index) {
        var begin = lexer_1.default.beginObject(value, index);
        if (begin === index)
            return;
        var start = index;
        index = begin;
        var items = [];
        var token = ArrayOrObject.annotationInUri(value, index) ||
            ArrayOrObject.primitivePropertyInUri(value, index) ||
            ArrayOrObject.complexPropertyInUri(value, index) ||
            ArrayOrObject.collectionPropertyInUri(value, index) ||
            ArrayOrObject.navigationPropertyInUri(value, index);
        if (token) {
            while (token) {
                items.push(token);
                index = token.next;
                var end = lexer_1.default.endObject(value, index);
                if (end > index) {
                    index = end;
                    break;
                }
                else {
                    var separator = lexer_1.default.valueSeparator(value, index);
                    if (separator === index)
                        return;
                    index = separator;
                    token = ArrayOrObject.annotationInUri(value, index) ||
                        ArrayOrObject.primitivePropertyInUri(value, index) ||
                        ArrayOrObject.complexPropertyInUri(value, index) ||
                        ArrayOrObject.collectionPropertyInUri(value, index) ||
                        ArrayOrObject.navigationPropertyInUri(value, index);
                    if (!token)
                        return;
                }
            }
        }
        else {
            var end = lexer_1.default.endObject(value, index);
            if (end === index)
                return;
            index = end;
        }
        return lexer_1.default.tokenize(value, start, index, { items: items }, lexer_1.default.TokenType.Object);
    }
    ArrayOrObject.complexInUri = complexInUri;
    function collectionPropertyInUri(value, index) {
        var mark = lexer_1.default.quotationMark(value, index);
        if (mark === index)
            return;
        var start = index;
        index = mark;
        var prop = nameOrIdentifier_1.default.primitiveColProperty(value, index) ||
            nameOrIdentifier_1.default.complexColProperty(value, index);
        if (!prop)
            return;
        index = prop.next;
        mark = lexer_1.default.quotationMark(value, index);
        if (mark === index)
            return;
        index = mark;
        var separator = lexer_1.default.nameSeparator(value, index);
        if (separator === index)
            return;
        index = separator;
        var propValue = prop.type === lexer_1.default.TokenType.PrimitiveCollectionProperty
            ? ArrayOrObject.primitiveColInUri(value, index)
            : ArrayOrObject.complexColInUri(value, index);
        if (!propValue)
            return;
        index = propValue.next;
        return lexer_1.default.tokenize(value, start, index, { key: prop, value: propValue }, lexer_1.default.TokenType.Property);
    }
    ArrayOrObject.collectionPropertyInUri = collectionPropertyInUri;
    function primitiveColInUri(value, index) {
        var begin = lexer_1.default.beginArray(value, index);
        if (begin === index)
            return;
        var start = index;
        index = begin;
        var items = [];
        var token = ArrayOrObject.primitiveLiteralInJSON(value, index);
        if (token) {
            while (token) {
                items.push(token);
                index = token.next;
                var end = lexer_1.default.endArray(value, index);
                if (end > index) {
                    index = end;
                    break;
                }
                else {
                    var separator = lexer_1.default.valueSeparator(value, index);
                    if (separator === index)
                        return;
                    index = separator;
                    token = ArrayOrObject.primitiveLiteralInJSON(value, index);
                    if (!token)
                        return;
                }
            }
        }
        else {
            var end = lexer_1.default.endArray(value, index);
            if (end === index)
                return;
            index = end;
        }
        return lexer_1.default.tokenize(value, start, index, { items: items }, lexer_1.default.TokenType.Array);
    }
    ArrayOrObject.primitiveColInUri = primitiveColInUri;
    function complexPropertyInUri(value, index) {
        var mark = lexer_1.default.quotationMark(value, index);
        if (mark === index)
            return;
        var start = index;
        index = mark;
        var prop = nameOrIdentifier_1.default.complexProperty(value, index);
        if (!prop)
            return;
        index = prop.next;
        mark = lexer_1.default.quotationMark(value, index);
        if (mark === index)
            return;
        index = mark;
        var separator = lexer_1.default.nameSeparator(value, index);
        if (separator === index)
            return;
        index = separator;
        var propValue = ArrayOrObject.complexInUri(value, index);
        if (!propValue)
            return;
        index = propValue.next;
        return lexer_1.default.tokenize(value, start, index, { key: prop, value: propValue }, lexer_1.default.TokenType.Property);
    }
    ArrayOrObject.complexPropertyInUri = complexPropertyInUri;
    function annotationInUri(value, index) {
        var mark = lexer_1.default.quotationMark(value, index);
        if (mark === index)
            return;
        var start = index;
        index = mark;
        var at = lexer_1.default.AT(value, index);
        if (!at)
            return;
        index = at;
        var namespaceNext = nameOrIdentifier_1.default.namespace(value, index);
        if (namespaceNext === index)
            return;
        var namespaceStart = index;
        index = namespaceNext;
        if (value[index] !== 0x2e)
            return;
        index++;
        var term = nameOrIdentifier_1.default.termName(value, index);
        if (!term)
            return;
        index = term.next;
        mark = lexer_1.default.quotationMark(value, index);
        if (mark === index)
            return;
        index = mark;
        var separator = lexer_1.default.nameSeparator(value, index);
        if (separator === index)
            return;
        index = separator;
        var token = ArrayOrObject.complexInUri(value, index) ||
            ArrayOrObject.complexColInUri(value, index) ||
            ArrayOrObject.primitiveLiteralInJSON(value, index) ||
            ArrayOrObject.primitiveColInUri(value, index);
        if (!token)
            return;
        index = token.next;
        return lexer_1.default.tokenize(value, start, index, {
            key: "@" + utils_1.default.stringify(value, namespaceStart, namespaceNext) + "." + term.raw,
            value: token
        }, lexer_1.default.TokenType.Annotation);
    }
    ArrayOrObject.annotationInUri = annotationInUri;
    function keyValuePairInUri(value, index, keyFn, valueFn) {
        var mark = lexer_1.default.quotationMark(value, index);
        if (mark === index)
            return;
        var start = index;
        index = mark;
        var prop = keyFn(value, index);
        if (!prop)
            return;
        index = prop.next;
        mark = lexer_1.default.quotationMark(value, index);
        if (mark === index)
            return;
        index = mark;
        var separator = lexer_1.default.nameSeparator(value, index);
        if (separator === index)
            return;
        index = separator;
        var propValue = valueFn(value, index);
        if (!propValue)
            return;
        index = propValue.next;
        return lexer_1.default.tokenize(value, start, index, { key: prop, value: propValue }, lexer_1.default.TokenType.Property);
    }
    ArrayOrObject.keyValuePairInUri = keyValuePairInUri;
    function primitivePropertyInUri(value, index) {
        return ArrayOrObject.keyValuePairInUri(value, index, nameOrIdentifier_1.default.primitiveProperty, primitiveLiteralInJSON);
    }
    ArrayOrObject.primitivePropertyInUri = primitivePropertyInUri;
    function navigationPropertyInUri(value, index) {
        return ArrayOrObject.singleNavPropInJSON(value, index) ||
            ArrayOrObject.collectionNavPropInJSON(value, index);
    }
    ArrayOrObject.navigationPropertyInUri = navigationPropertyInUri;
    function singleNavPropInJSON(value, index) {
        return ArrayOrObject.keyValuePairInUri(value, index, nameOrIdentifier_1.default.entityNavigationProperty, expressions_1.default.rootExpr);
    }
    ArrayOrObject.singleNavPropInJSON = singleNavPropInJSON;
    function collectionNavPropInJSON(value, index) {
        return ArrayOrObject.keyValuePairInUri(value, index, nameOrIdentifier_1.default.entityColNavigationProperty, rootExprCol);
    }
    ArrayOrObject.collectionNavPropInJSON = collectionNavPropInJSON;
    function rootExprCol(value, index) {
        var begin = lexer_1.default.beginArray(value, index);
        if (begin === index)
            return;
        var start = index;
        index = begin;
        var items = [];
        var token = expressions_1.default.rootExpr(value, index);
        if (token) {
            while (token) {
                items.push(token);
                index = token.next;
                var end = lexer_1.default.endArray(value, index);
                if (end > index) {
                    index = end;
                    break;
                }
                else {
                    var separator = lexer_1.default.valueSeparator(value, index);
                    if (separator === index)
                        return;
                    index = separator;
                    token = expressions_1.default.rootExpr(value, index);
                    if (!token)
                        return;
                }
            }
        }
        else {
            var end = lexer_1.default.endArray(value, index);
            if (end === index)
                return;
            index = end;
        }
        return lexer_1.default.tokenize(value, start, index, { items: items }, lexer_1.default.TokenType.Array);
    }
    ArrayOrObject.rootExprCol = rootExprCol;
    function primitiveLiteralInJSON(value, index) {
        return ArrayOrObject.stringInJSON(value, index) ||
            ArrayOrObject.numberInJSON(value, index) ||
            ArrayOrObject.booleanInJSON(value, index) ||
            ArrayOrObject.nullInJSON(value, index);
    }
    ArrayOrObject.primitiveLiteralInJSON = primitiveLiteralInJSON;
    function stringInJSON(value, index) {
        var mark = lexer_1.default.quotationMark(value, index);
        if (mark === index)
            return;
        var start = index;
        index = mark;
        var char = ArrayOrObject.charInJSON(value, index);
        while (char > index) {
            index = char;
            char = ArrayOrObject.charInJSON(value, index);
        }
        mark = lexer_1.default.quotationMark(value, index);
        if (mark === index)
            return;
        index = mark;
        return lexer_1.default.tokenize(value, start, index, "string", lexer_1.default.TokenType.Literal);
    }
    ArrayOrObject.stringInJSON = stringInJSON;
    function charInJSON(value, index) {
        var escape = lexer_1.default.escape(value, index);
        if (escape > index) {
            if (utils_1.default.equals(value, escape, "%2F"))
                return escape + 3;
            if (utils_1.default.equals(value, escape, "/") ||
                utils_1.default.equals(value, escape, "b") ||
                utils_1.default.equals(value, escape, "f") ||
                utils_1.default.equals(value, escape, "n") ||
                utils_1.default.equals(value, escape, "r") ||
                utils_1.default.equals(value, escape, "t"))
                return escape + 1;
            if (utils_1.default.equals(value, escape, "u") &&
                utils_1.default.required(value, escape + 1, lexer_1.default.HEXDIG, 4, 4))
                return escape + 5;
            var escapeNext = lexer_1.default.escape(value, escape);
            if (escapeNext > escape)
                return escapeNext;
            var mark = lexer_1.default.quotationMark(value, escape);
            if (mark > escape)
                return mark;
        }
        else {
            var mark = lexer_1.default.quotationMark(value, index);
            if (mark === index)
                return index + 1;
        }
    }
    ArrayOrObject.charInJSON = charInJSON;
    function numberInJSON(value, index) {
        var token = primitiveLiteral_1.default.doubleValue(value, index) ||
            primitiveLiteral_1.default.int64Value(value, index);
        if (token) {
            token.value = "number";
            return token;
        }
    }
    ArrayOrObject.numberInJSON = numberInJSON;
    function booleanInJSON(value, index) {
        if (utils_1.default.equals(value, index, "true"))
            return lexer_1.default.tokenize(value, index, index + 4, "boolean", lexer_1.default.TokenType.Literal);
        if (utils_1.default.equals(value, index, "false"))
            return lexer_1.default.tokenize(value, index, index + 5, "boolean", lexer_1.default.TokenType.Literal);
    }
    ArrayOrObject.booleanInJSON = booleanInJSON;
    function nullInJSON(value, index) {
        if (utils_1.default.equals(value, index, "null"))
            return lexer_1.default.tokenize(value, index, index + 4, "null", lexer_1.default.TokenType.Literal);
    }
    ArrayOrObject.nullInJSON = nullInJSON;
    function arrayOrObject(value, index) {
        var token = ArrayOrObject.complexColInUri(value, index) ||
            ArrayOrObject.complexInUri(value, index) ||
            ArrayOrObject.rootExprCol(value, index) ||
            ArrayOrObject.primitiveColInUri(value, index);
        if (token)
            return lexer_1.default.tokenize(value, index, token.next, token, lexer_1.default.TokenType.ArrayOrObject);
    }
    ArrayOrObject.arrayOrObject = arrayOrObject;
})(ArrayOrObject = exports.ArrayOrObject || (exports.ArrayOrObject = {}));
exports.default = ArrayOrObject;
//# sourceMappingURL=json.js.map