"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var utils_1 = require("./utils");
var lexer_1 = require("./lexer");
var primitiveLiteral_1 = require("./primitiveLiteral");
var nameOrIdentifier_1 = require("./nameOrIdentifier");
var json_1 = require("./json");
var Expressions;
(function (Expressions) {
    function commonExpr(value, index) {
        var token = primitiveLiteral_1.default.primitiveLiteral(value, index) ||
            parameterAlias(value, index) ||
            json_1.default.arrayOrObject(value, index) ||
            rootExpr(value, index) ||
            methodCallExpr(value, index) ||
            firstMemberExpr(value, index) ||
            functionExpr(value, index) ||
            negateExpr(value, index) ||
            parenExpr(value, index) ||
            castExpr(value, index);
        if (!token)
            return;
        var expr = addExpr(value, token.next) ||
            subExpr(value, token.next) ||
            mulExpr(value, token.next) ||
            divExpr(value, token.next) ||
            modExpr(value, token.next);
        if (expr) {
            token.value = {
                left: lexer_1.default.clone(token),
                right: expr.value
            };
            token.next = expr.value.next;
            token.type = expr.type;
            token.raw = utils_1.default.stringify(value, token.position, token.next);
        }
        if (token)
            return lexer_1.default.tokenize(value, token.position, token.next, token, lexer_1.default.TokenType.CommonExpression);
    }
    Expressions.commonExpr = commonExpr;
    function boolCommonExpr(value, index) {
        var token = isofExpr(value, index) ||
            boolMethodCallExpr(value, index) ||
            notExpr(value, index) ||
            commonExpr(value, index) ||
            boolParenExpr(value, index);
        if (!token)
            return;
        var commonMoreExpr = undefined;
        if (token.type === lexer_1.default.TokenType.CommonExpression) {
            commonMoreExpr = eqExpr(value, token.next) ||
                neExpr(value, token.next) ||
                ltExpr(value, token.next) ||
                leExpr(value, token.next) ||
                gtExpr(value, token.next) ||
                geExpr(value, token.next) ||
                hasExpr(value, token.next);
            if (commonMoreExpr) {
                token.value = {
                    left: token.value,
                    right: commonMoreExpr.value
                };
                token.next = commonMoreExpr.value.next;
                token.type = commonMoreExpr.type;
                token.raw = utils_1.default.stringify(value, token.position, token.next);
            }
        }
        var expr = andExpr(value, token.next) ||
            orExpr(value, token.next);
        if (expr) {
            var left = lexer_1.default.clone(token);
            token.next = expr.value.next;
            token.value = {
                left: left,
                right: expr.value
            };
            token.type = expr.type;
            token.raw = utils_1.default.stringify(value, token.position, token.next);
            if (token.type === lexer_1.default.TokenType.AndExpression && token.value.right.type === lexer_1.default.TokenType.OrExpression) {
                token.value.left = lexer_1.default.tokenize(value, token.value.left.position, token.value.right.value.left.next, {
                    left: token.value.left,
                    right: token.value.right.value.left
                }, token.type);
                token.type = token.value.right.type;
                token.value.right = token.value.right.value.right;
            }
        }
        return token;
    }
    Expressions.boolCommonExpr = boolCommonExpr;
    function andExpr(value, index) {
        var rws = lexer_1.default.RWS(value, index);
        if (rws === index || !utils_1.default.equals(value, rws, "and"))
            return;
        var start = index;
        index = rws + 3;
        rws = lexer_1.default.RWS(value, index);
        if (rws === index)
            return;
        index = rws;
        var token = boolCommonExpr(value, index);
        if (!token)
            return;
        return lexer_1.default.tokenize(value, start, index, token, lexer_1.default.TokenType.AndExpression);
    }
    Expressions.andExpr = andExpr;
    function orExpr(value, index) {
        var rws = lexer_1.default.RWS(value, index);
        if (rws === index || !utils_1.default.equals(value, rws, "or"))
            return;
        var start = index;
        index = rws + 2;
        rws = lexer_1.default.RWS(value, index);
        if (rws === index)
            return;
        index = rws;
        var token = boolCommonExpr(value, index);
        if (!token)
            return;
        return lexer_1.default.tokenize(value, start, index, token, lexer_1.default.TokenType.OrExpression);
    }
    Expressions.orExpr = orExpr;
    function leftRightExpr(value, index, expr, tokenType) {
        var rws = lexer_1.default.RWS(value, index);
        if (rws === index)
            return;
        var start = index;
        index = rws;
        if (!utils_1.default.equals(value, index, expr))
            return;
        index += expr.length;
        rws = lexer_1.default.RWS(value, index);
        if (rws === index)
            return;
        index = rws;
        var token = commonExpr(value, index);
        if (!token)
            return;
        return lexer_1.default.tokenize(value, start, index, token.value, tokenType);
    }
    Expressions.leftRightExpr = leftRightExpr;
    function eqExpr(value, index) { return leftRightExpr(value, index, "eq", lexer_1.default.TokenType.EqualsExpression); }
    Expressions.eqExpr = eqExpr;
    function neExpr(value, index) { return leftRightExpr(value, index, "ne", lexer_1.default.TokenType.NotEqualsExpression); }
    Expressions.neExpr = neExpr;
    function ltExpr(value, index) { return leftRightExpr(value, index, "lt", lexer_1.default.TokenType.LesserThanExpression); }
    Expressions.ltExpr = ltExpr;
    function leExpr(value, index) { return leftRightExpr(value, index, "le", lexer_1.default.TokenType.LesserOrEqualsExpression); }
    Expressions.leExpr = leExpr;
    function gtExpr(value, index) { return leftRightExpr(value, index, "gt", lexer_1.default.TokenType.GreaterThanExpression); }
    Expressions.gtExpr = gtExpr;
    function geExpr(value, index) { return leftRightExpr(value, index, "ge", lexer_1.default.TokenType.GreaterOrEqualsExpression); }
    Expressions.geExpr = geExpr;
    function hasExpr(value, index) { return leftRightExpr(value, index, "has", lexer_1.default.TokenType.HasExpression); }
    Expressions.hasExpr = hasExpr;
    function addExpr(value, index) { return leftRightExpr(value, index, "add", lexer_1.default.TokenType.AddExpression); }
    Expressions.addExpr = addExpr;
    function subExpr(value, index) { return leftRightExpr(value, index, "sub", lexer_1.default.TokenType.SubExpression); }
    Expressions.subExpr = subExpr;
    function mulExpr(value, index) { return leftRightExpr(value, index, "mul", lexer_1.default.TokenType.MulExpression); }
    Expressions.mulExpr = mulExpr;
    function divExpr(value, index) { return leftRightExpr(value, index, "div", lexer_1.default.TokenType.DivExpression); }
    Expressions.divExpr = divExpr;
    function modExpr(value, index) { return leftRightExpr(value, index, "mod", lexer_1.default.TokenType.ModExpression); }
    Expressions.modExpr = modExpr;
    function notExpr(value, index) {
        if (!utils_1.default.equals(value, index, "not"))
            return;
        var start = index;
        index += 3;
        var rws = lexer_1.default.RWS(value, index);
        if (rws === index)
            return;
        index = rws;
        var token = boolCommonExpr(value, index);
        if (!token)
            return;
        return lexer_1.default.tokenize(value, start, token.next, token, lexer_1.default.TokenType.NotExpression);
    }
    Expressions.notExpr = notExpr;
    function boolParenExpr(value, index) {
        var open = lexer_1.default.OPEN(value, index);
        if (!open)
            return;
        var start = index;
        index = open;
        index = lexer_1.default.BWS(value, index);
        var token = boolCommonExpr(value, index);
        if (!token)
            return;
        index = lexer_1.default.BWS(value, token.next);
        var close = lexer_1.default.CLOSE(value, index);
        if (!close)
            return;
        index = close;
        return lexer_1.default.tokenize(value, start, index, token, lexer_1.default.TokenType.BoolParenExpression);
    }
    Expressions.boolParenExpr = boolParenExpr;
    function parenExpr(value, index) {
        var open = lexer_1.default.OPEN(value, index);
        if (!open)
            return;
        var start = index;
        index = open;
        index = lexer_1.default.BWS(value, index);
        var token = commonExpr(value, index);
        if (!token)
            return;
        index = lexer_1.default.BWS(value, token.next);
        var close = lexer_1.default.CLOSE(value, index);
        if (!close)
            return;
        index = close;
        return lexer_1.default.tokenize(value, start, index, token.value, lexer_1.default.TokenType.ParenExpression);
    }
    Expressions.parenExpr = parenExpr;
    function boolMethodCallExpr(value, index) {
        return endsWithMethodCallExpr(value, index) ||
            startsWithMethodCallExpr(value, index) ||
            containsMethodCallExpr(value, index) ||
            intersectsMethodCallExpr(value, index);
    }
    Expressions.boolMethodCallExpr = boolMethodCallExpr;
    function methodCallExpr(value, index) {
        return indexOfMethodCallExpr(value, index) ||
            toLowerMethodCallExpr(value, index) ||
            toUpperMethodCallExpr(value, index) ||
            trimMethodCallExpr(value, index) ||
            substringMethodCallExpr(value, index) ||
            substringOfMethodCallExpr(value, index) ||
            concatMethodCallExpr(value, index) ||
            lengthMethodCallExpr(value, index) ||
            yearMethodCallExpr(value, index) ||
            monthMethodCallExpr(value, index) ||
            dayMethodCallExpr(value, index) ||
            hourMethodCallExpr(value, index) ||
            minuteMethodCallExpr(value, index) ||
            secondMethodCallExpr(value, index) ||
            fractionalsecondsMethodCallExpr(value, index) ||
            totalsecondsMethodCallExpr(value, index) ||
            dateMethodCallExpr(value, index) ||
            timeMethodCallExpr(value, index) ||
            roundMethodCallExpr(value, index) ||
            floorMethodCallExpr(value, index) ||
            ceilingMethodCallExpr(value, index) ||
            distanceMethodCallExpr(value, index) ||
            geoLengthMethodCallExpr(value, index) ||
            totalOffsetMinutesMethodCallExpr(value, index) ||
            minDateTimeMethodCallExpr(value, index) ||
            maxDateTimeMethodCallExpr(value, index) ||
            nowMethodCallExpr(value, index);
    }
    Expressions.methodCallExpr = methodCallExpr;
    function methodCallExprFactory(value, index, method, min, max) {
        if (typeof min === "undefined")
            min = 0;
        if (typeof max === "undefined")
            max = min;
        if (!utils_1.default.equals(value, index, method))
            return;
        var start = index;
        index += method.length;
        var open = lexer_1.default.OPEN(value, index);
        if (!open)
            return;
        index = open;
        index = lexer_1.default.BWS(value, index);
        var parameters;
        if (min > 0) {
            parameters = [];
            while (parameters.length < max) {
                var expr = commonExpr(value, index);
                if (parameters.length < min && !expr)
                    return;
                else if (expr) {
                    parameters.push(expr.value);
                    index = expr.next;
                    index = lexer_1.default.BWS(value, index);
                    var comma = lexer_1.default.COMMA(value, index);
                    if (parameters.length < min && !comma)
                        return;
                    if (comma)
                        index = comma;
                    else
                        break;
                    index = lexer_1.default.BWS(value, index);
                }
                else
                    break;
            }
        }
        index = lexer_1.default.BWS(value, index);
        var close = lexer_1.default.CLOSE(value, index);
        if (!close)
            return;
        index = close;
        return lexer_1.default.tokenize(value, start, index, {
            method: method,
            parameters: parameters
        }, lexer_1.default.TokenType.MethodCallExpression);
    }
    Expressions.methodCallExprFactory = methodCallExprFactory;
    function containsMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "contains", 2); }
    Expressions.containsMethodCallExpr = containsMethodCallExpr;
    function startsWithMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "startswith", 2); }
    Expressions.startsWithMethodCallExpr = startsWithMethodCallExpr;
    function endsWithMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "endswith", 2); }
    Expressions.endsWithMethodCallExpr = endsWithMethodCallExpr;
    function lengthMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "length", 1); }
    Expressions.lengthMethodCallExpr = lengthMethodCallExpr;
    function indexOfMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "indexof", 2); }
    Expressions.indexOfMethodCallExpr = indexOfMethodCallExpr;
    function substringMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "substring", 2, 3); }
    Expressions.substringMethodCallExpr = substringMethodCallExpr;
    function substringOfMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "substringof", 2); }
    Expressions.substringOfMethodCallExpr = substringOfMethodCallExpr;
    function toLowerMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "tolower", 1); }
    Expressions.toLowerMethodCallExpr = toLowerMethodCallExpr;
    function toUpperMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "toupper", 1); }
    Expressions.toUpperMethodCallExpr = toUpperMethodCallExpr;
    function trimMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "trim", 1); }
    Expressions.trimMethodCallExpr = trimMethodCallExpr;
    function concatMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "concat", 2); }
    Expressions.concatMethodCallExpr = concatMethodCallExpr;
    function yearMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "year", 1); }
    Expressions.yearMethodCallExpr = yearMethodCallExpr;
    function monthMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "month", 1); }
    Expressions.monthMethodCallExpr = monthMethodCallExpr;
    function dayMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "day", 1); }
    Expressions.dayMethodCallExpr = dayMethodCallExpr;
    function hourMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "hour", 1); }
    Expressions.hourMethodCallExpr = hourMethodCallExpr;
    function minuteMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "minute", 1); }
    Expressions.minuteMethodCallExpr = minuteMethodCallExpr;
    function secondMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "second", 1); }
    Expressions.secondMethodCallExpr = secondMethodCallExpr;
    function fractionalsecondsMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "fractionalseconds", 1); }
    Expressions.fractionalsecondsMethodCallExpr = fractionalsecondsMethodCallExpr;
    function totalsecondsMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "totalseconds", 1); }
    Expressions.totalsecondsMethodCallExpr = totalsecondsMethodCallExpr;
    function dateMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "date", 1); }
    Expressions.dateMethodCallExpr = dateMethodCallExpr;
    function timeMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "time", 1); }
    Expressions.timeMethodCallExpr = timeMethodCallExpr;
    function totalOffsetMinutesMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "totaloffsetminutes", 1); }
    Expressions.totalOffsetMinutesMethodCallExpr = totalOffsetMinutesMethodCallExpr;
    function minDateTimeMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "mindatetime", 0); }
    Expressions.minDateTimeMethodCallExpr = minDateTimeMethodCallExpr;
    function maxDateTimeMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "maxdatetime", 0); }
    Expressions.maxDateTimeMethodCallExpr = maxDateTimeMethodCallExpr;
    function nowMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "now", 0); }
    Expressions.nowMethodCallExpr = nowMethodCallExpr;
    function roundMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "round", 1); }
    Expressions.roundMethodCallExpr = roundMethodCallExpr;
    function floorMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "floor", 1); }
    Expressions.floorMethodCallExpr = floorMethodCallExpr;
    function ceilingMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "ceiling", 1); }
    Expressions.ceilingMethodCallExpr = ceilingMethodCallExpr;
    function distanceMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "geo.distance", 2); }
    Expressions.distanceMethodCallExpr = distanceMethodCallExpr;
    function geoLengthMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "geo.length", 1); }
    Expressions.geoLengthMethodCallExpr = geoLengthMethodCallExpr;
    function intersectsMethodCallExpr(value, index) { return methodCallExprFactory(value, index, "geo.intersects", 2); }
    Expressions.intersectsMethodCallExpr = intersectsMethodCallExpr;
    function isofExpr(value, index) {
        if (!utils_1.default.equals(value, index, "isof"))
            return;
        var start = index;
        index += 4;
        var open = lexer_1.default.OPEN(value, index);
        if (!open)
            return;
        index = open;
        index = lexer_1.default.BWS(value, index);
        var expr = commonExpr(value, index);
        if (expr) {
            index = expr.next;
            index = lexer_1.default.BWS(value, index);
            var comma = lexer_1.default.COMMA(value, index);
            if (!comma)
                return;
            index = comma;
            index = lexer_1.default.BWS(value, index);
        }
        var typeName = nameOrIdentifier_1.default.qualifiedTypeName(value, index);
        if (!typeName)
            return;
        index = typeName.next;
        index = lexer_1.default.BWS(value, index);
        var close = lexer_1.default.CLOSE(value, index);
        if (!close)
            return;
        index = close;
        return lexer_1.default.tokenize(value, start, index, {
            target: expr,
            typename: typeName
        }, lexer_1.default.TokenType.IsOfExpression);
    }
    Expressions.isofExpr = isofExpr;
    function castExpr(value, index) {
        if (!utils_1.default.equals(value, index, "cast"))
            return;
        var start = index;
        index += 4;
        var open = lexer_1.default.OPEN(value, index);
        if (!open)
            return;
        index = open;
        index = lexer_1.default.BWS(value, index);
        var expr = commonExpr(value, index);
        if (expr) {
            index = expr.next;
            index = lexer_1.default.BWS(value, index);
            var comma = lexer_1.default.COMMA(value, index);
            if (!comma)
                return;
            index = comma;
            index = lexer_1.default.BWS(value, index);
        }
        var typeName = nameOrIdentifier_1.default.qualifiedTypeName(value, index);
        if (!typeName)
            return;
        index = typeName.next;
        index = lexer_1.default.BWS(value, index);
        var close = lexer_1.default.CLOSE(value, index);
        if (!close)
            return;
        index = close;
        return lexer_1.default.tokenize(value, start, index, {
            target: expr,
            typename: typeName
        }, lexer_1.default.TokenType.CastExpression);
    }
    Expressions.castExpr = castExpr;
    function negateExpr(value, index) {
        if (value[index] !== 0x2d)
            return;
        var start = index;
        index++;
        index = lexer_1.default.BWS(value, index);
        var expr = commonExpr(value, index);
        if (!expr)
            return;
        return lexer_1.default.tokenize(value, start, expr.next, expr, lexer_1.default.TokenType.NegateExpression);
    }
    Expressions.negateExpr = negateExpr;
    function firstMemberExpr(value, index) {
        var token = inscopeVariableExpr(value, index);
        var member;
        var start = index;
        if (token) {
            if (value[token.next] === 0x2f) {
                index = token.next + 1;
                member = memberExpr(value, index);
                if (!member)
                    return;
                return lexer_1.default.tokenize(value, start, member.next, [token, member], lexer_1.default.TokenType.FirstMemberExpression);
            }
        }
        else
            member = memberExpr(value, index);
        token = token || member;
        if (!token)
            return;
        return lexer_1.default.tokenize(value, start, token.next, token, lexer_1.default.TokenType.FirstMemberExpression);
    }
    Expressions.firstMemberExpr = firstMemberExpr;
    function memberExpr(value, index) {
        var start = index;
        var token = nameOrIdentifier_1.default.qualifiedEntityTypeName(value, index);
        if (token) {
            if (value[token.next] !== 0x2f)
                return;
            index = token.next + 1;
        }
        var next = propertyPathExpr(value, index) ||
            boundFunctionExpr(value, index);
        if (!next)
            return;
        return lexer_1.default.tokenize(value, start, next.next, token ? { name: token, value: next } : next, lexer_1.default.TokenType.MemberExpression);
    }
    Expressions.memberExpr = memberExpr;
    function propertyPathExpr(value, index) {
        var token = nameOrIdentifier_1.default.odataIdentifier(value, index);
        var start = index;
        if (token) {
            index = token.next;
            var nav = collectionPathExpr(value, token.next) ||
                collectionNavigationExpr(value, token.next) ||
                singleNavigationExpr(value, token.next) ||
                complexPathExpr(value, token.next) ||
                singlePathExpr(value, token.next);
            if (nav) {
                index = nav.next;
                token = {
                    current: lexer_1.default.clone(token),
                    next: nav
                };
            }
        }
        else if (!token) {
            token = nameOrIdentifier_1.default.streamProperty(value, index);
            if (token)
                index = token.next;
        }
        if (!token)
            return;
        return lexer_1.default.tokenize(value, start, index, token, lexer_1.default.TokenType.PropertyPathExpression);
    }
    Expressions.propertyPathExpr = propertyPathExpr;
    function inscopeVariableExpr(value, index) {
        return implicitVariableExpr(value, index) ||
            (isLambdaPredicate ? lambdaVariableExpr(value, index) : undefined);
    }
    Expressions.inscopeVariableExpr = inscopeVariableExpr;
    function implicitVariableExpr(value, index) {
        if (utils_1.default.equals(value, index, "$it"))
            return lexer_1.default.tokenize(value, index, index + 3, "$it", lexer_1.default.TokenType.ImplicitVariableExpression);
    }
    Expressions.implicitVariableExpr = implicitVariableExpr;
    var isLambdaPredicate = false;
    var hasLambdaVariableExpr = false;
    function lambdaVariableExpr(value, index) {
        var token = nameOrIdentifier_1.default.odataIdentifier(value, index, lexer_1.default.TokenType.LambdaVariableExpression);
        if (token) {
            hasLambdaVariableExpr = true;
            return token;
        }
    }
    Expressions.lambdaVariableExpr = lambdaVariableExpr;
    function lambdaPredicateExpr(value, index) {
        isLambdaPredicate = true;
        var token = boolCommonExpr(value, index);
        isLambdaPredicate = false;
        if (token && hasLambdaVariableExpr) {
            hasLambdaVariableExpr = false;
            return lexer_1.default.tokenize(value, token.position, token.next, token, lexer_1.default.TokenType.LambdaPredicateExpression);
        }
    }
    Expressions.lambdaPredicateExpr = lambdaPredicateExpr;
    function anyExpr(value, index) {
        if (!utils_1.default.equals(value, index, "any"))
            return;
        var start = index;
        index += 3;
        var open = lexer_1.default.OPEN(value, index);
        if (!open)
            return;
        index = open;
        index = lexer_1.default.BWS(value, index);
        var variable = lambdaVariableExpr(value, index);
        var predicate;
        if (variable) {
            index = variable.next;
            index = lexer_1.default.BWS(value, index);
            var colon = lexer_1.default.COLON(value, index);
            if (!colon)
                return;
            index = colon;
            index = lexer_1.default.BWS(value, index);
            predicate = lambdaPredicateExpr(value, index);
            if (!predicate)
                return;
            index = predicate.next;
        }
        index = lexer_1.default.BWS(value, index);
        var close = lexer_1.default.CLOSE(value, index);
        if (!close)
            return;
        index = close;
        return lexer_1.default.tokenize(value, start, index, {
            variable: variable,
            predicate: predicate
        }, lexer_1.default.TokenType.AnyExpression);
    }
    Expressions.anyExpr = anyExpr;
    function allExpr(value, index) {
        if (!utils_1.default.equals(value, index, "all"))
            return;
        var start = index;
        index += 3;
        var open = lexer_1.default.OPEN(value, index);
        if (!open)
            return;
        index = open;
        index = lexer_1.default.BWS(value, index);
        var variable = lambdaVariableExpr(value, index);
        if (!variable)
            return;
        index = variable.next;
        index = lexer_1.default.BWS(value, index);
        var colon = lexer_1.default.COLON(value, index);
        if (!colon)
            return;
        index = colon;
        index = lexer_1.default.BWS(value, index);
        var predicate = lambdaPredicateExpr(value, index);
        if (!predicate)
            return;
        index = predicate.next;
        index = lexer_1.default.BWS(value, index);
        var close = lexer_1.default.CLOSE(value, index);
        if (!close)
            return;
        index = close;
        return lexer_1.default.tokenize(value, start, index, {
            variable: variable,
            predicate: predicate
        }, lexer_1.default.TokenType.AllExpression);
    }
    Expressions.allExpr = allExpr;
    function collectionNavigationExpr(value, index) {
        var start = index;
        var entity, predicate, navigation, path;
        if (value[index] === 0x2f) {
            index++;
            entity = nameOrIdentifier_1.default.qualifiedEntityTypeName(value, index);
            if (!entity)
                return;
            index = entity.next;
        }
        predicate = keyPredicate(value, index);
        if (predicate) {
            index = predicate.next;
            navigation = singleNavigationExpr(value, index);
            if (navigation)
                index = navigation.next;
        }
        else {
            path = collectionPathExpr(value, index);
            if (path)
                index = path.next;
        }
        if (index > start) {
            return lexer_1.default.tokenize(value, start, index, {
                entity: entity,
                predicate: predicate,
                navigation: navigation,
                path: path
            }, lexer_1.default.TokenType.CollectionNavigationExpression);
        }
    }
    Expressions.collectionNavigationExpr = collectionNavigationExpr;
    function keyPredicate(value, index, metadataContext) {
        return simpleKey(value, index, metadataContext) ||
            compoundKey(value, index);
    }
    Expressions.keyPredicate = keyPredicate;
    function simpleKey(value, index, metadataContext) {
        var open = lexer_1.default.OPEN(value, index);
        if (!open)
            return;
        var start = index;
        index = open;
        var token = keyPropertyValue(value, index);
        if (!token)
            return;
        var close = lexer_1.default.CLOSE(value, token.next);
        if (!close)
            return;
        var key;
        if (typeof metadataContext === "object" &&
            metadataContext.key &&
            metadataContext.key.propertyRefs &&
            metadataContext.key.propertyRefs[0] &&
            metadataContext.key.propertyRefs[0].name) {
            key = metadataContext.key.propertyRefs[0].name;
        }
        return lexer_1.default.tokenize(value, start, close, { key: key, value: token }, lexer_1.default.TokenType.SimpleKey);
    }
    Expressions.simpleKey = simpleKey;
    function compoundKey(value, index) {
        var open = lexer_1.default.OPEN(value, index);
        if (!open)
            return;
        var start = index;
        index = open;
        var pair = keyValuePair(value, index);
        if (!pair)
            return;
        var keys = [];
        while (pair) {
            keys.push(pair);
            var comma = lexer_1.default.COMMA(value, pair.next);
            if (comma)
                pair = keyValuePair(value, comma);
            else
                pair = null;
        }
        index = keys[keys.length - 1].next;
        var close = lexer_1.default.CLOSE(value, index);
        if (!close)
            return;
        index = close;
        return lexer_1.default.tokenize(value, start, index, keys, lexer_1.default.TokenType.CompoundKey);
    }
    Expressions.compoundKey = compoundKey;
    function keyValuePair(value, index) {
        var prop = nameOrIdentifier_1.default.primitiveKeyProperty(value, index) ||
            keyPropertyAlias(value, index);
        if (!prop)
            return;
        var eq = lexer_1.default.EQ(value, prop.next);
        if (!eq)
            return;
        var val = keyPropertyValue(value, eq);
        if (val)
            return lexer_1.default.tokenize(value, index, val.next, {
                key: prop,
                value: val
            }, lexer_1.default.TokenType.KeyValuePair);
    }
    Expressions.keyValuePair = keyValuePair;
    function keyPropertyValue(value, index) {
        var token = primitiveLiteral_1.default.primitiveLiteral(value, index);
        if (token) {
            token.type = lexer_1.default.TokenType.KeyPropertyValue;
            return token;
        }
    }
    Expressions.keyPropertyValue = keyPropertyValue;
    function keyPropertyAlias(value, index) { return nameOrIdentifier_1.default.odataIdentifier(value, index, lexer_1.default.TokenType.KeyPropertyAlias); }
    Expressions.keyPropertyAlias = keyPropertyAlias;
    function singleNavigationExpr(value, index) {
        if (value[index] !== 0x2f)
            return;
        var member = memberExpr(value, index + 1);
        if (member)
            return lexer_1.default.tokenize(value, index, member.next, member, lexer_1.default.TokenType.SingleNavigationExpression);
    }
    Expressions.singleNavigationExpr = singleNavigationExpr;
    function collectionPathExpr(value, index) {
        var token = countExpr(value, index);
        if (!token) {
            if (value[index] === 0x2f) {
                token = boundFunctionExpr(value, index + 1) ||
                    anyExpr(value, index + 1) ||
                    allExpr(value, index + 1);
            }
        }
        if (token)
            return lexer_1.default.tokenize(value, index, token.next, token, lexer_1.default.TokenType.CollectionPathExpression);
    }
    Expressions.collectionPathExpr = collectionPathExpr;
    function complexPathExpr(value, index) {
        if (value[index] !== 0x2f)
            return;
        var start = index;
        index++;
        var token = nameOrIdentifier_1.default.qualifiedComplexTypeName(value, index);
        if (token) {
            if (value[token.next] !== 0x2f)
                return;
            index = token.next + 1;
        }
        var expr = propertyPathExpr(value, index) ||
            boundFunctionExpr(value, index);
        if (expr)
            return lexer_1.default.tokenize(value, start, expr.next, token ? [token, expr] : [expr], lexer_1.default.TokenType.ComplexPathExpression);
    }
    Expressions.complexPathExpr = complexPathExpr;
    function singlePathExpr(value, index) {
        if (value[index] !== 0x2f)
            return;
        var boundFunction = boundFunctionExpr(value, index + 1);
        if (boundFunction)
            return lexer_1.default.tokenize(value, index, boundFunction.next, boundFunction, lexer_1.default.TokenType.SinglePathExpression);
    }
    Expressions.singlePathExpr = singlePathExpr;
    function functionExpr(value, index) {
        var namespaceNext = nameOrIdentifier_1.default.namespace(value, index);
        if (namespaceNext === index || value[namespaceNext] !== 0x2e)
            return;
        var start = index;
        index = namespaceNext + 1;
        var token = nameOrIdentifier_1.default.odataIdentifier(value, index);
        if (!token)
            return;
        token.position = start;
        token.value.namespace = utils_1.default.stringify(value, start, namespaceNext);
        token.raw = utils_1.default.stringify(value, start, token.next);
        index = token.next;
        var params = functionExprParameters(value, index);
        if (!params)
            return;
        index = params.next;
        var expr = collectionPathExpr(value, index) ||
            collectionNavigationExpr(value, index) ||
            singleNavigationExpr(value, index) ||
            complexPathExpr(value, index) ||
            singlePathExpr(value, index);
        if (expr)
            index = expr.next;
        return lexer_1.default.tokenize(value, start, index, {
            fn: token,
            params: params,
            expression: expr
        }, lexer_1.default.TokenType.FunctionExpression);
    }
    Expressions.functionExpr = functionExpr;
    function boundFunctionExpr(value, index) { return functionExpr(value, index); }
    Expressions.boundFunctionExpr = boundFunctionExpr;
    function functionExprParameters(value, index) {
        var open = lexer_1.default.OPEN(value, index);
        if (!open)
            return;
        var start = index;
        index = open;
        var params = [];
        var expr = functionExprParameter(value, index);
        while (expr) {
            params.push(expr);
            var comma = lexer_1.default.COMMA(value, expr.next);
            if (comma) {
                index = comma;
                expr = functionExprParameter(value, index);
                if (!expr)
                    return;
            }
            else {
                index = expr.next;
                expr = null;
            }
        }
        var close = lexer_1.default.CLOSE(value, index);
        if (!close)
            return;
        index = close;
        return lexer_1.default.tokenize(value, start, index, params, lexer_1.default.TokenType.FunctionExpressionParameters);
    }
    Expressions.functionExprParameters = functionExprParameters;
    function functionExprParameter(value, index) {
        var name = parameterName(value, index);
        if (!name)
            return;
        var eq = lexer_1.default.EQ(value, name.next);
        if (!name || !eq)
            return;
        var start = index;
        index = eq;
        var param = parameterAlias(value, index) ||
            parameterValue(value, index);
        if (!param)
            return;
        return lexer_1.default.tokenize(value, start, param.next, {
            name: name,
            value: param
        }, lexer_1.default.TokenType.FunctionExpressionParameter);
    }
    Expressions.functionExprParameter = functionExprParameter;
    function parameterName(value, index) { return nameOrIdentifier_1.default.odataIdentifier(value, index, lexer_1.default.TokenType.ParameterName); }
    Expressions.parameterName = parameterName;
    function parameterAlias(value, index) {
        var at = lexer_1.default.AT(value, index);
        if (!at)
            return;
        var id = nameOrIdentifier_1.default.odataIdentifier(value, at);
        if (id)
            return lexer_1.default.tokenize(value, index, id.next, id.value, lexer_1.default.TokenType.ParameterAlias);
    }
    Expressions.parameterAlias = parameterAlias;
    function parameterValue(value, index) {
        var token = json_1.default.arrayOrObject(value, index) ||
            commonExpr(value, index);
        if (token)
            return lexer_1.default.tokenize(value, index, token.next, token.value, lexer_1.default.TokenType.ParameterValue);
    }
    Expressions.parameterValue = parameterValue;
    function countExpr(value, index) {
        if (utils_1.default.equals(value, index, "/$count"))
            return lexer_1.default.tokenize(value, index, index + 7, "/$count", lexer_1.default.TokenType.CountExpression);
    }
    Expressions.countExpr = countExpr;
    function refExpr(value, index) {
        if (utils_1.default.equals(value, index, "/$ref"))
            return lexer_1.default.tokenize(value, index, index + 5, "/$ref", lexer_1.default.TokenType.RefExpression);
    }
    Expressions.refExpr = refExpr;
    function valueExpr(value, index) {
        if (utils_1.default.equals(value, index, "/$value"))
            return lexer_1.default.tokenize(value, index, index + 7, "/$value", lexer_1.default.TokenType.ValueExpression);
    }
    Expressions.valueExpr = valueExpr;
    function rootExpr(value, index) {
        if (!utils_1.default.equals(value, index, "$root/"))
            return;
        var start = index;
        index += 6;
        var entitySet = nameOrIdentifier_1.default.entitySetName(value, index);
        var predicate, entity, token;
        if (entitySet)
            predicate = keyPredicate(value, entitySet.next);
        if (!(entitySet && predicate)) {
            entity = nameOrIdentifier_1.default.singletonEntity(value, index);
            if (!entity)
                return;
            token = {
                entity: entity
            };
        }
        else
            token = {
                entitySet: entitySet,
                keys: predicate
            };
        index = (predicate || entity).next;
        var nav = singleNavigationExpr(value, index);
        if (nav)
            index = nav.next;
        return lexer_1.default.tokenize(value, start, index, {
            current: token,
            next: nav
        }, lexer_1.default.TokenType.RootExpression);
    }
    Expressions.rootExpr = rootExpr;
})(Expressions = exports.Expressions || (exports.Expressions = {}));
exports.default = Expressions;
//# sourceMappingURL=expressions.js.map