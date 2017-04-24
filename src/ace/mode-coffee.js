ace.define("ace/mode/coffee_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    oop.inherits(CoffeeHighlightRules, TextHighlightRules);

    function CoffeeHighlightRules() {
        const identifier = "[$A-Za-z_\\x7f-\\uffff][$\\w\\x7f-\\uffff]*";

        const keywords = (
            "this|throw|then|try|typeof|super|switch|return|break|by|continue|" +
            "catch|class|in|instanceof|is|isnt|if|else|extends|for|own|" +
            "finally|function|while|when|new|no|not|delete|debugger|do|loop|of|off|" +
            "or|on|unless|until|and|yes"
        );

        const langConstant = (
            "true|false|null|undefined|NaN|Infinity"
        );

        const illegal = (
            "case|const|default|function|var|void|with|enum|export|implements|" +
            "interface|let|package|private|protected|public|static|yield"
        );

        const supportClass = (
            "Array|Boolean|Date|Function|Number|Object|RegExp|ReferenceError|String|" +
            "Error|EvalError|InternalError|RangeError|ReferenceError|StopIteration|" +
            "SyntaxError|TypeError|URIError|"  +
            "ArrayBuffer|Float32Array|Float64Array|Int16Array|Int32Array|Int8Array|" +
            "Uint16Array|Uint32Array|Uint8Array|Uint8ClampedArray"
        );

        const supportFunction = (
            "Math|JSON|isNaN|isFinite|parseInt|parseFloat|encodeURI|" +
            "encodeURIComponent|decodeURI|decodeURIComponent|String|"
        );

        const variableLanguage = (
            "window|arguments|prototype|document"
        );

        const keywordMapper = this.createKeywordMapper({
            "keyword": keywords,
            "constant.language": langConstant,
            "invalid.illegal": illegal,
            "language.support.class": supportClass,
            "language.support.function": supportFunction,
            "variable.language": variableLanguage
        }, "identifier");

        const functionRule = {
            token: ["paren.lparen", "variable.parameter", "paren.rparen", "text", "storage.type"],
            regex: /(?:(\()((?:"[^")]*?"|'[^')]*?'|\/[^\/)]*?\/|[^()"'\/])*?)(\))(\s*))?([\-=]>)/.source
        };

        const stringEscape = /\\(?:x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|[0-2][0-7]{0,2}|3[0-6][0-7]?|37[0-7]?|[4-7][0-7]?|.)/;

        this.$rules = {
            start : [
                {
                    token : "constant.numeric",
                    regex : "(?:0x[\\da-fA-F]+|(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:[eE][+-]?\\d+)?)"
                }, {
                    stateName: "qdoc",
                    token : "string", regex : "'''", next : [
                        {token : "string", regex : "'''", next : "start"},
                        {token : "constant.language.escape", regex : stringEscape},
                        {defaultToken: "string"}
                    ]
                }, {
                    stateName: "qqdoc",
                    token : "string",
                    regex : '"""',
                    next : [
                        {token : "string", regex : '"""', next : "start"},
                        {token : "paren.string", regex : '#{', push : "start"},
                        {token : "constant.language.escape", regex : stringEscape},
                        {defaultToken: "string"}
                    ]
                }, {
                    stateName: "qstring",
                    token : "string", regex : "'", next : [
                        {token : "string", regex : "'", next : "start"},
                        {token : "constant.language.escape", regex : stringEscape},
                        {defaultToken: "string"}
                    ]
                }, {
                    stateName: "qqstring",
                    token : "string.start", regex : '"', next : [
                        {token : "string.end", regex : '"', next : "start"},
                        {token : "paren.string", regex : '#{', push : "start"},
                        {token : "constant.language.escape", regex : stringEscape},
                        {defaultToken: "string"}
                    ]
                }, {
                    stateName: "js",
                    token : "string", regex : "`", next : [
                        {token : "string", regex : "`", next : "start"},
                        {token : "constant.language.escape", regex : stringEscape},
                        {defaultToken: "string"}
                    ]
                }, {
                    regex: "[{}]", onMatch(val, state, stack) {
                        this.next = "";
                        if (val == "{" && stack.length) {
                            stack.unshift("start", state);
                            return "paren";
                        }
                        if (val == "}" && stack.length) {
                            stack.shift();
                            this.next = stack.shift() || "";
                            if (this.next.includes("string"))
                                return "paren.string";
                        }
                        return "paren";
                    }
                }, {
                    token : "string.regex",
                    regex : "///",
                    next : "heregex"
                }, {
                    token : "string.regex",
                    regex : /(?:\/(?![\s=])[^[\/\n\\]*(?:(?:\\[\s\S]|\[[^\]\n\\]*(?:\\[\s\S][^\]\n\\]*)*])[^[\/\n\\]*)*\/)(?:[imgy]{0,4})(?!\w)/
                }, {
                    token : "comment",
                    regex : "###(?!#)",
                    next : "comment"
                }, {
                    token : "comment",
                    regex : "#.*"
                }, {
                    token : ["punctuation.operator", "text", "identifier"],
                    regex : `(\\.)(\\s*)(${illegal})`
                }, {
                    token : "punctuation.operator",
                    regex : "\\.{1,3}"
                }, {
                    token : ["keyword", "text", "language.support.class",
                     "text", "keyword", "text", "language.support.class"],
                    regex : `(class)(\\s+)(${identifier})(?:(\\s+)(extends)(\\s+)(${identifier}))?`
                }, {
                    token : ["entity.name.function", "text", "keyword.operator", "text"].concat(functionRule.token),
                    regex : `(${identifier})(\\s*)([=:])(\\s*)${functionRule.regex}`
                }, 
                functionRule, 
                {
                    token : "variable",
                    regex : `@(?:${identifier})?`
                }, {
                    token: keywordMapper,
                    regex : identifier
                }, {
                    token : "punctuation.operator",
                    regex : "\\,|\\."
                }, {
                    token : "storage.type",
                    regex : "[\\-=]>"
                }, {
                    token : "keyword.operator",
                    regex : "(?:[-+*/%<>&|^!?=]=|>>>=?|\\-\\-|\\+\\+|::|&&=|\\|\\|=|<<=|>>=|\\?\\.|\\.{2,3}|[!*+-=><])"
                }, {
                    token : "paren.lparen",
                    regex : "[({[]"
                }, {
                    token : "paren.rparen",
                    regex : "[\\]})]"
                }, {
                    token : "text",
                    regex : "\\s+"
                }],


            heregex : [{
                token : "string.regex",
                regex : '.*?///[imgy]{0,4}',
                next : "start"
            }, {
                token : "comment.regex",
                regex : "\\s+(?:#.*)?"
            }, {
                token : "string.regex",
                regex : "\\S+"
            }],

            comment : [{
                token : "comment",
                regex : '###',
                next : "start"
            }, {
                defaultToken : "comment"
            }]
        };
        this.normalizeRules();
    }

    exports.CoffeeHighlightRules = CoffeeHighlightRules;
});

ace.define("ace/mode/matching_brace_outdent",["require","exports","module","ace/range"], (require, exports, module) => {
    const Range = require("../range").Range;

    const MatchingBraceOutdent = () => {};

    (function() {

        this.checkOutdent = (line, input) => {
            if (! /^\s+$/.test(line))
                return false;

            return /^\s*\}/.test(input);
        };

        this.autoOutdent = function(doc, row) {
            const line = doc.getLine(row);
            const match = line.match(/^(\s*\})/);

            if (!match) return 0;

            const column = match[1].length;
            const openBracePos = doc.findMatchingBracket({row, column});

            if (!openBracePos || openBracePos.row == row) return 0;

            const indent = this.$getIndent(doc.getLine(openBracePos.row));
            doc.replace(new Range(row, 0, row, column-1), indent);
        };

        this.$getIndent = line => line.match(/^\s*/)[0];

    }).call(MatchingBraceOutdent.prototype);

    exports.MatchingBraceOutdent = MatchingBraceOutdent;
});

ace.define("ace/mode/folding/coffee",["require","exports","module","ace/lib/oop","ace/mode/folding/fold_mode","ace/range"], (require, exports, module) => {
    const oop = require("../../lib/oop");
    const BaseFoldMode = require("./fold_mode").FoldMode;
    const Range = require("../../range").Range;

    const FoldMode = exports.FoldMode = () => {};
    oop.inherits(FoldMode, BaseFoldMode);

    (function() {

        this.getFoldWidgetRange = function(session, foldStyle, row) {
            const range = this.indentationBlock(session, row);
            if (range)
                return range;

            const re = /\S/;
            let line = session.getLine(row);
            const startLevel = line.search(re);
            if (startLevel == -1 || line[startLevel] != "#")
                return;

            const startColumn = line.length;
            const maxRow = session.getLength();
            const startRow = row;
            let endRow = row;

            while (++row < maxRow) {
                line = session.getLine(row);
                const level = line.search(re);

                if (level == -1)
                    continue;

                if (line[level] != "#")
                    break;

                endRow = row;
            }

            if (endRow > startRow) {
                const endColumn = session.getLine(endRow).length;
                return new Range(startRow, startColumn, endRow, endColumn);
            }
        };
        this.getFoldWidget = (session, foldStyle, row) => {
            const line = session.getLine(row);
            const indent = line.search(/\S/);
            const next = session.getLine(row + 1);
            const prev = session.getLine(row - 1);
            const prevIndent = prev.search(/\S/);
            const nextIndent = next.search(/\S/);

            if (indent == -1) {
                session.foldWidgets[row - 1] = prevIndent!= -1 && prevIndent < nextIndent ? "start" : "";
                return "";
            }
            if (prevIndent == -1) {
                if (indent == nextIndent && line[indent] == "#" && next[indent] == "#") {
                    session.foldWidgets[row - 1] = "";
                    session.foldWidgets[row + 1] = "";
                    return "start";
                }
            } else if (prevIndent == indent && line[indent] == "#" && prev[indent] == "#") {
                if (session.getLine(row - 2).search(/\S/) == -1) {
                    session.foldWidgets[row - 1] = "start";
                    session.foldWidgets[row + 1] = "";
                    return "";
                }
            }

            if (prevIndent!= -1 && prevIndent < indent)
                session.foldWidgets[row - 1] = "start";
            else
                session.foldWidgets[row - 1] = "";

            if (indent < nextIndent)
                return "start";
            else
                return "";
        };

    }).call(FoldMode.prototype);
});

ace.define("ace/mode/coffee",["require","exports","module","ace/mode/coffee_highlight_rules","ace/mode/matching_brace_outdent","ace/mode/folding/coffee","ace/range","ace/mode/text","ace/worker/worker_client","ace/lib/oop"], (require, exports, module) => {
    const Rules = require("./coffee_highlight_rules").CoffeeHighlightRules;
    const Outdent = require("./matching_brace_outdent").MatchingBraceOutdent;
    const FoldMode = require("./folding/coffee").FoldMode;
    const Range = require("../range").Range;
    const TextMode = require("./text").Mode;
    const WorkerClient = require("../worker/worker_client").WorkerClient;
    const oop = require("../lib/oop");

    function Mode() {
        this.HighlightRules = Rules;
        this.$outdent = new Outdent();
        this.foldingRules = new FoldMode();
    }

    oop.inherits(Mode, TextMode);

    (function() {
        const indenter = /(?:[({[=:]|[-=]>|\b(?:else|try|(?:swi|ca)tch(?:\s+[$A-Za-z_\x7f-\uffff][$\w\x7f-\uffff]*)?|finally))\s*$|^\s*(else\b\s*)?(?:if|for|while|loop)\b(?!.*\bthen\b)/;
        
        this.lineCommentStart = "#";
        this.blockComment = {start: "###", end: "###"};
        
        this.getNextLineIndent = function(state, line, tab) {
            let indent = this.$getIndent(line);
            const tokens = this.getTokenizer().getLineTokens(line, state).tokens;
        
            if (!(tokens.length && tokens[tokens.length - 1].type === 'comment') &&
                state === 'start' && indenter.test(line))
                indent += tab;
            return indent;
        };
        
        this.checkOutdent = function(state, line, input) {
            return this.$outdent.checkOutdent(line, input);
        };
        
        this.autoOutdent = function(state, doc, row) {
            this.$outdent.autoOutdent(doc, row);
        };
        
        this.createWorker = session => {
            const worker = new WorkerClient(["ace"], "ace/mode/coffee_worker", "Worker");
            worker.attachToDocument(session.getDocument());
            
            worker.on("annotate", e => {
                session.setAnnotations(e.data);
            });
            
            worker.on("terminate", () => {
                session.clearAnnotations();
            });
            
            return worker;
        };

        this.$id = "ace/mode/coffee";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});
