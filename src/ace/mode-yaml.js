ace.define("ace/mode/yaml_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    const YamlHighlightRules = function() {
        this.$rules = {
            "start" : [
                {
                    token : "comment",
                    regex : "#.*$"
                }, {
                    token : "list.markup",
                    regex : /^(?:-{3}|\.{3})\s*(?=#|$)/     
                },  {
                    token : "list.markup",
                    regex : /^\s*[\-?](?:$|\s)/     
                }, {
                    token: "constant",
                    regex: "!![\\w//]+"
                }, {
                    token: "constant.language",
                    regex: "[&\\*][a-zA-Z0-9-_]+"
                }, {
                    token: ["meta.tag", "keyword"],
                    regex: /^(\s*\w.*?)(:(?:\s+|$))/
                },{
                    token: ["meta.tag", "keyword"],
                    regex: /(\w+?)(\s*:(?:\s+|$))/
                }, {
                    token : "keyword.operator",
                    regex : "<<\\w*:\\w*"
                }, {
                    token : "keyword.operator",
                    regex : "-\\s*(?=[{])"
                }, {
                    token : "string", // single line
                    regex : '["](?:(?:\\\\.)|(?:[^"\\\\]))*?["]'
                }, {
                    token : "string", // multi line string start
                    regex : '[|>][-+\\d\\s]*$',
                    next : "qqstring"
                }, {
                    token : "string", // single quoted string
                    regex : "['](?:(?:\\\\.)|(?:[^'\\\\]))*?[']"
                }, {
                    token : "constant.numeric", // float
                    regex : /(\b|[+\-\.])[\d_]+(?:(?:\.[\d_]*)?(?:[eE][+\-]?[\d_]+)?)/
                }, {
                    token : "constant.numeric", // other number
                    regex : /[+\-]?\.inf\b|NaN\b|0x[\dA-Fa-f_]+|0b[10_]+/
                }, {
                    token : "constant.language.boolean",
                    regex : "\\b(?:true|false|TRUE|FALSE|True|False|yes|no)\\b"
                }, {
                    token : "paren.lparen",
                    regex : "[[({]"
                }, {
                    token : "paren.rparen",
                    regex : "[\\])}]"
                }
            ],
            "qqstring" : [
                {
                    token : "string",
                    regex : '(?=(?:(?:\\\\.)|(?:[^:]))*?:)',
                    next : "start"
                }, {
                    token : "string",
                    regex : '.+'
                }
            ]};

    };

    oop.inherits(YamlHighlightRules, TextHighlightRules);

    exports.YamlHighlightRules = YamlHighlightRules;
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

ace.define("ace/mode/yaml",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/yaml_highlight_rules","ace/mode/matching_brace_outdent","ace/mode/folding/coffee"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextMode = require("./text").Mode;
    const YamlHighlightRules = require("./yaml_highlight_rules").YamlHighlightRules;
    const MatchingBraceOutdent = require("./matching_brace_outdent").MatchingBraceOutdent;
    const FoldMode = require("./folding/coffee").FoldMode;

    const Mode = function() {
        this.HighlightRules = YamlHighlightRules;
        this.$outdent = new MatchingBraceOutdent();
        this.foldingRules = new FoldMode();
    };
    oop.inherits(Mode, TextMode);

    (function() {

        this.lineCommentStart = "#";
        
        this.getNextLineIndent = function(state, line, tab) {
            let indent = this.$getIndent(line);

            if (state == "start") {
                const match = line.match(/^.*[\{\(\[]\s*$/);
                if (match) {
                    indent += tab;
                }
            }

            return indent;
        };

        this.checkOutdent = function(state, line, input) {
            return this.$outdent.checkOutdent(line, input);
        };

        this.autoOutdent = function(state, doc, row) {
            this.$outdent.autoOutdent(doc, row);
        };


        this.$id = "ace/mode/yaml";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});
