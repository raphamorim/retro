ace.define("ace/mode/latex_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    const LatexHighlightRules = function() {  

        this.$rules = {
            "start" : [{
                token : "comment",
                regex : "%.*$"
            }, {
                token : ["keyword", "lparen", "variable.parameter", "rparen", "lparen", "storage.type", "rparen"],
                regex : "(\\\\(?:documentclass|usepackage|input))(?:(\\[)([^\\]]*)(\\]))?({)([^}]*)(})"
            }, {
                token : ["keyword","lparen", "variable.parameter", "rparen"],
                regex : "(\\\\(?:label|v?ref|cite(?:[^{]*)))(?:({)([^}]*)(}))?"
            }, {
                token : ["storage.type", "lparen", "variable.parameter", "rparen"],
                regex : "(\\\\(?:begin|end))({)(\\w*)(})"
            }, {
                token : "storage.type",
                regex : "\\\\[a-zA-Z]+"
            }, {
                token : "lparen",
                regex : "[[({]"
            }, {
                token : "rparen",
                regex : "[\\])}]"
            }, {
                token : "constant.character.escape",
                regex : "\\\\[^a-zA-Z]?"
            }, {
                token : "string",
                regex : "\\${1,2}",
                next  : "equation"
            }],
            "equation" : [{
                token : "comment",
                regex : "%.*$"
            }, {
                token : "string",
                regex : "\\${1,2}",
                next  : "start"
            }, {
                token : "constant.character.escape",
                regex : "\\\\(?:[^a-zA-Z]|[a-zA-Z]+)"
            }, {
                token : "error", 
                regex : "^\\s*$", 
                next : "start" 
            }, {
                defaultToken : "string"
            }]

        };
    };
    oop.inherits(LatexHighlightRules, TextHighlightRules);

    exports.LatexHighlightRules = LatexHighlightRules;
});

ace.define("ace/mode/folding/latex",["require","exports","module","ace/lib/oop","ace/mode/folding/fold_mode","ace/range","ace/token_iterator"], (require, exports, module) => {
    const oop = require("../../lib/oop");
    const BaseFoldMode = require("./fold_mode").FoldMode;
    const Range = require("../../range").Range;
    const TokenIterator = require("../../token_iterator").TokenIterator;

    const FoldMode = exports.FoldMode = () => {};

    oop.inherits(FoldMode, BaseFoldMode);

    (function() {

        this.foldingStartMarker = /^\s*\\(begin)|(section|subsection|paragraph)\b|{\s*$/;
        this.foldingStopMarker = /^\s*\\(end)\b|^\s*}/;

        this.getFoldWidgetRange = function(session, foldStyle, row) {
            const line = session.doc.getLine(row);
            var match = this.foldingStartMarker.exec(line);
            if (match) {
                if (match[1])
                    return this.latexBlock(session, row, match[0].length - 1);
                if (match[2])
                    return this.latexSection(session, row, match[0].length - 1);

                return this.openingBracketBlock(session, "{", row, match.index);
            }

            var match = this.foldingStopMarker.exec(line);
            if (match) {
                if (match[1])
                    return this.latexBlock(session, row, match[0].length - 1);

                return this.closingBracketBlock(session, "}", row, match.index + match[0].length);
            }
        };

        this.latexBlock = (session, row, column) => {
            const keywords = {
                "\\begin": 1,
                "\\end": -1
            };

            const stream = new TokenIterator(session, row, column);
            let token = stream.getCurrentToken();
            if (!token || !(token.type == "storage.type" || token.type == "constant.character.escape"))
                return;

            const val = token.value;
            const dir = keywords[val];

            const getType = () => {
                const token = stream.stepForward();
                const type = token.type == "lparen" ?stream.stepForward().value : "";
                if (dir === -1) {
                    stream.stepBackward();
                    if (type)
                        stream.stepBackward();
                }
                return type;
            };
            const stack = [getType()];
            const startColumn = dir === -1 ? stream.getCurrentTokenColumn() : session.getLine(row).length;
            const startRow = row;

            stream.step = dir === -1 ? stream.stepBackward : stream.stepForward;
            while(token = stream.step()) {
                if (!token || !(token.type == "storage.type" || token.type == "constant.character.escape"))
                    continue;
                const level = keywords[token.value];
                if (!level)
                    continue;
                const type = getType();
                if (level === dir)
                    stack.unshift(type);
                else if (stack.shift() !== type || !stack.length)
                    break;
            }

            if (stack.length)
                return;

            var row = stream.getCurrentTokenRow();
            if (dir === -1)
                return new Range(row, session.getLine(row).length, startRow, startColumn);
            stream.stepBackward();
            return new Range(startRow, startColumn, row, stream.getCurrentTokenColumn());
        };

        this.latexSection = (session, row, column) => {
            const keywords = ["\\subsection", "\\section", "\\begin", "\\end", "\\paragraph"];

            const stream = new TokenIterator(session, row, column);
            let token = stream.getCurrentToken();
            if (!token || token.type != "storage.type")
                return;

            const startLevel = keywords.indexOf(token.value);
            let stackDepth = 0;
            let endRow = row;

            while(token = stream.stepForward()) {
                if (token.type !== "storage.type")
                    continue;
                const level = keywords.indexOf(token.value);

                if (level >= 2) {
                    if (!stackDepth)
                        endRow = stream.getCurrentTokenRow() - 1;
                    stackDepth += level == 2 ? 1 : - 1;
                    if (stackDepth < 0)
                        break
                } else if (level >= startLevel)
                    break;
            }

            if (!stackDepth)
                endRow = stream.getCurrentTokenRow() - 1;

            while (endRow > row && !/\S/.test(session.getLine(endRow)))
                endRow--;

            return new Range(
                row, session.getLine(row).length,
                endRow, session.getLine(endRow).length
            );
        };

    }).call(FoldMode.prototype);
});

ace.define("ace/mode/latex",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/latex_highlight_rules","ace/mode/folding/latex","ace/range"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextMode = require("./text").Mode;
    const LatexHighlightRules = require("./latex_highlight_rules").LatexHighlightRules;
    const LatexFoldMode = require("./folding/latex").FoldMode;
    const Range = require("../range").Range;

    const Mode = function() {
        this.HighlightRules = LatexHighlightRules;
        this.foldingRules = new LatexFoldMode();
    };
    oop.inherits(Mode, TextMode);

    (function() {
        this.type = "text";
        
        this.lineCommentStart = "%";

        this.$id = "ace/mode/latex";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});
