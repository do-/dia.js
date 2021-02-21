"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var utils_1 = require("./utils");
var TokenType;
(function (TokenType) {
    TokenType["Literal"] = "Literal";
    TokenType["ArrayOrObject"] = "ArrayOrObject";
    TokenType["Array"] = "Array";
    TokenType["Object"] = "Object";
    TokenType["Property"] = "Property";
    TokenType["Annotation"] = "Annotation";
    TokenType["Enum"] = "Enum";
    TokenType["EnumValue"] = "EnumValue";
    TokenType["EnumMemberValue"] = "EnumMemberValue";
    TokenType["Identifier"] = "Identifier";
    TokenType["QualifiedEntityTypeName"] = "QualifiedEntityTypeName";
    TokenType["QualifiedComplexTypeName"] = "QualifiedComplexTypeName";
    TokenType["ODataIdentifier"] = "ODataIdentifier";
    TokenType["Collection"] = "Collection";
    TokenType["NamespacePart"] = "NamespacePart";
    TokenType["EntitySetName"] = "EntitySetName";
    TokenType["SingletonEntity"] = "SingletonEntity";
    TokenType["EntityTypeName"] = "EntityTypeName";
    TokenType["ComplexTypeName"] = "ComplexTypeName";
    TokenType["TypeDefinitionName"] = "TypeDefinitionName";
    TokenType["EnumerationTypeName"] = "EnumerationTypeName";
    TokenType["EnumerationMember"] = "EnumerationMember";
    TokenType["TermName"] = "TermName";
    TokenType["PrimitiveProperty"] = "PrimitiveProperty";
    TokenType["PrimitiveKeyProperty"] = "PrimitiveKeyProperty";
    TokenType["PrimitiveNonKeyProperty"] = "PrimitiveNonKeyProperty";
    TokenType["PrimitiveCollectionProperty"] = "PrimitiveCollectionProperty";
    TokenType["ComplexProperty"] = "ComplexProperty";
    TokenType["ComplexCollectionProperty"] = "ComplexCollectionProperty";
    TokenType["StreamProperty"] = "StreamProperty";
    TokenType["NavigationProperty"] = "NavigationProperty";
    TokenType["EntityNavigationProperty"] = "EntityNavigationProperty";
    TokenType["EntityCollectionNavigationProperty"] = "EntityCollectionNavigationProperty";
    TokenType["Action"] = "Action";
    TokenType["ActionImport"] = "ActionImport";
    TokenType["Function"] = "Function";
    TokenType["EntityFunction"] = "EntityFunction";
    TokenType["EntityCollectionFunction"] = "EntityCollectionFunction";
    TokenType["ComplexFunction"] = "ComplexFunction";
    TokenType["ComplexCollectionFunction"] = "ComplexCollectionFunction";
    TokenType["PrimitiveFunction"] = "PrimitiveFunction";
    TokenType["PrimitiveCollectionFunction"] = "PrimitiveCollectionFunction";
    TokenType["EntityFunctionImport"] = "EntityFunctionImport";
    TokenType["EntityCollectionFunctionImport"] = "EntityCollectionFunctionImport";
    TokenType["ComplexFunctionImport"] = "ComplexFunctionImport";
    TokenType["ComplexCollectionFunctionImport"] = "ComplexCollectionFunctionImport";
    TokenType["PrimitiveFunctionImport"] = "PrimitiveFunctionImport";
    TokenType["PrimitiveCollectionFunctionImport"] = "PrimitiveCollectionFunctionImport";
    TokenType["CommonExpression"] = "CommonExpression";
    TokenType["AndExpression"] = "AndExpression";
    TokenType["OrExpression"] = "OrExpression";
    TokenType["EqualsExpression"] = "EqualsExpression";
    TokenType["NotEqualsExpression"] = "NotEqualsExpression";
    TokenType["LesserThanExpression"] = "LesserThanExpression";
    TokenType["LesserOrEqualsExpression"] = "LesserOrEqualsExpression";
    TokenType["GreaterThanExpression"] = "GreaterThanExpression";
    TokenType["GreaterOrEqualsExpression"] = "GreaterOrEqualsExpression";
    TokenType["HasExpression"] = "HasExpression";
    TokenType["AddExpression"] = "AddExpression";
    TokenType["SubExpression"] = "SubExpression";
    TokenType["MulExpression"] = "MulExpression";
    TokenType["DivExpression"] = "DivExpression";
    TokenType["ModExpression"] = "ModExpression";
    TokenType["NotExpression"] = "NotExpression";
    TokenType["BoolParenExpression"] = "BoolParenExpression";
    TokenType["ParenExpression"] = "ParenExpression";
    TokenType["MethodCallExpression"] = "MethodCallExpression";
    TokenType["IsOfExpression"] = "IsOfExpression";
    TokenType["CastExpression"] = "CastExpression";
    TokenType["NegateExpression"] = "NegateExpression";
    TokenType["FirstMemberExpression"] = "FirstMemberExpression";
    TokenType["MemberExpression"] = "MemberExpression";
    TokenType["PropertyPathExpression"] = "PropertyPathExpression";
    TokenType["ImplicitVariableExpression"] = "ImplicitVariableExpression";
    TokenType["LambdaVariable"] = "LambdaVariable";
    TokenType["LambdaVariableExpression"] = "LambdaVariableExpression";
    TokenType["LambdaPredicateExpression"] = "LambdaPredicateExpression";
    TokenType["AnyExpression"] = "AnyExpression";
    TokenType["AllExpression"] = "AllExpression";
    TokenType["CollectionNavigationExpression"] = "CollectionNavigationExpression";
    TokenType["SimpleKey"] = "SimpleKey";
    TokenType["CompoundKey"] = "CompoundKey";
    TokenType["KeyValuePair"] = "KeyValuePair";
    TokenType["KeyPropertyValue"] = "KeyPropertyValue";
    TokenType["KeyPropertyAlias"] = "KeyPropertyAlias";
    TokenType["SingleNavigationExpression"] = "SingleNavigationExpression";
    TokenType["CollectionPathExpression"] = "CollectionPathExpression";
    TokenType["ComplexPathExpression"] = "ComplexPathExpression";
    TokenType["SinglePathExpression"] = "SinglePathExpression";
    TokenType["FunctionExpression"] = "FunctionExpression";
    TokenType["FunctionExpressionParameters"] = "FunctionExpressionParameters";
    TokenType["FunctionExpressionParameter"] = "FunctionExpressionParameter";
    TokenType["ParameterName"] = "ParameterName";
    TokenType["ParameterAlias"] = "ParameterAlias";
    TokenType["ParameterValue"] = "ParameterValue";
    TokenType["CountExpression"] = "CountExpression";
    TokenType["RefExpression"] = "RefExpression";
    TokenType["ValueExpression"] = "ValueExpression";
    TokenType["RootExpression"] = "RootExpression";
    TokenType["QueryOptions"] = "QueryOptions";
    TokenType["CustomQueryOption"] = "CustomQueryOption";
    TokenType["Expand"] = "Expand";
    TokenType["ExpandItem"] = "ExpandItem";
    TokenType["ExpandPath"] = "ExpandPath";
    TokenType["ExpandCountOption"] = "ExpandCountOption";
    TokenType["ExpandRefOption"] = "ExpandRefOption";
    TokenType["ExpandOption"] = "ExpandOption";
    TokenType["Levels"] = "Levels";
    TokenType["Search"] = "Search";
    TokenType["SearchExpression"] = "SearchExpression";
    TokenType["SearchParenExpression"] = "SearchParenExpression";
    TokenType["SearchNotExpression"] = "SearchNotExpression";
    TokenType["SearchOrExpression"] = "SearchOrExpression";
    TokenType["SearchAndExpression"] = "SearchAndExpression";
    TokenType["SearchTerm"] = "SearchTerm";
    TokenType["SearchPhrase"] = "SearchPhrase";
    TokenType["SearchWord"] = "SearchWord";
    TokenType["Filter"] = "Filter";
    TokenType["OrderBy"] = "OrderBy";
    TokenType["OrderByItem"] = "OrderByItem";
    TokenType["Skip"] = "Skip";
    TokenType["Top"] = "Top";
    TokenType["Format"] = "Format";
    TokenType["InlineCount"] = "InlineCount";
    TokenType["Select"] = "Select";
    TokenType["SelectItem"] = "SelectItem";
    TokenType["SelectPath"] = "SelectPath";
    TokenType["AliasAndValue"] = "AliasAndValue";
    TokenType["SkipToken"] = "SkipToken";
    TokenType["Id"] = "Id";
    TokenType["Crossjoin"] = "Crossjoin";
    TokenType["AllResource"] = "AllResource";
    TokenType["ActionImportCall"] = "ActionImportCall";
    TokenType["FunctionImportCall"] = "FunctionImportCall";
    TokenType["EntityCollectionFunctionImportCall"] = "EntityCollectionFunctionImportCall";
    TokenType["EntityFunctionImportCall"] = "EntityFunctionImportCall";
    TokenType["ComplexCollectionFunctionImportCall"] = "ComplexCollectionFunctionImportCall";
    TokenType["ComplexFunctionImportCall"] = "ComplexFunctionImportCall";
    TokenType["PrimitiveCollectionFunctionImportCall"] = "PrimitiveCollectionFunctionImportCall";
    TokenType["PrimitiveFunctionImportCall"] = "PrimitiveFunctionImportCall";
    TokenType["FunctionParameters"] = "FunctionParameters";
    TokenType["FunctionParameter"] = "FunctionParameter";
    TokenType["ResourcePath"] = "ResourcePath";
    TokenType["CollectionNavigation"] = "CollectionNavigation";
    TokenType["CollectionNavigationPath"] = "CollectionNavigationPath";
    TokenType["SingleNavigation"] = "SingleNavigation";
    TokenType["PropertyPath"] = "PropertyPath";
    TokenType["ComplexPath"] = "ComplexPath";
    TokenType["BoundOperation"] = "BoundOperation";
    TokenType["BoundActionCall"] = "BoundActionCall";
    TokenType["BoundEntityFunctionCall"] = "BoundEntityFunctionCall";
    TokenType["BoundEntityCollectionFunctionCall"] = "BoundEntityCollectionFunctionCall";
    TokenType["BoundComplexFunctionCall"] = "BoundComplexFunctionCall";
    TokenType["BoundComplexCollectionFunctionCall"] = "BoundComplexCollectionFunctionCall";
    TokenType["BoundPrimitiveFunctionCall"] = "BoundPrimitiveFunctionCall";
    TokenType["BoundPrimitiveCollectionFunctionCall"] = "BoundPrimitiveCollectionFunctionCall";
    TokenType["ODataUri"] = "ODataUri";
    TokenType["Batch"] = "Batch";
    TokenType["Entity"] = "Entity";
    TokenType["Metadata"] = "Metadata";
})(TokenType = exports.TokenType || (exports.TokenType = {}));
exports.LexerTokenType = TokenType;
var Token = /** @class */ (function () {
    function Token(token) {
        this.position = token.position;
        this.next = token.next;
        this.value = token.value;
        this.type = token.type;
        this.raw = token.raw;
        if (token.metadata)
            this.metadata = token.metadata;
    }
    return Token;
}());
exports.Token = Token;
exports.LexerToken = Token;
var Lexer;
(function (Lexer) {
    Lexer.Token = exports.Token;
    Lexer.TokenType = exports.TokenType;
    function tokenize(value, index, next, tokenValue, tokenType, metadataContextContainer) {
        var token = new exports.Token({
            position: index,
            next: next,
            value: tokenValue,
            type: tokenType,
            raw: utils_1.default.stringify(value, index, next)
        });
        if (metadataContextContainer && metadataContextContainer.metadata) {
            token.metadata = metadataContextContainer.metadata;
            delete metadataContextContainer.metadata;
        }
        return token;
    }
    Lexer.tokenize = tokenize;
    function clone(token) {
        return new exports.Token({
            position: token.position,
            next: token.next,
            value: token.value,
            type: token.type,
            raw: token.raw
        });
    }
    Lexer.clone = clone;
    // core definitions
    function ALPHA(value) { return (value >= 0x41 && value <= 0x5a) || (value >= 0x61 && value <= 0x7a) || value >= 0x80; }
    Lexer.ALPHA = ALPHA;
    function DIGIT(value) { return (value >= 0x30 && value <= 0x39); }
    Lexer.DIGIT = DIGIT;
    function HEXDIG(value) { return Lexer.DIGIT(value) || Lexer.AtoF(value); }
    Lexer.HEXDIG = HEXDIG;
    function AtoF(value) { return (value >= 0x41 && value <= 0x46) || (value >= 0x61 && value <= 0x66); }
    Lexer.AtoF = AtoF;
    function DQUOTE(value) { return value === 0x22; }
    Lexer.DQUOTE = DQUOTE;
    function SP(value) { return value === 0x20; }
    Lexer.SP = SP;
    function HTAB(value) { return value === 0x09; }
    Lexer.HTAB = HTAB;
    function VCHAR(value) { return value >= 0x21 && value <= 0x7e; }
    Lexer.VCHAR = VCHAR;
    // punctuation
    function whitespaceLength(value, index) {
        if (utils_1.default.equals(value, index, "%20") || utils_1.default.equals(value, index, "%09"))
            return 3;
        else if (Lexer.SP(value[index]) || Lexer.HTAB(value[index]) || value[index] === 0x20 || value[index] === 0x09)
            return 1;
    }
    Lexer.whitespaceLength = whitespaceLength;
    function OWS(value, index) {
        index = index || 0;
        var inc = Lexer.whitespaceLength(value, index);
        while (inc) {
            index += inc;
            inc = Lexer.whitespaceLength(value, index);
        }
        return index;
    }
    Lexer.OWS = OWS;
    function RWS(value, index) {
        return Lexer.OWS(value, index);
    }
    Lexer.RWS = RWS;
    function BWS(value, index) {
        return Lexer.OWS(value, index);
    }
    Lexer.BWS = BWS;
    function AT(value, index) {
        if (value[index] === 0x40)
            return index + 1;
        else if (utils_1.default.equals(value, index, "%40"))
            return index + 3;
    }
    Lexer.AT = AT;
    function COLON(value, index) {
        if (value[index] === 0x3a)
            return index + 1;
        else if (utils_1.default.equals(value, index, "%3A"))
            return index + 3;
    }
    Lexer.COLON = COLON;
    function COMMA(value, index) {
        if (value[index] === 0x2c)
            return index + 1;
        else if (utils_1.default.equals(value, index, "%2C"))
            return index + 3;
    }
    Lexer.COMMA = COMMA;
    function EQ(value, index) {
        if (value[index] === 0x3d)
            return index + 1;
    }
    Lexer.EQ = EQ;
    function SIGN(value, index) {
        if (value[index] === 0x2b || value[index] === 0x2d)
            return index + 1;
        else if (utils_1.default.equals(value, index, "%2B"))
            return index + 3;
    }
    Lexer.SIGN = SIGN;
    function SEMI(value, index) {
        if (value[index] === 0x3b)
            return index + 1;
        else if (utils_1.default.equals(value, index, "%3B"))
            return index + 3;
    }
    Lexer.SEMI = SEMI;
    function STAR(value, index) {
        if (value[index] === 0x2a)
            return index + 1;
        else if (utils_1.default.equals(value, index, "%2A"))
            return index + 3;
    }
    Lexer.STAR = STAR;
    function SQUOTE(value, index) {
        if (value[index] === 0x27)
            return index + 1;
        else if (utils_1.default.equals(value, index, "%27"))
            return index + 3;
    }
    Lexer.SQUOTE = SQUOTE;
    function OPEN(value, index) {
        if (value[index] === 0x28)
            return index + 1;
        else if (utils_1.default.equals(value, index, "%28"))
            return index + 3;
    }
    Lexer.OPEN = OPEN;
    function CLOSE(value, index) {
        if (value[index] === 0x29)
            return index + 1;
        else if (utils_1.default.equals(value, index, "%29"))
            return index + 3;
    }
    Lexer.CLOSE = CLOSE;
    // unreserved ALPHA / DIGIT / "-" / "." / "_" / "~"
    function unreserved(value) { return Lexer.ALPHA(value) || Lexer.DIGIT(value) || value === 0x2d || value === 0x2e || value === 0x5f || value === 0x7e; }
    Lexer.unreserved = unreserved;
    // other-delims "!" /                   "(" / ")" / "*" / "+" / "," / ";"
    function otherDelims(value, index) {
        if (value[index] === 0x21 || value[index] === 0x2b)
            return index + 1;
        else
            return Lexer.OPEN(value, index) || Lexer.CLOSE(value, index) || Lexer.STAR(value, index) || Lexer.COMMA(value, index) || Lexer.SEMI(value, index);
    }
    Lexer.otherDelims = otherDelims;
    // sub-delims     =       "$" / "&" / "'" /                                     "=" / other-delims
    function subDelims(value, index) {
        if (value[index] === 0x24 || value[index] === 0x26)
            return index + 1;
        else
            return Lexer.SQUOTE(value, index) || Lexer.EQ(value, index) || Lexer.otherDelims(value, index);
    }
    Lexer.subDelims = subDelims;
    function pctEncoded(value, index) {
        if (value[index] !== 0x25 || !Lexer.HEXDIG(value[index + 1]) || !Lexer.HEXDIG(value[index + 2]))
            return index;
        return index + 3;
    }
    Lexer.pctEncoded = pctEncoded;
    // pct-encoded-no-SQUOTE = "%" ( "0" / "1" /   "3" / "4" / "5" / "6" / "8" / "9" / A-to-F ) HEXDIG
    //                       / "%" "2" ( "0" / "1" / "2" / "3" / "4" / "5" / "6" /   "8" / "9" / A-to-F )
    function pctEncodedNoSQUOTE(value, index) {
        if (utils_1.default.equals(value, index, "%27"))
            return index;
        return Lexer.pctEncoded(value, index);
    }
    Lexer.pctEncodedNoSQUOTE = pctEncodedNoSQUOTE;
    function pctEncodedUnescaped(value, index) {
        if (utils_1.default.equals(value, index, "%22") ||
            utils_1.default.equals(value, index, "%3") ||
            utils_1.default.equals(value, index, "%4") ||
            utils_1.default.equals(value, index, "%5C"))
            return index;
        return Lexer.pctEncoded(value, index);
    }
    Lexer.pctEncodedUnescaped = pctEncodedUnescaped;
    function pchar(value, index) {
        if (Lexer.unreserved(value[index]))
            return index + 1;
        else
            return Lexer.subDelims(value, index) || Lexer.COLON(value, index) || Lexer.AT(value, index) || Lexer.pctEncoded(value, index) || index;
    }
    Lexer.pchar = pchar;
    function pcharNoSQUOTE(value, index) {
        if (Lexer.unreserved(value[index]) || value[index] === 0x24 || value[index] === 0x26)
            return index + 1;
        else
            return Lexer.otherDelims(value, index) || Lexer.EQ(value, index) || Lexer.COLON(value, index) || Lexer.AT(value, index) || Lexer.pctEncodedNoSQUOTE(value, index) || index;
    }
    Lexer.pcharNoSQUOTE = pcharNoSQUOTE;
    function qcharNoAMP(value, index) {
        if (Lexer.unreserved(value[index]) || value[index] === 0x3a || value[index] === 0x40 || value[index] === 0x2f || value[index] === 0x3f || value[index] === 0x24 || value[index] === 0x27 || value[index] === 0x3d)
            return index + 1;
        else
            return Lexer.pctEncoded(value, index) || Lexer.otherDelims(value, index) || index;
    }
    Lexer.qcharNoAMP = qcharNoAMP;
    function qcharNoAMPDQUOTE(value, index) {
        index = Lexer.BWS(value, index);
        if (Lexer.unreserved(value[index]) || value[index] === 0x3a || value[index] === 0x40 || value[index] === 0x2f || value[index] === 0x3f || value[index] === 0x24 || value[index] === 0x27 || value[index] === 0x3d)
            return index + 1;
        else
            return Lexer.otherDelims(value, index) || Lexer.pctEncodedUnescaped(value, index);
    }
    Lexer.qcharNoAMPDQUOTE = qcharNoAMPDQUOTE;
    // export function pchar(value:number):boolean { return unreserved(value) || otherDelims(value) || value == 0x24 || value == 0x26 || EQ(value) || COLON(value) || AT(value); }
    function base64char(value) { return Lexer.ALPHA(value) || Lexer.DIGIT(value) || value === 0x2d || value === 0x5f; }
    Lexer.base64char = base64char;
    function base64b16(value, index) {
        var start = index;
        if (!Lexer.base64char(value[index]) && !Lexer.base64char(value[index + 1]))
            return start;
        index += 2;
        if (!utils_1.default.is(value[index], "AEIMQUYcgkosw048"))
            return start;
        index++;
        if (value[index] === 0x3d)
            index++;
        return index;
    }
    Lexer.base64b16 = base64b16;
    function base64b8(value, index) {
        var start = index;
        if (!Lexer.base64char(value[index]))
            return start;
        index++;
        if (value[index] !== 0x41 || value[index] !== 0x51 || value[index] !== 0x67 || value[index] !== 0x77)
            return start;
        index++;
        if (value[index] === 0x3d && value[index + 1] === 0x3d)
            index += 2;
        return index;
    }
    Lexer.base64b8 = base64b8;
    function nanInfinity(value, index) {
        return utils_1.default.equals(value, index, "NaN") || utils_1.default.equals(value, index, "-INF") || utils_1.default.equals(value, index, "INF");
    }
    Lexer.nanInfinity = nanInfinity;
    function oneToNine(value) { return value !== 0x30 && Lexer.DIGIT(value); }
    Lexer.oneToNine = oneToNine;
    function zeroToFiftyNine(value, index) {
        if (value[index] >= 0x30 && value[index] <= 0x35 && Lexer.DIGIT(value[index + 1]))
            return index + 2;
        return index;
    }
    Lexer.zeroToFiftyNine = zeroToFiftyNine;
    function year(value, index) {
        var start = index;
        var end = index;
        if (value[index] === 0x2d)
            index++;
        if ((value[index] === 0x30 && (end = utils_1.default.required(value, index + 1, Lexer.DIGIT, 3, 3))) ||
            (Lexer.oneToNine(value[index]) && (end = utils_1.default.required(value, index + 1, Lexer.DIGIT, 3))))
            return end;
        return start;
    }
    Lexer.year = year;
    function month(value, index) {
        if ((value[index] === 0x30 && Lexer.oneToNine(value[index + 1])) ||
            (value[index] === 0x31 && value[index + 1] >= 0x30 && value[index + 1] <= 0x32))
            return index + 2;
        return index;
    }
    Lexer.month = month;
    function day(value, index) {
        if ((value[index] === 0x30 && Lexer.oneToNine(value[index + 1])) ||
            ((value[index] === 0x31 || value[index] === 0x32) && Lexer.DIGIT(value[index + 1])) ||
            (value[index] === 0x33 && (value[index + 1] === 0x30 || value[index + 1] === 0x31)))
            return index + 2;
        return index;
    }
    Lexer.day = day;
    function hour(value, index) {
        if (((value[index] === 0x30 || value[index] === 0x31) && Lexer.DIGIT(value[index + 1])) ||
            (value[index] === 0x32 && (value[index + 1] === 0x30 || value[index + 1] === 0x31 || value[index + 1] === 0x32 || value[index + 1] === 0x33)))
            return index + 2;
        return index;
    }
    Lexer.hour = hour;
    function minute(value, index) {
        return Lexer.zeroToFiftyNine(value, index);
    }
    Lexer.minute = minute;
    function second(value, index) {
        return Lexer.zeroToFiftyNine(value, index);
    }
    Lexer.second = second;
    function fractionalSeconds(value, index) {
        return utils_1.default.required(value, index, DIGIT, 1, 12);
    }
    Lexer.fractionalSeconds = fractionalSeconds;
    function geographyPrefix(value, index) {
        return utils_1.default.equals(value, index, "geography") ? index + 9 : index;
    }
    Lexer.geographyPrefix = geographyPrefix;
    function geometryPrefix(value, index) {
        return utils_1.default.equals(value, index, "geometry") ? index + 8 : index;
    }
    Lexer.geometryPrefix = geometryPrefix;
    function identifierLeadingCharacter(value) {
        return Lexer.ALPHA(value) || value === 0x5f;
    }
    Lexer.identifierLeadingCharacter = identifierLeadingCharacter;
    function identifierCharacter(value) {
        return Lexer.identifierLeadingCharacter(value) || Lexer.DIGIT(value);
    }
    Lexer.identifierCharacter = identifierCharacter;
    function beginObject(value, index) {
        var bws = Lexer.BWS(value, index);
        var start = index;
        index = bws;
        if (utils_1.default.equals(value, index, "{"))
            index++;
        else if (utils_1.default.equals(value, index, "%7B"))
            index += 3;
        if (index === bws)
            return start;
        bws = Lexer.BWS(value, index);
        return bws;
    }
    Lexer.beginObject = beginObject;
    function endObject(value, index) {
        var bws = Lexer.BWS(value, index);
        var start = index;
        index = bws;
        if (utils_1.default.equals(value, index, "}"))
            index++;
        else if (utils_1.default.equals(value, index, "%7D"))
            index += 3;
        if (index === bws)
            return start;
        bws = Lexer.BWS(value, index);
        return bws;
    }
    Lexer.endObject = endObject;
    function beginArray(value, index) {
        var bws = Lexer.BWS(value, index);
        var start = index;
        index = bws;
        if (utils_1.default.equals(value, index, "["))
            index++;
        else if (utils_1.default.equals(value, index, "%5B"))
            index += 3;
        if (index === bws)
            return start;
        bws = Lexer.BWS(value, index);
        return bws;
    }
    Lexer.beginArray = beginArray;
    function endArray(value, index) {
        var bws = Lexer.BWS(value, index);
        var start = index;
        index = bws;
        if (utils_1.default.equals(value, index, "]"))
            index++;
        else if (utils_1.default.equals(value, index, "%5D"))
            index += 3;
        if (index === bws)
            return start;
        bws = Lexer.BWS(value, index);
        return bws;
    }
    Lexer.endArray = endArray;
    function quotationMark(value, index) {
        if (Lexer.DQUOTE(value[index]))
            return index + 1;
        if (utils_1.default.equals(value, index, "%22"))
            return index + 3;
        return index;
    }
    Lexer.quotationMark = quotationMark;
    function nameSeparator(value, index) {
        var bws = Lexer.BWS(value, index);
        var start = index;
        index = bws;
        var colon = Lexer.COLON(value, index);
        if (!colon)
            return start;
        index = colon;
        bws = Lexer.BWS(value, index);
        return bws;
    }
    Lexer.nameSeparator = nameSeparator;
    function valueSeparator(value, index) {
        var bws = Lexer.BWS(value, index);
        var start = index;
        index = bws;
        var comma = Lexer.COMMA(value, index);
        if (!comma)
            return start;
        index = comma;
        bws = Lexer.BWS(value, index);
        return bws;
    }
    Lexer.valueSeparator = valueSeparator;
    function escape(value, index) {
        if (utils_1.default.equals(value, index, "\\"))
            return index + 1;
        if (utils_1.default.equals(value, index, "%5C"))
            return index + 3;
        return index;
    }
    Lexer.escape = escape;
})(Lexer = exports.Lexer || (exports.Lexer = {}));
exports.default = Lexer;
//# sourceMappingURL=lexer.js.map