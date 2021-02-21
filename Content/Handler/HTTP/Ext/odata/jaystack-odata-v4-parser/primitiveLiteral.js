"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var utils_1 = require("./utils");
var lexer_1 = require("./lexer");
var nameOrIdentifier_1 = require("./nameOrIdentifier");
var PrimitiveLiteral;
(function (PrimitiveLiteral) {
    function nullValue(value, index) {
        if (utils_1.default.equals(value, index, "null"))
            return lexer_1.default.tokenize(value, index, index + 4, "null", lexer_1.default.TokenType.Literal);
    }
    PrimitiveLiteral.nullValue = nullValue;
    function booleanValue(value, index) {
        if (utils_1.default.equals(value, index, "true"))
            return lexer_1.default.tokenize(value, index, index + 4, "Edm.Boolean", lexer_1.default.TokenType.Literal);
        if (utils_1.default.equals(value, index, "false"))
            return lexer_1.default.tokenize(value, index, index + 5, "Edm.Boolean", lexer_1.default.TokenType.Literal);
    }
    PrimitiveLiteral.booleanValue = booleanValue;
    function guidValue(value, index) {
        if (utils_1.default.required(value, index, lexer_1.default.HEXDIG, 8, 8) &&
            value[index + 8] === 0x2d &&
            utils_1.default.required(value, index + 9, lexer_1.default.HEXDIG, 4, 4) &&
            value[index + 13] === 0x2d &&
            utils_1.default.required(value, index + 14, lexer_1.default.HEXDIG, 4, 4) &&
            value[index + 18] === 0x2d &&
            utils_1.default.required(value, index + 19, lexer_1.default.HEXDIG, 4, 4) &&
            value[index + 23] === 0x2d &&
            utils_1.default.required(value, index + 24, lexer_1.default.HEXDIG, 12))
            return lexer_1.default.tokenize(value, index, index + 36, "Edm.Guid", lexer_1.default.TokenType.Literal);
    }
    PrimitiveLiteral.guidValue = guidValue;
    function sbyteValue(value, index) {
        var start = index;
        var sign = lexer_1.default.SIGN(value, index);
        if (sign)
            index = sign;
        var next = utils_1.default.required(value, index, lexer_1.default.DIGIT, 1, 3);
        if (next) {
            if (lexer_1.default.DIGIT(value[next]))
                return;
            var val = parseInt(utils_1.default.stringify(value, start, next), 10);
            if (val >= -128 && val <= 127)
                return lexer_1.default.tokenize(value, start, next, "Edm.SByte", lexer_1.default.TokenType.Literal);
        }
    }
    PrimitiveLiteral.sbyteValue = sbyteValue;
    function byteValue(value, index) {
        var next = utils_1.default.required(value, index, lexer_1.default.DIGIT, 1, 3);
        if (next) {
            if (lexer_1.default.DIGIT(value[next]))
                return;
            var val = parseInt(utils_1.default.stringify(value, index, next), 10);
            if (val >= 0 && val <= 255)
                return lexer_1.default.tokenize(value, index, next, "Edm.Byte", lexer_1.default.TokenType.Literal);
        }
    }
    PrimitiveLiteral.byteValue = byteValue;
    function int16Value(value, index) {
        var start = index;
        var sign = lexer_1.default.SIGN(value, index);
        if (sign)
            index = sign;
        var next = utils_1.default.required(value, index, lexer_1.default.DIGIT, 1, 5);
        if (next) {
            if (lexer_1.default.DIGIT(value[next]))
                return;
            var val = parseInt(utils_1.default.stringify(value, start, next), 10);
            if (val >= -32768 && val <= 32767)
                return lexer_1.default.tokenize(value, start, next, "Edm.Int16", lexer_1.default.TokenType.Literal);
        }
    }
    PrimitiveLiteral.int16Value = int16Value;
    function int32Value(value, index) {
        var start = index;
        var sign = lexer_1.default.SIGN(value, index);
        if (sign)
            index = sign;
        var next = utils_1.default.required(value, index, lexer_1.default.DIGIT, 1, 10);
        if (next) {
            if (lexer_1.default.DIGIT(value[next]))
                return;
            var val = parseInt(utils_1.default.stringify(value, start, next), 10);
            if (val >= -2147483648 && val <= 2147483647)
                return lexer_1.default.tokenize(value, start, next, "Edm.Int32", lexer_1.default.TokenType.Literal);
        }
    }
    PrimitiveLiteral.int32Value = int32Value;
    function int64Value(value, index) {
        var start = index;
        var sign = lexer_1.default.SIGN(value, index);
        if (sign)
            index = sign;
        var next = utils_1.default.required(value, index, lexer_1.default.DIGIT, 1, 19);
        if (next) {
            if (lexer_1.default.DIGIT(value[next]))
                return;
            var val = utils_1.default.stringify(value, index, next);
            if (val >= "0" && val <= (value[start] === 0x2d ? "9223372036854775808" : "9223372036854775807"))
                return lexer_1.default.tokenize(value, start, next, "Edm.Int64", lexer_1.default.TokenType.Literal);
        }
    }
    PrimitiveLiteral.int64Value = int64Value;
    function decimalValue(value, index) {
        var start = index;
        var sign = lexer_1.default.SIGN(value, index);
        if (sign)
            index = sign;
        var intNext = utils_1.default.required(value, index, lexer_1.default.DIGIT, 1);
        if (!intNext)
            return;
        var end = intNext;
        if (value[intNext] === 0x2e) {
            end = utils_1.default.required(value, intNext + 1, lexer_1.default.DIGIT, 1);
            if (!end || end === intNext + 1)
                return;
        }
        else
            return;
        // TODO: detect only decimal value, no double/single detection here
        if (value[end] === 0x65)
            return;
        return lexer_1.default.tokenize(value, start, end, "Edm.Decimal", lexer_1.default.TokenType.Literal);
    }
    PrimitiveLiteral.decimalValue = decimalValue;
    function doubleValue(value, index) {
        var start = index;
        var end = index;
        var nanInfLen = lexer_1.default.nanInfinity(value, index);
        if (nanInfLen) {
            end += nanInfLen;
        }
        else {
            // TODO: use decimalValue function
            // var token = decimalValue(value, index);
            var sign = lexer_1.default.SIGN(value, index);
            if (sign)
                index = sign;
            var intNext = utils_1.default.required(value, index, lexer_1.default.DIGIT, 1);
            if (!intNext)
                return;
            var decimalNext = intNext;
            if (value[intNext] === 0x2e) {
                decimalNext = utils_1.default.required(value, intNext + 1, lexer_1.default.DIGIT, 1);
                if (decimalNext === intNext + 1)
                    return;
            }
            else
                return;
            if (value[decimalNext] === 0x65) {
                var next = decimalNext + 1;
                var sign_1 = lexer_1.default.SIGN(value, next);
                if (sign_1)
                    next = sign_1;
                var digitNext = utils_1.default.required(value, next, lexer_1.default.DIGIT, 1);
                if (digitNext) {
                    end = digitNext;
                }
            }
            else
                end = decimalNext;
        }
        return lexer_1.default.tokenize(value, start, end, "Edm.Double", lexer_1.default.TokenType.Literal);
    }
    PrimitiveLiteral.doubleValue = doubleValue;
    function singleValue(value, index) {
        var token = PrimitiveLiteral.doubleValue(value, index);
        if (token) {
            token.value = "Edm.Single";
        }
        return token;
    }
    PrimitiveLiteral.singleValue = singleValue;
    function stringValue(value, index) {
        var start = index;
        var squote = lexer_1.default.SQUOTE(value, start);
        if (squote) {
            index = squote;
            while (index < value.length) {
                squote = lexer_1.default.SQUOTE(value, index);
                if (squote) {
                    index = squote;
                    squote = lexer_1.default.SQUOTE(value, index);
                    if (!squote) {
                        var close_1 = lexer_1.default.CLOSE(value, index);
                        var comma = lexer_1.default.COMMA(value, index);
                        var amp = value[index] === 0x26;
                        if (lexer_1.default.pcharNoSQUOTE(value, index) > index && !amp && !close_1 && !comma && lexer_1.default.RWS(value, index) === index)
                            return;
                        break;
                    }
                    else {
                        index = squote;
                    }
                }
                else {
                    var nextIndex = Math.max(lexer_1.default.RWS(value, index), lexer_1.default.pcharNoSQUOTE(value, index));
                    if (nextIndex === index)
                        return;
                    index = nextIndex;
                }
            }
            squote = lexer_1.default.SQUOTE(value, index - 1) || lexer_1.default.SQUOTE(value, index - 3);
            if (!squote)
                return;
            index = squote;
            return lexer_1.default.tokenize(value, start, index, "Edm.String", lexer_1.default.TokenType.Literal);
        }
    }
    PrimitiveLiteral.stringValue = stringValue;
    function durationValue(value, index) {
        if (!utils_1.default.equals(value, index, "duration"))
            return;
        var start = index;
        index += 8;
        var squote = lexer_1.default.SQUOTE(value, index);
        if (!squote)
            return;
        index = squote;
        var sign = lexer_1.default.SIGN(value, index);
        if (sign)
            index = sign;
        if (value[index] !== 0x50)
            return;
        index++;
        var dayNext = utils_1.default.required(value, index, lexer_1.default.DIGIT, 1);
        if (dayNext === index && value[index + 1] !== 0x54)
            return;
        index = dayNext;
        if (value[index] === 0x44)
            index++;
        var end = index;
        if (value[index] === 0x54) {
            index++;
            var parseTimeFn_1 = function () {
                var squote = lexer_1.default.SQUOTE(value, index);
                if (squote)
                    return index;
                var digitNext = utils_1.default.required(value, index, lexer_1.default.DIGIT, 1);
                if (digitNext === index)
                    return;
                index = digitNext;
                if (value[index] === 0x53) {
                    end = index + 1;
                    return end;
                }
                else if (value[index] === 0x2e) {
                    index++;
                    var fractionalSecondsNext = utils_1.default.required(value, index, lexer_1.default.DIGIT, 1);
                    if (fractionalSecondsNext === index || value[fractionalSecondsNext] !== 0x53)
                        return;
                    end = fractionalSecondsNext + 1;
                    return end;
                }
                else if (value[index] === 0x48) {
                    index++;
                    end = index;
                    return parseTimeFn_1();
                }
                else if (value[index] === 0x4d) {
                    index++;
                    end = index;
                    return parseTimeFn_1();
                }
            };
            var next = parseTimeFn_1();
            if (!next)
                return;
        }
        squote = lexer_1.default.SQUOTE(value, end);
        if (!squote)
            return;
        end = squote;
        return lexer_1.default.tokenize(value, start, end, "Edm.Duration", lexer_1.default.TokenType.Literal);
    }
    PrimitiveLiteral.durationValue = durationValue;
    function binaryValue(value, index) {
        var start = index;
        if (!utils_1.default.equals(value, index, "binary"))
            return;
        index += 6;
        var squote = lexer_1.default.SQUOTE(value, index);
        if (!squote)
            return;
        index = squote;
        var valStart = index;
        while (index < value.length && !(squote = lexer_1.default.SQUOTE(value, index))) {
            var end = Math.max(lexer_1.default.base64b16(value, index), lexer_1.default.base64b8(value, index));
            if (end > index)
                index = end;
            else if (lexer_1.default.base64char(value[index]) &&
                lexer_1.default.base64char(value[index + 1]) &&
                lexer_1.default.base64char(value[index + 2]) &&
                lexer_1.default.base64char(value[index + 3]))
                index += 4;
            else
                index++;
        }
        index = squote;
        return lexer_1.default.tokenize(value, start, index, "Edm.Binary", lexer_1.default.TokenType.Literal);
    }
    PrimitiveLiteral.binaryValue = binaryValue;
    function dateValue(value, index) {
        var yearNext = lexer_1.default.year(value, index);
        if (yearNext === index || value[yearNext] !== 0x2d)
            return;
        var monthNext = lexer_1.default.month(value, yearNext + 1);
        if ((monthNext === yearNext + 1) || value[monthNext] !== 0x2d)
            return;
        var dayNext = lexer_1.default.day(value, monthNext + 1);
        // TODO: join dateValue and dateTimeOffsetValue for optimalization
        if (dayNext === monthNext + 1 || value[dayNext] === 0x54)
            return;
        return lexer_1.default.tokenize(value, index, dayNext, "Edm.Date", lexer_1.default.TokenType.Literal);
    }
    PrimitiveLiteral.dateValue = dateValue;
    function dateTimeOffsetValue(value, index) {
        var yearNext = lexer_1.default.year(value, index);
        if (yearNext === index || value[yearNext] !== 0x2d)
            return;
        var monthNext = lexer_1.default.month(value, yearNext + 1);
        if ((monthNext === yearNext + 1) || value[monthNext] !== 0x2d)
            return;
        var dayNext = lexer_1.default.day(value, monthNext + 1);
        if (dayNext === monthNext + 1 || value[dayNext] !== 0x54)
            return;
        var hourNext = lexer_1.default.hour(value, dayNext + 1);
        var colon = lexer_1.default.COLON(value, hourNext);
        if (hourNext === colon || !colon)
            return;
        var minuteNext = lexer_1.default.minute(value, hourNext + 1);
        if (minuteNext === hourNext + 1)
            return;
        var end = minuteNext;
        colon = lexer_1.default.COLON(value, minuteNext);
        if (colon) {
            var secondNext = lexer_1.default.second(value, colon);
            if (secondNext === colon)
                return;
            if (value[secondNext] === 0x2e) {
                var fractionalSecondsNext = lexer_1.default.fractionalSeconds(value, secondNext + 1);
                if (fractionalSecondsNext === secondNext + 1)
                    return;
                end = fractionalSecondsNext;
            }
            else
                end = secondNext;
        }
        var sign = lexer_1.default.SIGN(value, end);
        if (value[end] === 0x5a) {
            end++;
        }
        else if (sign) {
            var zHourNext = lexer_1.default.hour(value, sign);
            var colon_1 = lexer_1.default.COLON(value, zHourNext);
            if (zHourNext === sign || !colon_1)
                return;
            var zMinuteNext = lexer_1.default.minute(value, colon_1);
            if (zMinuteNext === colon_1)
                return;
            end = zMinuteNext;
        }
        else
            return;
        return lexer_1.default.tokenize(value, index, end, "Edm.DateTimeOffset", lexer_1.default.TokenType.Literal);
    }
    PrimitiveLiteral.dateTimeOffsetValue = dateTimeOffsetValue;
    function timeOfDayValue(value, index) {
        var hourNext = lexer_1.default.hour(value, index);
        var colon = lexer_1.default.COLON(value, hourNext);
        if (hourNext === index || !colon)
            return;
        var minuteNext = lexer_1.default.minute(value, colon);
        if (minuteNext === colon)
            return;
        var end = minuteNext;
        colon = lexer_1.default.COLON(value, minuteNext);
        if (colon) {
            var secondNext = lexer_1.default.second(value, colon);
            if (secondNext === colon)
                return;
            if (value[secondNext] === 0x2e) {
                var fractionalSecondsNext = lexer_1.default.fractionalSeconds(value, secondNext + 1);
                if (fractionalSecondsNext === secondNext + 1)
                    return;
                end = fractionalSecondsNext;
            }
            else
                end = secondNext;
        }
        return lexer_1.default.tokenize(value, index, end, "Edm.TimeOfDay", lexer_1.default.TokenType.Literal);
    }
    PrimitiveLiteral.timeOfDayValue = timeOfDayValue;
    // geography and geometry literals
    function positionLiteral(value, index) {
        var longitude = PrimitiveLiteral.doubleValue(value, index);
        if (!longitude)
            return;
        var next = lexer_1.default.RWS(value, longitude.next);
        if (next === longitude.next)
            return;
        var latitude = PrimitiveLiteral.doubleValue(value, next);
        if (!latitude)
            return;
        return lexer_1.default.tokenize(value, index, latitude.next, { longitude: longitude, latitude: latitude }, lexer_1.default.TokenType.Literal);
    }
    PrimitiveLiteral.positionLiteral = positionLiteral;
    function pointData(value, index) {
        var open = lexer_1.default.OPEN(value, index);
        if (!open)
            return;
        var start = index;
        index = open;
        var position = PrimitiveLiteral.positionLiteral(value, index);
        if (!position)
            return;
        index = position.next;
        var close = lexer_1.default.CLOSE(value, index);
        if (!close)
            return;
        index = close;
        return lexer_1.default.tokenize(value, start, index, position, lexer_1.default.TokenType.Literal);
    }
    PrimitiveLiteral.pointData = pointData;
    function lineStringData(value, index) {
        return PrimitiveLiteral.multiGeoLiteralFactory(value, index, "", PrimitiveLiteral.positionLiteral);
    }
    PrimitiveLiteral.lineStringData = lineStringData;
    function ringLiteral(value, index) {
        return PrimitiveLiteral.multiGeoLiteralFactory(value, index, "", PrimitiveLiteral.positionLiteral);
        // Within each ringLiteral, the first and last positionLiteral elements MUST be an exact syntactic match to each other.
        // Within the polygonData, the ringLiterals MUST specify their points in appropriate winding order.
        // In order of traversal, points to the left side of the ring are interpreted as being in the polygon.
    }
    PrimitiveLiteral.ringLiteral = ringLiteral;
    function polygonData(value, index) {
        return PrimitiveLiteral.multiGeoLiteralFactory(value, index, "", PrimitiveLiteral.ringLiteral);
    }
    PrimitiveLiteral.polygonData = polygonData;
    function sridLiteral(value, index) {
        if (!utils_1.default.equals(value, index, "SRID"))
            return;
        var start = index;
        index += 4;
        var eq = lexer_1.default.EQ(value, index);
        if (!eq)
            return;
        index++;
        var digit = utils_1.default.required(value, index, lexer_1.default.DIGIT, 1, 5);
        if (!digit)
            return;
        index = digit;
        var semi = lexer_1.default.SEMI(value, index);
        if (!semi)
            return;
        index = semi;
        return lexer_1.default.tokenize(value, start, index, "SRID", lexer_1.default.TokenType.Literal);
    }
    PrimitiveLiteral.sridLiteral = sridLiteral;
    function pointLiteral(value, index) {
        if (!utils_1.default.equals(value, index, "Point"))
            return;
        var start = index;
        index += 5;
        var data = PrimitiveLiteral.pointData(value, index);
        if (!data)
            return;
        return lexer_1.default.tokenize(value, start, data.next, data, lexer_1.default.TokenType.Literal);
    }
    PrimitiveLiteral.pointLiteral = pointLiteral;
    function polygonLiteral(value, index) {
        if (!utils_1.default.equals(value, index, "Polygon"))
            return;
        var start = index;
        index += 7;
        var data = PrimitiveLiteral.polygonData(value, index);
        if (!data)
            return;
        return lexer_1.default.tokenize(value, start, data.next, data, lexer_1.default.TokenType.Literal);
    }
    PrimitiveLiteral.polygonLiteral = polygonLiteral;
    function collectionLiteral(value, index) {
        return PrimitiveLiteral.multiGeoLiteralFactory(value, index, "Collection", PrimitiveLiteral.geoLiteral);
    }
    PrimitiveLiteral.collectionLiteral = collectionLiteral;
    function lineStringLiteral(value, index) {
        if (!utils_1.default.equals(value, index, "LineString"))
            return;
        var start = index;
        index += 10;
        var data = PrimitiveLiteral.lineStringData(value, index);
        if (!data)
            return;
        index = data.next;
        return lexer_1.default.tokenize(value, start, index, data, lexer_1.default.TokenType.Literal);
    }
    PrimitiveLiteral.lineStringLiteral = lineStringLiteral;
    function multiLineStringLiteral(value, index) {
        return PrimitiveLiteral.multiGeoLiteralOptionalFactory(value, index, "MultiLineString", PrimitiveLiteral.lineStringData);
    }
    PrimitiveLiteral.multiLineStringLiteral = multiLineStringLiteral;
    function multiPointLiteral(value, index) {
        return PrimitiveLiteral.multiGeoLiteralOptionalFactory(value, index, "MultiPoint", PrimitiveLiteral.pointData);
    }
    PrimitiveLiteral.multiPointLiteral = multiPointLiteral;
    function multiPolygonLiteral(value, index) {
        return PrimitiveLiteral.multiGeoLiteralOptionalFactory(value, index, "MultiPolygon", PrimitiveLiteral.polygonData);
    }
    PrimitiveLiteral.multiPolygonLiteral = multiPolygonLiteral;
    function multiGeoLiteralFactory(value, index, prefix, itemLiteral) {
        if (!utils_1.default.equals(value, index, prefix + "("))
            return;
        var start = index;
        index += prefix.length + 1;
        var items = [];
        var geo = itemLiteral(value, index);
        if (!geo)
            return;
        index = geo.next;
        while (geo) {
            items.push(geo);
            var close_2 = lexer_1.default.CLOSE(value, index);
            if (close_2) {
                index = close_2;
                break;
            }
            var comma = lexer_1.default.COMMA(value, index);
            if (!comma)
                return;
            index = comma;
            geo = itemLiteral(value, index);
            if (!geo)
                return;
            index = geo.next;
        }
        return lexer_1.default.tokenize(value, start, index, { items: items }, lexer_1.default.TokenType.Literal);
    }
    PrimitiveLiteral.multiGeoLiteralFactory = multiGeoLiteralFactory;
    function multiGeoLiteralOptionalFactory(value, index, prefix, itemLiteral) {
        if (!utils_1.default.equals(value, index, prefix + "("))
            return;
        var start = index;
        index += prefix.length + 1;
        var items = [];
        var close = lexer_1.default.CLOSE(value, index);
        if (!close) {
            var geo = itemLiteral(value, index);
            if (!geo)
                return;
            index = geo.next;
            while (geo) {
                items.push(geo);
                close = lexer_1.default.CLOSE(value, index);
                if (close) {
                    index = close;
                    break;
                }
                var comma = lexer_1.default.COMMA(value, index);
                if (!comma)
                    return;
                index = comma;
                geo = itemLiteral(value, index);
                if (!geo)
                    return;
                index = geo.next;
            }
        }
        else
            index++;
        return lexer_1.default.tokenize(value, start, index, { items: items }, lexer_1.default.TokenType.Literal);
    }
    PrimitiveLiteral.multiGeoLiteralOptionalFactory = multiGeoLiteralOptionalFactory;
    function geoLiteral(value, index) {
        return PrimitiveLiteral.collectionLiteral(value, index) ||
            PrimitiveLiteral.lineStringLiteral(value, index) ||
            PrimitiveLiteral.multiPointLiteral(value, index) ||
            PrimitiveLiteral.multiLineStringLiteral(value, index) ||
            PrimitiveLiteral.multiPolygonLiteral(value, index) ||
            PrimitiveLiteral.pointLiteral(value, index) ||
            PrimitiveLiteral.polygonLiteral(value, index);
    }
    PrimitiveLiteral.geoLiteral = geoLiteral;
    function fullPointLiteral(value, index) {
        return PrimitiveLiteral.fullGeoLiteralFactory(value, index, PrimitiveLiteral.pointLiteral);
    }
    PrimitiveLiteral.fullPointLiteral = fullPointLiteral;
    function fullCollectionLiteral(value, index) {
        return PrimitiveLiteral.fullGeoLiteralFactory(value, index, PrimitiveLiteral.collectionLiteral);
    }
    PrimitiveLiteral.fullCollectionLiteral = fullCollectionLiteral;
    function fullLineStringLiteral(value, index) {
        return PrimitiveLiteral.fullGeoLiteralFactory(value, index, PrimitiveLiteral.lineStringLiteral);
    }
    PrimitiveLiteral.fullLineStringLiteral = fullLineStringLiteral;
    function fullMultiLineStringLiteral(value, index) {
        return PrimitiveLiteral.fullGeoLiteralFactory(value, index, PrimitiveLiteral.multiLineStringLiteral);
    }
    PrimitiveLiteral.fullMultiLineStringLiteral = fullMultiLineStringLiteral;
    function fullMultiPointLiteral(value, index) {
        return PrimitiveLiteral.fullGeoLiteralFactory(value, index, PrimitiveLiteral.multiPointLiteral);
    }
    PrimitiveLiteral.fullMultiPointLiteral = fullMultiPointLiteral;
    function fullMultiPolygonLiteral(value, index) {
        return PrimitiveLiteral.fullGeoLiteralFactory(value, index, PrimitiveLiteral.multiPolygonLiteral);
    }
    PrimitiveLiteral.fullMultiPolygonLiteral = fullMultiPolygonLiteral;
    function fullPolygonLiteral(value, index) {
        return PrimitiveLiteral.fullGeoLiteralFactory(value, index, PrimitiveLiteral.polygonLiteral);
    }
    PrimitiveLiteral.fullPolygonLiteral = fullPolygonLiteral;
    function fullGeoLiteralFactory(value, index, literal) {
        var srid = PrimitiveLiteral.sridLiteral(value, index);
        if (!srid)
            return;
        var token = literal(value, srid.next);
        if (!token)
            return;
        return lexer_1.default.tokenize(value, index, token.next, { srid: srid, value: token }, lexer_1.default.TokenType.Literal);
    }
    PrimitiveLiteral.fullGeoLiteralFactory = fullGeoLiteralFactory;
    function geographyCollection(value, index) {
        var prefix = lexer_1.default.geographyPrefix(value, index);
        if (prefix === index)
            return;
        var start = index;
        index = prefix;
        var squote = lexer_1.default.SQUOTE(value, index);
        if (!squote)
            return;
        index = squote;
        var point = PrimitiveLiteral.fullCollectionLiteral(value, index);
        if (!point)
            return;
        index = point.next;
        squote = lexer_1.default.SQUOTE(value, index);
        if (!squote)
            return;
        index = squote;
        return lexer_1.default.tokenize(value, start, index, "Edm.GeographyCollection", lexer_1.default.TokenType.Literal);
    }
    PrimitiveLiteral.geographyCollection = geographyCollection;
    function geographyLineString(value, index) {
        return PrimitiveLiteral.geoLiteralFactory(value, index, "Edm.GeographyLineString", lexer_1.default.geographyPrefix, PrimitiveLiteral.fullLineStringLiteral);
    }
    PrimitiveLiteral.geographyLineString = geographyLineString;
    function geographyMultiLineString(value, index) {
        return PrimitiveLiteral.geoLiteralFactory(value, index, "Edm.GeographyMultiLineString", lexer_1.default.geographyPrefix, PrimitiveLiteral.fullMultiLineStringLiteral);
    }
    PrimitiveLiteral.geographyMultiLineString = geographyMultiLineString;
    function geographyMultiPoint(value, index) {
        return PrimitiveLiteral.geoLiteralFactory(value, index, "Edm.GeographyMultiPoint", lexer_1.default.geographyPrefix, PrimitiveLiteral.fullMultiPointLiteral);
    }
    PrimitiveLiteral.geographyMultiPoint = geographyMultiPoint;
    function geographyMultiPolygon(value, index) {
        return PrimitiveLiteral.geoLiteralFactory(value, index, "Edm.GeographyMultiPolygon", lexer_1.default.geographyPrefix, PrimitiveLiteral.fullMultiPolygonLiteral);
    }
    PrimitiveLiteral.geographyMultiPolygon = geographyMultiPolygon;
    function geographyPoint(value, index) {
        return PrimitiveLiteral.geoLiteralFactory(value, index, "Edm.GeographyPoint", lexer_1.default.geographyPrefix, PrimitiveLiteral.fullPointLiteral);
    }
    PrimitiveLiteral.geographyPoint = geographyPoint;
    function geographyPolygon(value, index) {
        return PrimitiveLiteral.geoLiteralFactory(value, index, "Edm.GeographyPolygon", lexer_1.default.geographyPrefix, PrimitiveLiteral.fullPolygonLiteral);
    }
    PrimitiveLiteral.geographyPolygon = geographyPolygon;
    function geometryCollection(value, index) {
        return PrimitiveLiteral.geoLiteralFactory(value, index, "Edm.GeometryCollection", lexer_1.default.geometryPrefix, PrimitiveLiteral.fullCollectionLiteral);
    }
    PrimitiveLiteral.geometryCollection = geometryCollection;
    function geometryLineString(value, index) {
        return PrimitiveLiteral.geoLiteralFactory(value, index, "Edm.GeometryLineString", lexer_1.default.geometryPrefix, PrimitiveLiteral.fullLineStringLiteral);
    }
    PrimitiveLiteral.geometryLineString = geometryLineString;
    function geometryMultiLineString(value, index) {
        return PrimitiveLiteral.geoLiteralFactory(value, index, "Edm.GeometryMultiLineString", lexer_1.default.geometryPrefix, PrimitiveLiteral.fullMultiLineStringLiteral);
    }
    PrimitiveLiteral.geometryMultiLineString = geometryMultiLineString;
    function geometryMultiPoint(value, index) {
        return PrimitiveLiteral.geoLiteralFactory(value, index, "Edm.GeometryMultiPoint", lexer_1.default.geometryPrefix, PrimitiveLiteral.fullMultiPointLiteral);
    }
    PrimitiveLiteral.geometryMultiPoint = geometryMultiPoint;
    function geometryMultiPolygon(value, index) {
        return PrimitiveLiteral.geoLiteralFactory(value, index, "Edm.GeometryMultiPolygon", lexer_1.default.geometryPrefix, PrimitiveLiteral.fullMultiPolygonLiteral);
    }
    PrimitiveLiteral.geometryMultiPolygon = geometryMultiPolygon;
    function geometryPoint(value, index) {
        return PrimitiveLiteral.geoLiteralFactory(value, index, "Edm.GeometryPoint", lexer_1.default.geometryPrefix, PrimitiveLiteral.fullPointLiteral);
    }
    PrimitiveLiteral.geometryPoint = geometryPoint;
    function geometryPolygon(value, index) {
        return PrimitiveLiteral.geoLiteralFactory(value, index, "Edm.GeometryPolygon", lexer_1.default.geometryPrefix, PrimitiveLiteral.fullPolygonLiteral);
    }
    PrimitiveLiteral.geometryPolygon = geometryPolygon;
    function geoLiteralFactory(value, index, type, prefix, literal) {
        var prefixNext = prefix(value, index);
        if (prefixNext === index)
            return;
        var start = index;
        index = prefixNext;
        var squote = lexer_1.default.SQUOTE(value, index);
        if (!squote)
            return;
        index = squote;
        var data = literal(value, index);
        if (!data)
            return;
        index = data.next;
        squote = lexer_1.default.SQUOTE(value, index);
        if (!squote)
            return;
        index = squote;
        return lexer_1.default.tokenize(value, start, index, type, lexer_1.default.TokenType.Literal);
    }
    PrimitiveLiteral.geoLiteralFactory = geoLiteralFactory;
    function primitiveLiteral(value, index) {
        return PrimitiveLiteral.nullValue(value, index) ||
            PrimitiveLiteral.booleanValue(value, index) ||
            PrimitiveLiteral.guidValue(value, index) ||
            PrimitiveLiteral.dateValue(value, index) ||
            PrimitiveLiteral.dateTimeOffsetValue(value, index) ||
            PrimitiveLiteral.timeOfDayValue(value, index) ||
            PrimitiveLiteral.decimalValue(value, index) ||
            PrimitiveLiteral.doubleValue(value, index) ||
            PrimitiveLiteral.singleValue(value, index) ||
            PrimitiveLiteral.sbyteValue(value, index) ||
            PrimitiveLiteral.byteValue(value, index) ||
            PrimitiveLiteral.int16Value(value, index) ||
            PrimitiveLiteral.int32Value(value, index) ||
            PrimitiveLiteral.int64Value(value, index) ||
            PrimitiveLiteral.stringValue(value, index) ||
            PrimitiveLiteral.durationValue(value, index) ||
            PrimitiveLiteral.binaryValue(value, index) ||
            nameOrIdentifier_1.default.enumeration(value, index) ||
            PrimitiveLiteral.geographyCollection(value, index) ||
            PrimitiveLiteral.geographyLineString(value, index) ||
            PrimitiveLiteral.geographyMultiLineString(value, index) ||
            PrimitiveLiteral.geographyMultiPoint(value, index) ||
            PrimitiveLiteral.geographyMultiPolygon(value, index) ||
            PrimitiveLiteral.geographyPoint(value, index) ||
            PrimitiveLiteral.geographyPolygon(value, index) ||
            PrimitiveLiteral.geometryCollection(value, index) ||
            PrimitiveLiteral.geometryLineString(value, index) ||
            PrimitiveLiteral.geometryMultiLineString(value, index) ||
            PrimitiveLiteral.geometryMultiPoint(value, index) ||
            PrimitiveLiteral.geometryMultiPolygon(value, index) ||
            PrimitiveLiteral.geometryPoint(value, index) ||
            PrimitiveLiteral.geometryPolygon(value, index);
    }
    PrimitiveLiteral.primitiveLiteral = primitiveLiteral;
})(PrimitiveLiteral = exports.PrimitiveLiteral || (exports.PrimitiveLiteral = {}));
exports.default = PrimitiveLiteral;
//# sourceMappingURL=primitiveLiteral.js.map