ace.define("ace/mode/python_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    const PythonHighlightRules = function() {

        const keywords = (
            "and|as|assert|break|class|continue|def|del|elif|else|except|exec|" +
            "finally|for|from|global|if|import|in|is|lambda|not|or|pass|print|" +
            "raise|return|try|while|with|yield"
        );

        const builtinConstants = (
            "True|False|None|NotImplemented|Ellipsis|__debug__"
        );

        const builtinFunctions = (
            "abs|divmod|input|open|staticmethod|all|enumerate|int|ord|str|any|" +
            "eval|isinstance|pow|sum|basestring|execfile|issubclass|print|super|" +
            "binfile|iter|property|tuple|bool|filter|len|range|type|bytearray|" +
            "float|list|raw_input|unichr|callable|format|locals|reduce|unicode|" +
            "chr|frozenset|long|reload|vars|classmethod|getattr|map|repr|xrange|" +
            "cmp|globals|max|reversed|zip|compile|hasattr|memoryview|round|" +
            "__import__|complex|hash|min|set|apply|delattr|help|next|setattr|" +
            "buffer|dict|hex|object|slice|coerce|dir|id|oct|sorted|intern"
        );
        const keywordMapper = this.createKeywordMapper({
            "invalid.deprecated": "debugger",
            "support.function": builtinFunctions,
            "constant.language": builtinConstants,
            "keyword": keywords
        }, "identifier");

        const strPre = "(?:r|u|ur|R|U|UR|Ur|uR)?";

        const decimalInteger = "(?:(?:[1-9]\\d*)|(?:0))";
        const octInteger = "(?:0[oO]?[0-7]+)";
        const hexInteger = "(?:0[xX][\\dA-Fa-f]+)";
        const binInteger = "(?:0[bB][01]+)";
        const integer = `(?:${decimalInteger}|${octInteger}|${hexInteger}|${binInteger})`;

        const exponent = "(?:[eE][+-]?\\d+)";
        const fraction = "(?:\\.\\d+)";
        const intPart = "(?:\\d+)";
        const pointFloat = `(?:(?:${intPart}?${fraction})|(?:${intPart}\\.))`;
        const exponentFloat = `(?:(?:${pointFloat}|${intPart})${exponent})`;
        const floatNumber = `(?:${exponentFloat}|${pointFloat})`;

        const stringEscape =  "\\\\(x[0-9A-Fa-f]{2}|[0-7]{3}|[\\\\abfnrtv'\"]|U[0-9A-Fa-f]{8}|u[0-9A-Fa-f]{4})";

        this.$rules = {
            "start" : [ {
                token : "comment",
                regex : "#.*$"
            }, {
                token : "string",           // multi line """ string start
                regex : `${strPre}"{3}`,
                next : "qqstring3"
            }, {
                token : "string",           // " string
                regex : `${strPre}"(?=.)`,
                next : "qqstring"
            }, {
                token : "string",           // multi line ''' string start
                regex : `${strPre}'{3}`,
                next : "qstring3"
            }, {
                token : "string",           // ' string
                regex : `${strPre}'(?=.)`,
                next : "qstring"
            }, {
                token : "constant.numeric", // imaginary
                regex : `(?:${floatNumber}|\\d+)[jJ]\\b`
            }, {
                token : "constant.numeric", // float
                regex : floatNumber
            }, {
                token : "constant.numeric", // long integer
                regex : `${integer}[lL]\\b`
            }, {
                token : "constant.numeric", // integer
                regex : `${integer}\\b`
            }, {
                token : keywordMapper,
                regex : "[a-zA-Z_$][a-zA-Z0-9_$]*\\b"
            }, {
                token : "keyword.operator",
                regex : "\\+|\\-|\\*|\\*\\*|\\/|\\/\\/|%|<<|>>|&|\\||\\^|~|<|>|<=|=>|==|!=|<>|="
            }, {
                token : "paren.lparen",
                regex : "[\\[\\(\\{]"
            }, {
                token : "paren.rparen",
                regex : "[\\]\\)\\}]"
            }, {
                token : "text",
                regex : "\\s+"
            } ],
            "qqstring3" : [ {
                token : "constant.language.escape",
                regex : stringEscape
            }, {
                token : "string", // multi line """ string end
                regex : '"{3}',
                next : "start"
            }, {
                defaultToken : "string"
            } ],
            "qstring3" : [ {
                token : "constant.language.escape",
                regex : stringEscape
            }, {
                token : "string",  // multi line ''' string end
                regex : "'{3}",
                next : "start"
            }, {
                defaultToken : "string"
            } ],
            "qqstring" : [{
                token : "constant.language.escape",
                regex : stringEscape
            }, {
                token : "string",
                regex : "\\\\$",
                next  : "qqstring"
            }, {
                token : "string",
                regex : '"|$',
                next  : "start"
            }, {
                defaultToken: "string"
            }],
            "qstring" : [{
                token : "constant.language.escape",
                regex : stringEscape
            }, {
                token : "string",
                regex : "\\\\$",
                next  : "qstring"
            }, {
                token : "string",
                regex : "'|$",
                next  : "start"
            }, {
                defaultToken: "string"
            }]
        };
    };

    oop.inherits(PythonHighlightRules, TextHighlightRules);

    exports.PythonHighlightRules = PythonHighlightRules;
});

ace.define("ace/mode/folding/pythonic",["require","exports","module","ace/lib/oop","ace/mode/folding/fold_mode"], (require, exports, module) => {
    const oop = require("../../lib/oop");
    const BaseFoldMode = require("./fold_mode").FoldMode;

    const FoldMode = exports.FoldMode = function(markers) {
        this.foldingStartMarker = new RegExp(`([\\[{])(?:\\s*)$|(${markers})(?:\\s*)(?:#.*)?$`);
    };
    oop.inherits(FoldMode, BaseFoldMode);

    (function() {

        this.getFoldWidgetRange = function(session, foldStyle, row) {
            const line = session.getLine(row);
            const match = line.match(this.foldingStartMarker);
            if (match) {
                if (match[1])
                    return this.openingBracketBlock(session, match[1], row, match.index);
                if (match[2])
                    return this.indentationBlock(session, row, match.index + match[2].length);
                return this.indentationBlock(session, row);
            }
        }

    }).call(FoldMode.prototype);
});

ace.define("ace/mode/python",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/python_highlight_rules","ace/mode/folding/pythonic","ace/range"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextMode = require("./text").Mode;
    const PythonHighlightRules = require("./python_highlight_rules").PythonHighlightRules;
    const PythonFoldMode = require("./folding/pythonic").FoldMode;
    const Range = require("../range").Range;

    const Mode = function() {
        this.HighlightRules = PythonHighlightRules;
        this.foldingRules = new PythonFoldMode("\\:");
    };
    oop.inherits(Mode, TextMode);

    (function() {

        this.lineCommentStart = "#";

        this.getNextLineIndent = function(state, line, tab) {
            let indent = this.$getIndent(line);

            const tokenizedLine = this.getTokenizer().getLineTokens(line, state);
            const tokens = tokenizedLine.tokens;

            if (tokens.length && tokens[tokens.length-1].type == "comment") {
                return indent;
            }

            if (state == "start") {
                const match = line.match(/^.*[\{\(\[:]\s*$/);
                if (match) {
                    indent += tab;
                }
            }

            return indent;
        };

        const outdents = {
            "pass": 1,
            "return": 1,
            "raise": 1,
            "break": 1,
            "continue": 1
        };
        
        this.checkOutdent = function(state, line, input) {
            if (input !== "\r\n" && input !== "\r" && input !== "\n")
                return false;

            const tokens = this.getTokenizer().getLineTokens(line.trim(), state).tokens;
            
            if (!tokens)
                return false;
            do {
                var last = tokens.pop();
            } while (last && (last.type == "comment" || (last.type == "text" && last.value.match(/^\s+$/))));
            
            if (!last)
                return false;
            
            return (last.type == "keyword" && outdents[last.value]);
        };

        this.autoOutdent = function(state, doc, row) {
            
            row += 1;
            const indent = this.$getIndent(doc.getLine(row));
            const tab = doc.getTabString();
            if (indent.slice(-tab.length) == tab)
                doc.remove(new Range(row, indent.length-tab.length, row, indent.length));
        };

        this.$id = "ace/mode/python";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});
