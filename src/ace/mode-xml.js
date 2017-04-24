ace.define("ace/mode/xml_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    const XmlHighlightRules = function(normalize) {
        const tagRegex = "[_:a-zA-Z\xc0-\uffff][-_:.a-zA-Z0-9\xc0-\uffff]*";

        this.$rules = {
            start : [
                {token : "string.cdata.xml", regex : "<\\!\\[CDATA\\[", next : "cdata"},
                {
                    token : ["punctuation.xml-decl.xml", "keyword.xml-decl.xml"],
                    regex : "(<\\?)(xml)(?=[\\s])", next : "xml_decl", caseInsensitive: true
                },
                {
                    token : ["punctuation.instruction.xml", "keyword.instruction.xml"],
                    regex : `(<\\?)(${tagRegex})`, next : "processing_instruction"
                },
                {token : "comment.xml", regex : "<\\!--", next : "comment"},
                {
                    token : ["xml-pe.doctype.xml", "xml-pe.doctype.xml"],
                    regex : "(<\\!)(DOCTYPE)(?=[\\s])", next : "doctype", caseInsensitive: true
                },
                {include : "tag"},
                {token : "text.end-tag-open.xml", regex: "</"},
                {token : "text.tag-open.xml", regex: "<"},
                {include : "reference"},
                {defaultToken : "text.xml"}
            ],

            xml_decl : [{
                token : "entity.other.attribute-name.decl-attribute-name.xml",
                regex : `(?:${tagRegex}:)?${tagRegex}`
            }, {
                token : "keyword.operator.decl-attribute-equals.xml",
                regex : "="
            }, {
                include: "whitespace"
            }, {
                include: "string"
            }, {
                token : "punctuation.xml-decl.xml",
                regex : "\\?>",
                next : "start"
            }],

            processing_instruction : [
                {token : "punctuation.instruction.xml", regex : "\\?>", next : "start"},
                {defaultToken : "instruction.xml"}
            ],

            doctype : [
                {include : "whitespace"},
                {include : "string"},
                {token : "xml-pe.doctype.xml", regex : ">", next : "start"},
                {token : "xml-pe.xml", regex : "[-_a-zA-Z0-9:]+"},
                {token : "punctuation.int-subset", regex : "\\[", push : "int_subset"}
            ],

            int_subset : [{
                token : "text.xml",
                regex : "\\s+"
            }, {
                token: "punctuation.int-subset.xml",
                regex: "]",
                next: "pop"
            }, {
                token : ["punctuation.markup-decl.xml", "keyword.markup-decl.xml"],
                regex : `(<\\!)(${tagRegex})`,
                push : [{
                    token : "text",
                    regex : "\\s+"
                },
                {
                    token : "punctuation.markup-decl.xml",
                    regex : ">",
                    next : "pop"
                },
                {include : "string"}]
            }],

            cdata : [
                {token : "string.cdata.xml", regex : "\\]\\]>", next : "start"},
                {token : "text.xml", regex : "\\s+"},
                {token : "text.xml", regex : "(?:[^\\]]|\\](?!\\]>))+"}
            ],

            comment : [
                {token : "comment.xml", regex : "-->", next : "start"},
                {defaultToken : "comment.xml"}
            ],

            reference : [{
                token : "constant.language.escape.reference.xml",
                regex : "(?:&#[0-9]+;)|(?:&#x[0-9a-fA-F]+;)|(?:&[a-zA-Z0-9_:\\.-]+;)"
            }],

            attr_reference : [{
                token : "constant.language.escape.reference.attribute-value.xml",
                regex : "(?:&#[0-9]+;)|(?:&#x[0-9a-fA-F]+;)|(?:&[a-zA-Z0-9_:\\.-]+;)"
            }],

            tag : [{
                token : ["meta.tag.punctuation.tag-open.xml", "meta.tag.punctuation.end-tag-open.xml", "meta.tag.tag-name.xml"],
                regex : `(?:(<)|(</))((?:${tagRegex}:)?${tagRegex})`,
                next: [
                    {include : "attributes"},
                    {token : "meta.tag.punctuation.tag-close.xml", regex : "/?>", next : "start"}
                ]
            }],

            tag_whitespace : [
                {token : "text.tag-whitespace.xml", regex : "\\s+"}
            ],
            whitespace : [
                {token : "text.whitespace.xml", regex : "\\s+"}
            ],
            string: [{
                token : "string.xml",
                regex : "'",
                push : [
                    {token : "string.xml", regex: "'", next: "pop"},
                    {defaultToken : "string.xml"}
                ]
            }, {
                token : "string.xml",
                regex : '"',
                push : [
                    {token : "string.xml", regex: '"', next: "pop"},
                    {defaultToken : "string.xml"}
                ]
            }],

            attributes: [{
                token : "entity.other.attribute-name.xml",
                regex : `(?:${tagRegex}:)?${tagRegex}`
            }, {
                token : "keyword.operator.attribute-equals.xml",
                regex : "="
            }, {
                include: "tag_whitespace"
            }, {
                include: "attribute_value"
            }],

            attribute_value: [{
                token : "string.attribute-value.xml",
                regex : "'",
                push : [
                    {token : "string.attribute-value.xml", regex: "'", next: "pop"},
                    {include : "attr_reference"},
                    {defaultToken : "string.attribute-value.xml"}
                ]
            }, {
                token : "string.attribute-value.xml",
                regex : '"',
                push : [
                    {token : "string.attribute-value.xml", regex: '"', next: "pop"},
                    {include : "attr_reference"},
                    {defaultToken : "string.attribute-value.xml"}
                ]
            }]
        };

        if (this.constructor === XmlHighlightRules)
            this.normalizeRules();
    };


    (function() {

        this.embedTagRules = function(HighlightRules, prefix, tag){
            this.$rules.tag.unshift({
                token : ["meta.tag.punctuation.tag-open.xml", `meta.tag.${tag}.tag-name.xml`],
                regex : `(<)(${tag}(?=\\s|>|$))`,
                next: [
                    {include : "attributes"},
                    {token : "meta.tag.punctuation.tag-close.xml", regex : "/?>", next : `${prefix}start`}
                ]
            });

            this.$rules[`${tag}-end`] = [
                {include : "attributes"},
                {token : "meta.tag.punctuation.tag-close.xml", regex : "/?>",  next: "start",
                    onMatch(value, currentState, stack) {
                        stack.splice(0);
                        return this.token;
                }}
            ]

            this.embedRules(HighlightRules, prefix, [{
                token: ["meta.tag.punctuation.end-tag-open.xml", `meta.tag.${tag}.tag-name.xml`],
                regex : `(</)(${tag}(?=\\s|>|$))`,
                next: `${tag}-end`
            }, {
                token: "string.cdata.xml",
                regex : "<\\!\\[CDATA\\["
            }, {
                token: "string.cdata.xml",
                regex : "\\]\\]>"
            }]);
        };

    }).call(TextHighlightRules.prototype);

    oop.inherits(XmlHighlightRules, TextHighlightRules);

    exports.XmlHighlightRules = XmlHighlightRules;
});

ace.define("ace/mode/behaviour/xml",["require","exports","module","ace/lib/oop","ace/mode/behaviour","ace/token_iterator","ace/lib/lang"], (require, exports, module) => {
    const oop = require("../../lib/oop");
    const Behaviour = require("../behaviour").Behaviour;
    const TokenIterator = require("../../token_iterator").TokenIterator;
    const lang = require("../../lib/lang");

    function is(token, type) {
        return token.type.lastIndexOf(`${type}.xml`) > -1;
    }

    const XmlBehaviour = function () {

        this.add("string_dquotes", "insertion", (state, action, editor, session, text) => {
            if (text == '"' || text == "'") {
                const quote = text;
                const selected = session.doc.getTextRange(editor.getSelectionRange());
                if (selected !== "" && selected !== "'" && selected != '"' && editor.getWrapBehavioursEnabled()) {
                    return {
                        text: quote + selected + quote,
                        selection: false
                    };
                }

                const cursor = editor.getCursorPosition();
                const line = session.doc.getLine(cursor.row);
                const rightChar = line.substring(cursor.column, cursor.column + 1);
                const iterator = new TokenIterator(session, cursor.row, cursor.column);
                let token = iterator.getCurrentToken();

                if (rightChar == quote && (is(token, "attribute-value") || is(token, "string"))) {
                    return {
                        text: "",
                        selection: [1, 1]
                    };
                }

                if (!token)
                    token = iterator.stepBackward();

                if (!token)
                    return;

                while (is(token, "tag-whitespace") || is(token, "whitespace")) {
                    token = iterator.stepBackward();
                }
                const rightSpace = !rightChar || rightChar.match(/\s/);
                if (is(token, "attribute-equals") && (rightSpace || rightChar == '>') || (is(token, "decl-attribute-equals") && (rightSpace || rightChar == '?'))) {
                    return {
                        text: quote + quote,
                        selection: [1, 1]
                    };
                }
            }
        });

        this.add("string_dquotes", "deletion", (state, action, editor, session, range) => {
            const selected = session.doc.getTextRange(range);
            if (!range.isMultiLine() && (selected == '"' || selected == "'")) {
                const line = session.doc.getLine(range.start.row);
                const rightChar = line.substring(range.start.column + 1, range.start.column + 2);
                if (rightChar == selected) {
                    range.end.column++;
                    return range;
                }
            }
        });

        this.add("autoclosing", "insertion", function (state, action, editor, session, text) {
            if (text == '>') {
                const position = editor.getSelectionRange().start;
                const iterator = new TokenIterator(session, position.row, position.column);
                let token = iterator.getCurrentToken() || iterator.stepBackward();
                if (!token || !(is(token, "tag-name") || is(token, "tag-whitespace") || is(token, "attribute-name") || is(token, "attribute-equals") || is(token, "attribute-value")))
                    return;
                if (is(token, "reference.attribute-value"))
                    return;
                if (is(token, "attribute-value")) {
                    const firstChar = token.value.charAt(0);
                    if (firstChar == '"' || firstChar == "'") {
                        const lastChar = token.value.charAt(token.value.length - 1);
                        const tokenEnd = iterator.getCurrentTokenColumn() + token.value.length;
                        if (tokenEnd > position.column || tokenEnd == position.column && firstChar != lastChar)
                            return;
                    }
                }
                while (!is(token, "tag-name")) {
                    token = iterator.stepBackward();
                    if (token.value == "<") {
                        token = iterator.stepForward();
                        break;
                    }
                }

                const tokenRow = iterator.getCurrentTokenRow();
                const tokenColumn = iterator.getCurrentTokenColumn();
                if (is(iterator.stepBackward(), "end-tag-open"))
                    return;

                let element = token.value;
                if (tokenRow == position.row)
                    element = element.substring(0, position.column - tokenColumn);

                if (this.voidElements.hasOwnProperty(element.toLowerCase()))
                     return;

                return {
                   text: `></${element}>`,
                   selection: [1, 1]
                };
            }
        });

        this.add("autoindent", "insertion", function (state, action, editor, session, text) {
            if (text == "\n") {
                const cursor = editor.getCursorPosition();
                var line = session.getLine(cursor.row);
                const iterator = new TokenIterator(session, cursor.row, cursor.column);
                let token = iterator.getCurrentToken();

                if (token && token.type.includes("tag-close")) {
                    if (token.value == "/>")
                        return;
                    while (token && !token.type.includes("tag-name")) {
                        token = iterator.stepBackward();
                    }

                    if (!token) {
                        return;
                    }

                    const tag = token.value;
                    const row = iterator.getCurrentTokenRow();
                    token = iterator.stepBackward();
                    if (!token || token.type.includes("end-tag")) {
                        return;
                    }

                    if (this.voidElements && !this.voidElements[tag]) {
                        const nextToken = session.getTokenAt(cursor.row, cursor.column+1);
                        var line = session.getLine(row);
                        const nextIndent = this.$getIndent(line);
                        const indent = nextIndent + session.getTabString();

                        if (nextToken && nextToken.value === "</") {
                            return {
                                text: `\n${indent}\n${nextIndent}`,
                                selection: [1, indent.length, 1, indent.length]
                            };
                        } else {
                            return {
                                text: `\n${indent}`
                            };
                        }
                    }
                }
            }
        });

    };

    oop.inherits(XmlBehaviour, Behaviour);

    exports.XmlBehaviour = XmlBehaviour;
});

ace.define("ace/mode/folding/xml",["require","exports","module","ace/lib/oop","ace/lib/lang","ace/range","ace/mode/folding/fold_mode","ace/token_iterator"], (require, exports, module) => {
    const oop = require("../../lib/oop");
    const lang = require("../../lib/lang");
    const Range = require("../../range").Range;
    const BaseFoldMode = require("./fold_mode").FoldMode;
    const TokenIterator = require("../../token_iterator").TokenIterator;

    const FoldMode = exports.FoldMode = function(voidElements, optionalEndTags) {
        BaseFoldMode.call(this);
        this.voidElements = voidElements || {};
        this.optionalEndTags = oop.mixin({}, this.voidElements);
        if (optionalEndTags)
            oop.mixin(this.optionalEndTags, optionalEndTags);
        
    };
    oop.inherits(FoldMode, BaseFoldMode);

    const Tag = function() {
        this.tagName = "";
        this.closing = false;
        this.selfClosing = false;
        this.start = {row: 0, column: 0};
        this.end = {row: 0, column: 0};
    };

    function is(token, type) {
        return token.type.lastIndexOf(`${type}.xml`) > -1;
    }

    (function() {

        this.getFoldWidget = function(session, foldStyle, row) {
            const tag = this._getFirstTagInLine(session, row);

            if (!tag)
                return "";

            if (tag.closing || (!tag.tagName && tag.selfClosing))
                return foldStyle == "markbeginend" ? "end" : "";

            if (!tag.tagName || tag.selfClosing || this.voidElements.hasOwnProperty(tag.tagName.toLowerCase()))
                return "";

            if (this._findEndTagInLine(session, row, tag.tagName, tag.end.column))
                return "";

            return "start";
        };
        this._getFirstTagInLine = (session, row) => {
            const tokens = session.getTokens(row);
            const tag = new Tag();

            for (let i = 0; i < tokens.length; i++) {
                let token = tokens[i];
                if (is(token, "tag-open")) {
                    tag.end.column = tag.start.column + token.value.length;
                    tag.closing = is(token, "end-tag-open");
                    token = tokens[++i];
                    if (!token)
                        return null;
                    tag.tagName = token.value;
                    tag.end.column += token.value.length;
                    for (i++; i < tokens.length; i++) {
                        token = tokens[i];
                        tag.end.column += token.value.length;
                        if (is(token, "tag-close")) {
                            tag.selfClosing = token.value == '/>';
                            break;
                        }
                    }
                    return tag;
                } else if (is(token, "tag-close")) {
                    tag.selfClosing = token.value == '/>';
                    return tag;
                }
                tag.start.column += token.value.length;
            }

            return null;
        };

        this._findEndTagInLine = (session, row, tagName, startColumn) => {
            const tokens = session.getTokens(row);
            let column = 0;
            for (let i = 0; i < tokens.length; i++) {
                let token = tokens[i];
                column += token.value.length;
                if (column < startColumn)
                    continue;
                if (is(token, "end-tag-open")) {
                    token = tokens[i + 1];
                    if (token && token.value == tagName)
                        return true;
                }
            }
            return false;
        };
        this._readTagForward = iterator => {
            let token = iterator.getCurrentToken();
            if (!token)
                return null;

            const tag = new Tag();
            do {
                if (is(token, "tag-open")) {
                    tag.closing = is(token, "end-tag-open");
                    tag.start.row = iterator.getCurrentTokenRow();
                    tag.start.column = iterator.getCurrentTokenColumn();
                } else if (is(token, "tag-name")) {
                    tag.tagName = token.value;
                } else if (is(token, "tag-close")) {
                    tag.selfClosing = token.value == "/>";
                    tag.end.row = iterator.getCurrentTokenRow();
                    tag.end.column = iterator.getCurrentTokenColumn() + token.value.length;
                    iterator.stepForward();
                    return tag;
                }
            } while(token = iterator.stepForward());

            return null;
        };
        
        this._readTagBackward = iterator => {
            let token = iterator.getCurrentToken();
            if (!token)
                return null;

            const tag = new Tag();
            do {
                if (is(token, "tag-open")) {
                    tag.closing = is(token, "end-tag-open");
                    tag.start.row = iterator.getCurrentTokenRow();
                    tag.start.column = iterator.getCurrentTokenColumn();
                    iterator.stepBackward();
                    return tag;
                } else if (is(token, "tag-name")) {
                    tag.tagName = token.value;
                } else if (is(token, "tag-close")) {
                    tag.selfClosing = token.value == "/>";
                    tag.end.row = iterator.getCurrentTokenRow();
                    tag.end.column = iterator.getCurrentTokenColumn() + token.value.length;
                }
            } while(token = iterator.stepBackward());

            return null;
        };
        
        this._pop = function(stack, tag) {
            while (stack.length) {
                
                const top = stack[stack.length-1];
                if (!tag || top.tagName == tag.tagName) {
                    return stack.pop();
                }
                else if (this.optionalEndTags.hasOwnProperty(top.tagName)) {
                    stack.pop();
                    continue;
                } else {
                    return null;
                }
            }
        };
        
        this.getFoldWidgetRange = function(session, foldStyle, row) {
            const firstTag = this._getFirstTagInLine(session, row);
            
            if (!firstTag)
                return null;
            
            const isBackward = firstTag.closing || firstTag.selfClosing;
            const stack = [];
            let tag;
            
            if (!isBackward) {
                var iterator = new TokenIterator(session, row, firstTag.start.column);
                const start = {
                    row,
                    column: firstTag.start.column + firstTag.tagName.length + 2
                };
                if (firstTag.start.row == firstTag.end.row)
                    start.column = firstTag.end.column;
                while (tag = this._readTagForward(iterator)) {
                    if (tag.selfClosing) {
                        if (!stack.length) {
                            tag.start.column += tag.tagName.length + 2;
                            tag.end.column -= 2;
                            return Range.fromPoints(tag.start, tag.end);
                        } else
                            continue;
                    }
                    
                    if (tag.closing) {
                        this._pop(stack, tag);
                        if (stack.length == 0)
                            return Range.fromPoints(start, tag.start);
                    }
                    else {
                        stack.push(tag);
                    }
                }
            }
            else {
                var iterator = new TokenIterator(session, row, firstTag.end.column);
                const end = {
                    row,
                    column: firstTag.start.column
                };
                
                while (tag = this._readTagBackward(iterator)) {
                    if (tag.selfClosing) {
                        if (!stack.length) {
                            tag.start.column += tag.tagName.length + 2;
                            tag.end.column -= 2;
                            return Range.fromPoints(tag.start, tag.end);
                        } else
                            continue;
                    }
                    
                    if (!tag.closing) {
                        this._pop(stack, tag);
                        if (stack.length == 0) {
                            tag.start.column += tag.tagName.length + 2;
                            if (tag.start.row == tag.end.row && tag.start.column < tag.end.column)
                                tag.start.column = tag.end.column;
                            return Range.fromPoints(tag.start, end);
                        }
                    }
                    else {
                        stack.push(tag);
                    }
                }
            }
            
        };

    }).call(FoldMode.prototype);
});

ace.define("ace/mode/xml",["require","exports","module","ace/lib/oop","ace/lib/lang","ace/mode/text","ace/mode/xml_highlight_rules","ace/mode/behaviour/xml","ace/mode/folding/xml","ace/worker/worker_client"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const lang = require("../lib/lang");
    const TextMode = require("./text").Mode;
    const XmlHighlightRules = require("./xml_highlight_rules").XmlHighlightRules;
    const XmlBehaviour = require("./behaviour/xml").XmlBehaviour;
    const XmlFoldMode = require("./folding/xml").FoldMode;
    const WorkerClient = require("../worker/worker_client").WorkerClient;

    const Mode = function() {
       this.HighlightRules = XmlHighlightRules;
       this.$behaviour = new XmlBehaviour();
       this.foldingRules = new XmlFoldMode();
    };

    oop.inherits(Mode, TextMode);

    (function() {

        this.voidElements = lang.arrayToMap([]);

        this.blockComment = {start: "<!--", end: "-->"};

        this.createWorker = session => {
            const worker = new WorkerClient(["ace"], "ace/mode/xml_worker", "Worker");
            worker.attachToDocument(session.getDocument());

            worker.on("error", e => {
                session.setAnnotations(e.data);
            });

            worker.on("terminate", () => {
                session.clearAnnotations();
            });

            return worker;
        };
        
        this.$id = "ace/mode/xml";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});
