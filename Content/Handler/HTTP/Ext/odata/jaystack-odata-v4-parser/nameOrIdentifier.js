"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var utils_1 = require("./utils");
var lexer_1 = require("./lexer");
var primitiveLiteral_1 = require("./primitiveLiteral");
var NameOrIdentifier;
(function (NameOrIdentifier) {
    function enumeration(value, index) {
        var type = qualifiedEnumTypeName(value, index);
        if (!type)
            return;
        var start = index;
        index = type.next;
        var squote = lexer_1.default.SQUOTE(value, index);
        if (!squote)
            return;
        index = squote;
        var enumVal = NameOrIdentifier.enumValue(value, index);
        if (!enumVal)
            return;
        index = enumVal.next;
        squote = lexer_1.default.SQUOTE(value, index);
        if (!squote)
            return;
        index = squote;
        return lexer_1.default.tokenize(value, start, index, {
            name: type,
            value: enumVal
        }, lexer_1.default.TokenType.Enum);
    }
    NameOrIdentifier.enumeration = enumeration;
    function enumValue(value, index) {
        var val = NameOrIdentifier.singleEnumValue(value, index);
        if (!val)
            return;
        var start = index;
        var arr = [];
        while (val) {
            arr.push(val);
            index = val.next;
            var comma = lexer_1.default.COMMA(value, val.next);
            if (comma) {
                index = comma;
                val = NameOrIdentifier.singleEnumValue(value, index);
            }
            else
                break;
        }
        return lexer_1.default.tokenize(value, start, index, { values: arr }, lexer_1.default.TokenType.EnumValue);
    }
    NameOrIdentifier.enumValue = enumValue;
    function singleEnumValue(value, index) {
        return NameOrIdentifier.enumerationMember(value, index) ||
            NameOrIdentifier.enumMemberValue(value, index);
    }
    NameOrIdentifier.singleEnumValue = singleEnumValue;
    function enumMemberValue(value, index) {
        var token = primitiveLiteral_1.default.int64Value(value, index);
        if (token) {
            token.type = lexer_1.default.TokenType.EnumMemberValue;
            return token;
        }
    }
    NameOrIdentifier.enumMemberValue = enumMemberValue;
    function singleQualifiedTypeName(value, index) {
        return NameOrIdentifier.qualifiedEntityTypeName(value, index) ||
            NameOrIdentifier.qualifiedComplexTypeName(value, index) ||
            NameOrIdentifier.qualifiedTypeDefinitionName(value, index) ||
            NameOrIdentifier.qualifiedEnumTypeName(value, index) ||
            NameOrIdentifier.primitiveTypeName(value, index);
    }
    NameOrIdentifier.singleQualifiedTypeName = singleQualifiedTypeName;
    function qualifiedTypeName(value, index) {
        if (utils_1.default.equals(value, index, "Collection")) {
            var start = index;
            index += 10;
            var squote = lexer_1.default.SQUOTE(value, index);
            if (!squote)
                return;
            index = squote;
            var token = NameOrIdentifier.singleQualifiedTypeName(value, index);
            if (!token)
                return;
            else
                index = token.next;
            squote = lexer_1.default.SQUOTE(value, index);
            if (!squote)
                return;
            index = squote;
            token.position = start;
            token.next = index;
            token.raw = utils_1.default.stringify(value, token.position, token.next);
            token.type = lexer_1.default.TokenType.Collection;
        }
        else
            return NameOrIdentifier.singleQualifiedTypeName(value, index);
    }
    NameOrIdentifier.qualifiedTypeName = qualifiedTypeName;
    function qualifiedEntityTypeName(value, index, metadataContext) {
        var start = index;
        var namespaceNext = NameOrIdentifier.namespace(value, index);
        if (namespaceNext === index || value[namespaceNext] !== 0x2e)
            return;
        var schema;
        if (typeof metadataContext === "object") {
            schema = NameOrIdentifier.getMetadataRoot(metadataContext).schemas.filter(function (it) { return it.namespace === utils_1.default.stringify(value, start, namespaceNext); })[0];
        }
        var name = NameOrIdentifier.entityTypeName(value, namespaceNext + 1, schema);
        if (!name)
            return;
        name.value.namespace = utils_1.default.stringify(value, start, namespaceNext);
        return lexer_1.default.tokenize(value, start, name.next, name, lexer_1.default.TokenType.QualifiedEntityTypeName);
    }
    NameOrIdentifier.qualifiedEntityTypeName = qualifiedEntityTypeName;
    function qualifiedComplexTypeName(value, index, metadataContext) {
        var start = index;
        var namespaceNext = NameOrIdentifier.namespace(value, index);
        if (namespaceNext === index || value[namespaceNext] !== 0x2e)
            return;
        var schema;
        if (typeof metadataContext === "object") {
            schema = NameOrIdentifier.getMetadataRoot(metadataContext).schemas.filter(function (it) { return it.namespace === utils_1.default.stringify(value, start, namespaceNext); })[0];
        }
        var name = NameOrIdentifier.complexTypeName(value, namespaceNext + 1, schema);
        if (!name)
            return;
        name.value.namespace = utils_1.default.stringify(value, start, namespaceNext);
        return lexer_1.default.tokenize(value, start, name.next, name, lexer_1.default.TokenType.QualifiedComplexTypeName);
    }
    NameOrIdentifier.qualifiedComplexTypeName = qualifiedComplexTypeName;
    function qualifiedTypeDefinitionName(value, index) {
        var start = index;
        var namespaceNext = NameOrIdentifier.namespace(value, index);
        if (namespaceNext === index || value[namespaceNext] !== 0x2e)
            return;
        var nameNext = NameOrIdentifier.typeDefinitionName(value, namespaceNext + 1);
        if (nameNext && nameNext.next === namespaceNext + 1)
            return;
        return lexer_1.default.tokenize(value, start, nameNext.next, "TypeDefinitionName", lexer_1.default.TokenType.Identifier);
    }
    NameOrIdentifier.qualifiedTypeDefinitionName = qualifiedTypeDefinitionName;
    function qualifiedEnumTypeName(value, index) {
        var start = index;
        var namespaceNext = NameOrIdentifier.namespace(value, index);
        if (namespaceNext === index || value[namespaceNext] !== 0x2e)
            return;
        var nameNext = NameOrIdentifier.enumerationTypeName(value, namespaceNext + 1);
        if (nameNext && nameNext.next === namespaceNext + 1)
            return;
        return lexer_1.default.tokenize(value, start, nameNext.next, "EnumTypeName", lexer_1.default.TokenType.Identifier);
    }
    NameOrIdentifier.qualifiedEnumTypeName = qualifiedEnumTypeName;
    function namespace(value, index) {
        var part = NameOrIdentifier.namespacePart(value, index);
        while (part && part.next > index) {
            index = part.next;
            if (value[part.next] === 0x2e) {
                index++;
                part = NameOrIdentifier.namespacePart(value, index);
                if (part && value[part.next] !== 0x2e)
                    return index - 1;
            }
        }
        return index - 1;
    }
    NameOrIdentifier.namespace = namespace;
    function odataIdentifier(value, index, tokenType) {
        var start = index;
        if (lexer_1.default.identifierLeadingCharacter(value[index])) {
            index++;
            while (index < value.length && (index - start < 128) && lexer_1.default.identifierCharacter(value[index])) {
                index++;
            }
        }
        if (index > start)
            return lexer_1.default.tokenize(value, start, index, { name: utils_1.default.stringify(value, start, index) }, tokenType || lexer_1.default.TokenType.ODataIdentifier);
    }
    NameOrIdentifier.odataIdentifier = odataIdentifier;
    function namespacePart(value, index) { return NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.NamespacePart); }
    NameOrIdentifier.namespacePart = namespacePart;
    function entitySetName(value, index, metadataContext) {
        var token = NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.EntitySetName);
        if (!token)
            return;
        if (typeof metadataContext === "object") {
            var entitySet_1;
            metadataContext.dataServices.schemas.forEach(function (schema) { return schema.entityContainer.forEach(function (container) { return container.entitySets.filter(function (set) {
                var eq = set.name === token.raw;
                if (eq)
                    entitySet_1 = set;
                return eq;
            }); }); });
            if (!entitySet_1)
                return;
            var entityType_1;
            metadataContext.dataServices.schemas.forEach(function (schema) { return entitySet_1.entityType.indexOf(schema.namespace + ".") === 0 && schema.entityTypes.filter(function (type) {
                var eq = type.name === entitySet_1.entityType.replace(schema.namespace + ".", "");
                if (eq)
                    entityType_1 = type;
                return eq;
            }); });
            if (!entityType_1)
                return;
            token.metadata = entityType_1;
        }
        return token;
    }
    NameOrIdentifier.entitySetName = entitySetName;
    function singletonEntity(value, index) { return NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.SingletonEntity); }
    NameOrIdentifier.singletonEntity = singletonEntity;
    function entityTypeName(value, index, schema) {
        var token = NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.EntityTypeName);
        if (!token)
            return;
        if (typeof schema === "object") {
            var type = schema.entityTypes.filter(function (it) { return it.name === token.raw; })[0];
            if (!type)
                return;
            token.metadata = type;
        }
        return token;
    }
    NameOrIdentifier.entityTypeName = entityTypeName;
    function complexTypeName(value, index, schema) {
        var token = NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.ComplexTypeName);
        if (!token)
            return;
        if (typeof schema === "object") {
            var type = schema.complexTypes.filter(function (it) { return it.name === token.raw; })[0];
            if (!type)
                return;
            token.metadata = type;
        }
        return token;
    }
    NameOrIdentifier.complexTypeName = complexTypeName;
    function typeDefinitionName(value, index) { return NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.TypeDefinitionName); }
    NameOrIdentifier.typeDefinitionName = typeDefinitionName;
    function enumerationTypeName(value, index) { return NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.EnumerationTypeName); }
    NameOrIdentifier.enumerationTypeName = enumerationTypeName;
    function enumerationMember(value, index) { return NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.EnumerationMember); }
    NameOrIdentifier.enumerationMember = enumerationMember;
    function termName(value, index) { return NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.TermName); }
    NameOrIdentifier.termName = termName;
    function primitiveTypeName(value, index) {
        if (!utils_1.default.equals(value, index, "Edm."))
            return;
        var start = index;
        index += 4;
        var end = index + (utils_1.default.equals(value, index, "Binary") ||
            utils_1.default.equals(value, index, "Boolean") ||
            utils_1.default.equals(value, index, "Byte") ||
            utils_1.default.equals(value, index, "Date") ||
            utils_1.default.equals(value, index, "DateTimeOffset") ||
            utils_1.default.equals(value, index, "Decimal") ||
            utils_1.default.equals(value, index, "Double") ||
            utils_1.default.equals(value, index, "Duration") ||
            utils_1.default.equals(value, index, "Guid") ||
            utils_1.default.equals(value, index, "Int16") ||
            utils_1.default.equals(value, index, "Int32") ||
            utils_1.default.equals(value, index, "Int64") ||
            utils_1.default.equals(value, index, "SByte") ||
            utils_1.default.equals(value, index, "Single") ||
            utils_1.default.equals(value, index, "Stream") ||
            utils_1.default.equals(value, index, "String") ||
            utils_1.default.equals(value, index, "TimeOfDay") ||
            utils_1.default.equals(value, index, "GeographyCollection") ||
            utils_1.default.equals(value, index, "GeographyLineString") ||
            utils_1.default.equals(value, index, "GeographyMultiLineString") ||
            utils_1.default.equals(value, index, "GeographyMultiPoint") ||
            utils_1.default.equals(value, index, "GeographyMultiPolygon") ||
            utils_1.default.equals(value, index, "GeographyPoint") ||
            utils_1.default.equals(value, index, "GeographyPolygon") ||
            utils_1.default.equals(value, index, "GeometryCollection") ||
            utils_1.default.equals(value, index, "GeometryLineString") ||
            utils_1.default.equals(value, index, "GeometryMultiLineString") ||
            utils_1.default.equals(value, index, "GeometryMultiPoint") ||
            utils_1.default.equals(value, index, "GeometryMultiPolygon") ||
            utils_1.default.equals(value, index, "GeometryPoint") ||
            utils_1.default.equals(value, index, "GeometryPolygon"));
        if (end > index)
            return lexer_1.default.tokenize(value, start, end, "PrimitiveTypeName", lexer_1.default.TokenType.Identifier);
    }
    NameOrIdentifier.primitiveTypeName = primitiveTypeName;
    var primitiveTypes = [
        "Edm.Binary", "Edm.Boolean", "Edm.Byte", "Edm.Date", "Edm.DateTimeOffset", "Edm.Decimal", "Edm.Double", "Edm.Duration", "Edm.Guid",
        "Edm.Int16", "Edm.Int32", "Edm.Int64", "Edm.SByte", "Edm.Single", "Edm.Stream", "Edm.String", "Edm.TimeOfDay",
        "Edm.GeographyCollection", "Edm.GeographyLineString", "Edm.GeographyMultiLineString", "Edm.GeographyMultiPoint", "Edm.GeographyMultiPolygon", "Edm.GeographyPoint", "Edm.GeographyPolygon",
        "Edm.GeometryCollection", "Edm.GeometryLineString", "Edm.GeometryMultiLineString", "Edm.GeometryMultiPoint", "Edm.GeometryMultiPolygon", "Edm.GeometryPoint", "Edm.GeometryPolygon"
    ];
    function isPrimitiveTypeName(type, metadataContext) {
        var root = NameOrIdentifier.getMetadataRoot(metadataContext);
        var schemas = root.schemas || (root.dataServices && root.dataServices.schemas) || [];
        var schema = schemas.filter(function (it) { return type.indexOf(it.namespace + ".") === 0; })[0];
        if (schema) {
            return ((schema.enumTypes && schema.enumTypes.filter(function (it) { return it.name === type.split(".").pop(); })[0]) ||
                (schema.typeDefinitions && schema.typeDefinitions.filter(function (it) { return it.name === type.split(".").pop(); })[0])) &&
                !((schema.entityTypes && schema.entityTypes.filter(function (it) { return it.name === type.split(".").pop(); })[0]) ||
                    (schema.complexTypes && schema.complexTypes.filter(function (it) { return it.name === type.split(".").pop(); })[0]));
        }
        return primitiveTypes.indexOf(type) >= 0;
    }
    NameOrIdentifier.isPrimitiveTypeName = isPrimitiveTypeName;
    function getMetadataRoot(metadataContext) {
        var root = metadataContext;
        while (root.parent) {
            root = root.parent;
        }
        return root.dataServices || root;
    }
    NameOrIdentifier.getMetadataRoot = getMetadataRoot;
    function primitiveProperty(value, index, metadataContext) {
        var token = NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.PrimitiveProperty);
        if (!token)
            return;
        if (typeof metadataContext === "object") {
            var _loop_1 = function (i) {
                var prop = metadataContext.properties[i];
                if (prop.name === token.raw) {
                    if (prop.type.indexOf("Collection") === 0 || !NameOrIdentifier.isPrimitiveTypeName(prop.type, metadataContext))
                        return { value: void 0 };
                    token.metadata = prop;
                    if (metadataContext.key && metadataContext.key.propertyRefs.filter(function (it) { return it.name === prop.name; }).length > 0) {
                        token.type = lexer_1.default.TokenType.PrimitiveKeyProperty;
                    }
                    return "break";
                }
            };
            for (var i = 0; i < metadataContext.properties.length; i++) {
                var state_1 = _loop_1(i);
                if (typeof state_1 === "object")
                    return state_1.value;
                if (state_1 === "break")
                    break;
            }
            if (!token.metadata)
                return;
        }
        return token;
    }
    NameOrIdentifier.primitiveProperty = primitiveProperty;
    function primitiveKeyProperty(value, index, metadataContext) {
        var token = NameOrIdentifier.primitiveProperty(value, index, metadataContext);
        if (token && token.type === lexer_1.default.TokenType.PrimitiveKeyProperty)
            return token;
    }
    NameOrIdentifier.primitiveKeyProperty = primitiveKeyProperty;
    function primitiveNonKeyProperty(value, index, metadataContext) {
        var token = NameOrIdentifier.primitiveProperty(value, index, metadataContext);
        if (token && token.type === lexer_1.default.TokenType.PrimitiveProperty)
            return token;
    }
    NameOrIdentifier.primitiveNonKeyProperty = primitiveNonKeyProperty;
    function primitiveColProperty(value, index, metadataContext) {
        var token = NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.PrimitiveCollectionProperty);
        if (!token)
            return;
        if (typeof metadataContext === "object") {
            var _loop_2 = function (i) {
                var prop = metadataContext.properties[i];
                if (prop.name === token.raw) {
                    if (prop.type.indexOf("Collection") === -1 || !NameOrIdentifier.isPrimitiveTypeName(prop.type.slice(11, -1), metadataContext))
                        return { value: void 0 };
                    token.metadata = prop;
                    if (metadataContext.key.propertyRefs.filter(function (it) { return it.name === prop.name; }).length > 0) {
                        token.type = lexer_1.default.TokenType.PrimitiveKeyProperty;
                    }
                    return "break";
                }
            };
            for (var i = 0; i < metadataContext.properties.length; i++) {
                var state_2 = _loop_2(i);
                if (typeof state_2 === "object")
                    return state_2.value;
                if (state_2 === "break")
                    break;
            }
            if (!token.metadata)
                return;
        }
        return token;
    }
    NameOrIdentifier.primitiveColProperty = primitiveColProperty;
    function complexProperty(value, index, metadataContext) {
        var token = NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.ComplexProperty);
        if (!token)
            return;
        if (typeof metadataContext === "object") {
            var _loop_3 = function (i) {
                var prop = metadataContext.properties[i];
                if (prop.name === token.raw) {
                    if (prop.type.indexOf("Collection") === 0 || NameOrIdentifier.isPrimitiveTypeName(prop.type, metadataContext))
                        return { value: void 0 };
                    var root = NameOrIdentifier.getMetadataRoot(metadataContext);
                    var schema = root.schemas.filter(function (it) { return prop.type.indexOf(it.namespace + ".") === 0; })[0];
                    if (!schema)
                        return { value: void 0 };
                    var complexType = schema.complexTypes.filter(function (it) { return it.name === prop.type.split(".").pop(); })[0];
                    if (!complexType)
                        return { value: void 0 };
                    token.metadata = complexType;
                    return "break";
                }
            };
            for (var i = 0; i < metadataContext.properties.length; i++) {
                var state_3 = _loop_3(i);
                if (typeof state_3 === "object")
                    return state_3.value;
                if (state_3 === "break")
                    break;
            }
            if (!token.metadata)
                return;
        }
        return token;
    }
    NameOrIdentifier.complexProperty = complexProperty;
    function complexColProperty(value, index, metadataContext) {
        var token = NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.ComplexCollectionProperty);
        if (!token)
            return;
        if (typeof metadataContext === "object") {
            var _loop_4 = function (i) {
                var prop = metadataContext.properties[i];
                if (prop.name === token.raw) {
                    if (prop.type.indexOf("Collection") === -1 || NameOrIdentifier.isPrimitiveTypeName(prop.type.slice(11, -1), metadataContext))
                        return { value: void 0 };
                    var root = NameOrIdentifier.getMetadataRoot(metadataContext);
                    var schema = root.schemas.filter(function (it) { return prop.type.slice(11, -1).indexOf(it.namespace + ".") === 0; })[0];
                    if (!schema)
                        return { value: void 0 };
                    var complexType = schema.complexTypes.filter(function (it) { return it.name === prop.type.slice(11, -1).split(".").pop(); })[0];
                    if (!complexType)
                        return { value: void 0 };
                    token.metadata = complexType;
                    return "break";
                }
            };
            for (var i = 0; i < metadataContext.properties.length; i++) {
                var state_4 = _loop_4(i);
                if (typeof state_4 === "object")
                    return state_4.value;
                if (state_4 === "break")
                    break;
            }
            if (!token.metadata)
                return;
        }
        return token;
    }
    NameOrIdentifier.complexColProperty = complexColProperty;
    function streamProperty(value, index, metadataContext) {
        var token = NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.StreamProperty);
        if (!token)
            return;
        if (typeof metadataContext === "object") {
            for (var i = 0; i < metadataContext.properties.length; i++) {
                var prop = metadataContext.properties[i];
                if (prop.name === token.raw) {
                    if (prop.type !== "Edm.Stream")
                        return;
                    token.metadata = prop;
                    break;
                }
            }
            if (!token.metadata)
                return;
        }
        return token;
    }
    NameOrIdentifier.streamProperty = streamProperty;
    function navigationProperty(value, index, metadataContext) {
        return NameOrIdentifier.entityNavigationProperty(value, index, metadataContext) ||
            NameOrIdentifier.entityColNavigationProperty(value, index, metadataContext);
    }
    NameOrIdentifier.navigationProperty = navigationProperty;
    function entityNavigationProperty(value, index, metadataContext) {
        var token = NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.EntityNavigationProperty);
        if (!token)
            return;
        if (typeof metadataContext === "object") {
            var _loop_5 = function (i) {
                var prop = metadataContext.navigationProperties[i];
                if (prop.name === token.raw && prop.type.indexOf("Collection") === -1 && !NameOrIdentifier.isPrimitiveTypeName(prop.type.slice(11, -1), metadataContext)) {
                    var root = NameOrIdentifier.getMetadataRoot(metadataContext);
                    var schema = root.schemas.filter(function (it) { return prop.type.indexOf(it.namespace + ".") === 0; })[0];
                    if (!schema)
                        return { value: void 0 };
                    var entityType = schema.entityTypes.filter(function (it) { return it.name === prop.type.split(".").pop(); })[0];
                    if (!entityType)
                        return { value: void 0 };
                    token.metadata = entityType;
                }
            };
            for (var i = 0; i < metadataContext.navigationProperties.length; i++) {
                var state_5 = _loop_5(i);
                if (typeof state_5 === "object")
                    return state_5.value;
            }
            if (!token.metadata)
                return;
        }
        return token;
    }
    NameOrIdentifier.entityNavigationProperty = entityNavigationProperty;
    function entityColNavigationProperty(value, index, metadataContext) {
        var token = NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.EntityCollectionNavigationProperty);
        if (!token)
            return;
        if (typeof metadataContext === "object") {
            var _loop_6 = function (i) {
                var prop = metadataContext.navigationProperties[i];
                if (prop.name === token.raw && prop.type.indexOf("Collection") === 0 && !NameOrIdentifier.isPrimitiveTypeName(prop.type.slice(11, -1), metadataContext)) {
                    var root = NameOrIdentifier.getMetadataRoot(metadataContext);
                    var schema = root.schemas.filter(function (it) { return prop.type.slice(11, -1).indexOf(it.namespace + ".") === 0; })[0];
                    if (!schema)
                        return { value: void 0 };
                    var entityType = schema.entityTypes.filter(function (it) { return it.name === prop.type.slice(11, -1).split(".").pop(); })[0];
                    if (!entityType)
                        return { value: void 0 };
                    token.metadata = entityType;
                }
            };
            for (var i = 0; i < metadataContext.navigationProperties.length; i++) {
                var state_6 = _loop_6(i);
                if (typeof state_6 === "object")
                    return state_6.value;
            }
            if (!token.metadata)
                return;
        }
        return token;
    }
    NameOrIdentifier.entityColNavigationProperty = entityColNavigationProperty;
    function action(value, index, isCollection, metadataContext) {
        var token = NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.Action);
        if (!token)
            return;
        if (typeof metadataContext === "object") {
            var type = NameOrIdentifier.getOperationType("action", metadataContext, token, isCollection, false, false, "entityTypes");
            if (!type)
                return;
        }
        return token;
    }
    NameOrIdentifier.action = action;
    function actionImport(value, index, metadataContext) {
        var token = NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.ActionImport);
        if (!token)
            return;
        if (typeof metadataContext === "object") {
            var type = NameOrIdentifier.getOperationImportType("action", metadataContext, token);
            if (!type)
                return;
        }
        return token;
    }
    NameOrIdentifier.actionImport = actionImport;
    function odataFunction(value, index) {
        return NameOrIdentifier.entityFunction(value, index) ||
            NameOrIdentifier.entityColFunction(value, index) ||
            NameOrIdentifier.complexFunction(value, index) ||
            NameOrIdentifier.complexColFunction(value, index) ||
            NameOrIdentifier.primitiveFunction(value, index) ||
            NameOrIdentifier.primitiveColFunction(value, index);
    }
    NameOrIdentifier.odataFunction = odataFunction;
    function getOperationType(operation, metadataContext, token, isBoundCollection, isCollection, isPrimitive, types) {
        var bindingParameterType = metadataContext.parent.namespace + "." + metadataContext.name;
        if (isBoundCollection)
            bindingParameterType = "Collection(" + bindingParameterType + ")";
        var fnDef;
        var root = NameOrIdentifier.getMetadataRoot(metadataContext);
        for (var i = 0; i < root.schemas.length; i++) {
            var schema = root.schemas[i];
            for (var j = 0; j < schema[operation + "s"].length; j++) {
                var fn = schema[operation + "s"][j];
                if (fn.name === token.raw && fn.isBound) {
                    for (var k = 0; k < fn.parameters.length; k++) {
                        var param = fn.parameters[k];
                        if (param.name === "bindingParameter" && param.type === bindingParameterType) {
                            fnDef = fn;
                            break;
                        }
                    }
                }
                if (fnDef)
                    break;
            }
            if (fnDef)
                break;
        }
        if (!fnDef)
            return;
        if (operation === "action")
            return fnDef;
        if (fnDef.returnType.type.indexOf("Collection") === isCollection ? -1 : 0)
            return;
        var elementType = isCollection ? fnDef.returnType.type.slice(11, -1) : fnDef.returnType.type;
        if (NameOrIdentifier.isPrimitiveTypeName(elementType, metadataContext) && !isPrimitive)
            return;
        if (!NameOrIdentifier.isPrimitiveTypeName(elementType, metadataContext) && isPrimitive)
            return;
        if (isPrimitive)
            return elementType;
        var type;
        for (var i = 0; i < root.schemas.length; i++) {
            var schema = root.schemas[i];
            if (elementType.indexOf(schema.namespace + ".") === 0) {
                for (var j = 0; j < schema[types].length; j++) {
                    var it = schema[types][j];
                    if (schema.namespace + "." + it.name === elementType) {
                        type = it;
                        break;
                    }
                }
            }
            if (type)
                break;
        }
        return type;
    }
    NameOrIdentifier.getOperationType = getOperationType;
    function entityFunction(value, index, isCollection, metadataContext) {
        var token = NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.EntityFunction);
        if (!token)
            return;
        if (typeof metadataContext === "object") {
            var type = NameOrIdentifier.getOperationType("function", metadataContext, token, isCollection, false, false, "entityTypes");
            if (!type)
                return;
            token.metadata = type;
        }
        return token;
    }
    NameOrIdentifier.entityFunction = entityFunction;
    function entityColFunction(value, index, isCollection, metadataContext) {
        var token = NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.EntityCollectionFunction);
        if (!token)
            return;
        if (typeof metadataContext === "object") {
            var type = NameOrIdentifier.getOperationType("function", metadataContext, token, isCollection, true, false, "entityTypes");
            if (!type)
                return;
            token.metadata = type;
        }
        return token;
    }
    NameOrIdentifier.entityColFunction = entityColFunction;
    function complexFunction(value, index, isCollection, metadataContext) {
        var token = NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.ComplexFunction);
        if (!token)
            return;
        if (typeof metadataContext === "object") {
            var type = NameOrIdentifier.getOperationType("function", metadataContext, token, isCollection, false, false, "complexTypes");
            if (!type)
                return;
            token.metadata = type;
        }
        return token;
    }
    NameOrIdentifier.complexFunction = complexFunction;
    function complexColFunction(value, index, isCollection, metadataContext) {
        var token = NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.ComplexCollectionFunction);
        if (!token)
            return;
        if (typeof metadataContext === "object") {
            var type = NameOrIdentifier.getOperationType("function", metadataContext, token, isCollection, true, false, "complexTypes");
            if (!type)
                return;
            token.metadata = type;
        }
        return token;
    }
    NameOrIdentifier.complexColFunction = complexColFunction;
    function primitiveFunction(value, index, isCollection, metadataContext) {
        var token = NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.PrimitiveFunction);
        if (!token)
            return;
        if (typeof metadataContext === "object") {
            var type = NameOrIdentifier.getOperationType("function", metadataContext, token, isCollection, false, true);
            if (!type)
                return;
            token.metadata = type;
        }
        return token;
    }
    NameOrIdentifier.primitiveFunction = primitiveFunction;
    function primitiveColFunction(value, index, isCollection, metadataContext) {
        var token = NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.PrimitiveCollectionFunction);
        if (!token)
            return;
        if (typeof metadataContext === "object") {
            var type = NameOrIdentifier.getOperationType("function", metadataContext, token, isCollection, true, true);
            if (!type)
                return;
            token.metadata = type;
        }
        return token;
    }
    NameOrIdentifier.primitiveColFunction = primitiveColFunction;
    function getOperationImportType(operation, metadataContext, token, isCollection, isPrimitive, types) {
        var fnImport;
        for (var i = 0; i < metadataContext.dataServices.schemas.length; i++) {
            var schema = metadataContext.dataServices.schemas[i];
            for (var j = 0; j < schema.entityContainer.length; j++) {
                var container = schema.entityContainer[j];
                for (var k = 0; k < container[operation + "Imports"].length; k++) {
                    var it = container[operation + "Imports"][k];
                    if (it.name === token.raw) {
                        fnImport = it;
                        break;
                    }
                }
                if (fnImport)
                    break;
            }
            if (fnImport)
                break;
        }
        if (!fnImport)
            return;
        var fn;
        for (var i = 0; i < metadataContext.dataServices.schemas.length; i++) {
            var schema = metadataContext.dataServices.schemas[i];
            if (fnImport[operation].indexOf(schema.namespace + ".") === 0) {
                for (var j = 0; j < schema[operation + "s"].length; j++) {
                    var it = schema[operation + "s"][j];
                    if (it.name === fnImport.name) {
                        fn = it;
                        break;
                    }
                }
            }
            if (fn)
                break;
        }
        if (!fn)
            return;
        if (operation === "action")
            return fn;
        if (fn.returnType.type.indexOf("Collection") === isCollection ? -1 : 0)
            return;
        var elementType = isCollection ? fn.returnType.type.slice(11, -1) : fn.returnType.type;
        if (NameOrIdentifier.isPrimitiveTypeName(elementType, metadataContext) && !isPrimitive)
            return;
        if (!NameOrIdentifier.isPrimitiveTypeName(elementType, metadataContext) && isPrimitive)
            return;
        if (isPrimitive)
            return elementType;
        var type;
        for (var i = 0; i < metadataContext.dataServices.schemas.length; i++) {
            var schema = metadataContext.dataServices.schemas[i];
            if (elementType.indexOf(schema.namespace + ".") === 0) {
                for (var j = 0; j < schema[types].length; j++) {
                    var it = schema[types][j];
                    if (schema.namespace + "." + it.name === elementType) {
                        type = it;
                        break;
                    }
                }
            }
            if (type)
                break;
        }
        return type;
    }
    NameOrIdentifier.getOperationImportType = getOperationImportType;
    function entityFunctionImport(value, index, metadataContext) {
        var token = NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.EntityFunctionImport);
        if (!token)
            return;
        if (typeof metadataContext === "object") {
            var type = NameOrIdentifier.getOperationImportType("function", metadataContext, token, false, false, "entityTypes");
            if (!type)
                return;
            token.metadata = type;
        }
        return token;
    }
    NameOrIdentifier.entityFunctionImport = entityFunctionImport;
    function entityColFunctionImport(value, index, metadataContext) {
        var token = NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.EntityCollectionFunctionImport);
        if (!token)
            return;
        if (typeof metadataContext === "object") {
            var type = NameOrIdentifier.getOperationImportType("function", metadataContext, token, true, false, "entityTypes");
            if (!type)
                return;
            token.metadata = type;
        }
        return token;
    }
    NameOrIdentifier.entityColFunctionImport = entityColFunctionImport;
    function complexFunctionImport(value, index, metadataContext) {
        var token = NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.ComplexFunctionImport);
        if (!token)
            return;
        if (typeof metadataContext === "object") {
            var type = NameOrIdentifier.getOperationImportType("function", metadataContext, token, false, false, "complexTypes");
            if (!type)
                return;
            token.metadata = type;
        }
        return token;
    }
    NameOrIdentifier.complexFunctionImport = complexFunctionImport;
    function complexColFunctionImport(value, index, metadataContext) {
        var token = NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.ComplexCollectionFunctionImport);
        if (!token)
            return;
        if (typeof metadataContext === "object") {
            var type = NameOrIdentifier.getOperationImportType("function", metadataContext, token, true, false, "complexTypes");
            if (!type)
                return;
            token.metadata = type;
        }
        return token;
    }
    NameOrIdentifier.complexColFunctionImport = complexColFunctionImport;
    function primitiveFunctionImport(value, index, metadataContext) {
        var token = NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.PrimitiveFunctionImport);
        if (!token)
            return;
        if (typeof metadataContext === "object") {
            var type = NameOrIdentifier.getOperationImportType("function", metadataContext, token, false, true);
            if (!type)
                return;
            token.metadata = type;
        }
        return token;
    }
    NameOrIdentifier.primitiveFunctionImport = primitiveFunctionImport;
    function primitiveColFunctionImport(value, index, metadataContext) {
        var token = NameOrIdentifier.odataIdentifier(value, index, lexer_1.default.TokenType.PrimitiveCollectionFunctionImport);
        if (!token)
            return;
        if (typeof metadataContext === "object") {
            var type = NameOrIdentifier.getOperationImportType("function", metadataContext, token, true, true);
            if (!type)
                return;
            token.metadata = type;
        }
        return token;
    }
    NameOrIdentifier.primitiveColFunctionImport = primitiveColFunctionImport;
})(NameOrIdentifier = exports.NameOrIdentifier || (exports.NameOrIdentifier = {}));
exports.default = NameOrIdentifier;
//# sourceMappingURL=nameOrIdentifier.js.map