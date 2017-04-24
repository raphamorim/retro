ace.define("ace/mode/jack_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    const JackHighlightRules = function() {
        this.$rules = {
            "start" : [
                {
                    token : "string",
                    regex : '"',
                    next  : "string2"
                }, {
                    token : "string",
                    regex : "'",
                    next  : "string1"
                }, {
                    token : "constant.numeric", // hex
                    regex: "-?0[xX][0-9a-fA-F]+\\b"
                }, {
                    token : "constant.numeric", // float
                    regex : "(?:0|[-+]?[1-9][0-9]*)\\b"
                }, {
                    token : "constant.binary",
                    regex : "<[0-9A-Fa-f][0-9A-Fa-f](\\s+[0-9A-Fa-f][0-9A-Fa-f])*>"
                }, {
                    token : "constant.language.boolean",
                    regex : "(?:true|false)\\b"
                }, {
                    token : "constant.language.null",
                    regex : "null\\b"
                }, {
                    token : "storage.type",
                    regex: "(?:Integer|Boolean|Null|String|Buffer|Tuple|List|Object|Function|Coroutine|Form)\\b"
                }, {
                    token : "keyword",
                    regex : "(?:return|abort|vars|for|delete|in|is|escape|exec|split|and|if|elif|else|while)\\b"
                }, {
                    token : "language.builtin",
                    regex : "(?:lines|source|parse|read-stream|interval|substr|parseint|write|print|range|rand|inspect|bind|i-values|i-pairs|i-map|i-filter|i-chunk|i-all\\?|i-any\\?|i-collect|i-zip|i-merge|i-each)\\b"
                }, {
                    token : "comment",
                    regex : "--.*$"
                }, {
                    token : "paren.lparen",
                    regex : "[[({]"
                }, {
                    token : "paren.rparen",
                    regex : "[\\])}]"
                }, {
                    token : "storage.form",
                    regex : "@[a-z]+"
                }, {
                    token : "constant.other.symbol",
                    regex : ':+[a-zA-Z_]([-]?[a-zA-Z0-9_])*[?!]?'
                }, {
                    token : "variable",
                    regex : '[a-zA-Z_]([-]?[a-zA-Z0-9_])*[?!]?'
                }, {
                    token : "keyword.operator",
                    regex : "\\|\\||\\^\\^|&&|!=|==|<=|<|>=|>|\\+|-|\\*|\\/|\\^|\\%|\\#|\\!"
                }, {
                    token : "text",
                    regex : "\\s+"
                }
            ],
            "string1" : [
                {
                    token : "constant.language.escape",
                    regex : /\\(?:x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|['"\\\/bfnrt])/
                }, {
                    token : "string",
                    regex : "[^'\\\\]+"
                }, {
                    token : "string",
                    regex : "'",
                    next  : "start"
                }, {
                    token : "string",
                    regex : "",
                    next  : "start"
                }
            ],
            "string2" : [
                {
                    token : "constant.language.escape",
                    regex : /\\(?:x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|['"\\\/bfnrt])/
                }, {
                    token : "string",
                    regex : '[^"\\\\]+'
                }, {
                    token : "string",
                    regex : '"',
                    next  : "start"
                }, {
                    token : "string",
                    regex : "",
                    next  : "start"
                }
            ]
        };
        
    };

    oop.inherits(JackHighlightRules, TextHighlightRules);

    exports.JackHighlightRules = JackHighlightRules;
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

ace.define("ace/mode/folding/cstyle",["require","exports","module","ace/lib/oop","ace/range","ace/mode/folding/fold_mode"], (require, exports, module) => {
    const oop = require("../../lib/oop");
    const Range = require("../../range").Range;
    const BaseFoldMode = require("./fold_mode").FoldMode;

    const FoldMode = exports.FoldMode = function(commentRegex) {
        if (commentRegex) {
            this.foldingStartMarker = new RegExp(
                this.foldingStartMarker.source.replace(/\|[^|]*?$/, `|${commentRegex.start}`)
            );
            this.foldingStopMarker = new RegExp(
                this.foldingStopMarker.source.replace(/\|[^|]*?$/, `|${commentRegex.end}`)
            );
        }
    };
    oop.inherits(FoldMode, BaseFoldMode);

    (function() {
        
        this.foldingStartMarker = /(\{|\[)[^\}\]]*$|^\s*(\/\*)/;
        this.foldingStopMarker = /^[^\[\{]*(\}|\])|^[\s\*]*(\*\/)/;
        this.singleLineBlockCommentRe= /^\s*(\/\*).*\*\/\s*$/;
        this.tripleStarBlockCommentRe = /^\s*(\/\*\*\*).*\*\/\s*$/;
        this.startRegionRe = /^\s*(\/\*|\/\/)#?region\b/;
        this._getFoldWidgetBase = this.getFoldWidget;
        this.getFoldWidget = function(session, foldStyle, row) {
            const line = session.getLine(row);
        
            if (this.singleLineBlockCommentRe.test(line)) {
                if (!this.startRegionRe.test(line) && !this.tripleStarBlockCommentRe.test(line))
                    return "";
            }
        
            const fw = this._getFoldWidgetBase(session, foldStyle, row);
        
            if (!fw && this.startRegionRe.test(line))
                return "start"; // lineCommentRegionStart
        
            return fw;
        };

        this.getFoldWidgetRange = function(session, foldStyle, row, forceMultiline) {
            const line = session.getLine(row);
            
            if (this.startRegionRe.test(line))
                return this.getCommentRegionBlock(session, line, row);
            
            var match = line.match(this.foldingStartMarker);
            if (match) {
                var i = match.index;

                if (match[1])
                    return this.openingBracketBlock(session, match[1], row, i);
                    
                let range = session.getCommentFoldRange(row, i + match[0].length, 1);
                
                if (range && !range.isMultiLine()) {
                    if (forceMultiline) {
                        range = this.getSectionRange(session, row);
                    } else if (foldStyle != "all")
                        range = null;
                }
                
                return range;
            }

            if (foldStyle === "markbegin")
                return;

            var match = line.match(this.foldingStopMarker);
            if (match) {
                var i = match.index + match[0].length;

                if (match[1])
                    return this.closingBracketBlock(session, match[1], row, i);

                return session.getCommentFoldRange(row, i, -1);
            }
        };
        
        this.getSectionRange = function(session, row) {
            let line = session.getLine(row);
            const startIndent = line.search(/\S/);
            const startRow = row;
            const startColumn = line.length;
            row = row + 1;
            let endRow = row;
            const maxRow = session.getLength();
            while (++row < maxRow) {
                line = session.getLine(row);
                const indent = line.search(/\S/);
                if (indent === -1)
                    continue;
                if  (startIndent > indent)
                    break;
                const subRange = this.getFoldWidgetRange(session, "all", row);
                
                if (subRange) {
                    if (subRange.start.row <= startRow) {
                        break;
                    } else if (subRange.isMultiLine()) {
                        row = subRange.end.row;
                    } else if (startIndent == indent) {
                        break;
                    }
                }
                endRow = row;
            }
            
            return new Range(startRow, startColumn, endRow, session.getLine(endRow).length);
        };
        this.getCommentRegionBlock = (session, line, row) => {
            const startColumn = line.search(/\s*$/);
            const maxRow = session.getLength();
            const startRow = row;
            
            const re = /^\s*(?:\/\*|\/\/|--)#?(end)?region\b/;
            let depth = 1;
            while (++row < maxRow) {
                line = session.getLine(row);
                const m = re.exec(line);
                if (!m) continue;
                if (m[1]) depth--;
                else depth++;

                if (!depth) break;
            }

            const endRow = row;
            if (endRow > startRow) {
                return new Range(startRow, startColumn, endRow, line.length);
            }
        };

    }).call(FoldMode.prototype);
});

ace.define("ace/mode/jack",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/jack_highlight_rules","ace/mode/matching_brace_outdent","ace/mode/behaviour/cstyle","ace/mode/folding/cstyle"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextMode = require("./text").Mode;
    const HighlightRules = require("./jack_highlight_rules").JackHighlightRules;
    const MatchingBraceOutdent = require("./matching_brace_outdent").MatchingBraceOutdent;
    const CstyleBehaviour = require("./behaviour/cstyle").CstyleBehaviour;
    const CStyleFoldMode = require("./folding/cstyle").FoldMode;

    const Mode = function() {
        this.HighlightRules = HighlightRules;
        this.$outdent = new MatchingBraceOutdent();
        this.$behaviour = new CstyleBehaviour();
        this.foldingRules = new CStyleFoldMode();
    };
    oop.inherits(Mode, TextMode);

    (function() {

        this.lineCommentStart = "--";

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


        this.$id = "ace/mode/jack";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});
