ace.define("ace/mode/logiql_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    const LogiQLHighlightRules = function() {

        this.$rules = { start: 
           [ { token: 'comment.block',
               regex: '/\\*',
               push: 
                [ { token: 'comment.block', regex: '\\*/', next: 'pop' },
                  { defaultToken: 'comment.block' } ]
                },
             { token: 'comment.single',
               regex: '//.*'
                },
             { token: 'constant.numeric',
               regex: '\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?[fd]?'
                },
             { token: 'string',
               regex: '"',
               push: 
                [ { token: 'string', regex: '"', next: 'pop' },
                  { defaultToken: 'string' } ]
                },
             { token: 'constant.language',
               regex: '\\b(true|false)\\b'
                },
             { token: 'entity.name.type.logicblox',
               regex: '`[a-zA-Z_:]+(\\d|\\a)*\\b'
                },
             { token: 'keyword.start', regex: '->',  comment: 'Constraint' },
             { token: 'keyword.start', regex: '-->', comment: 'Level 1 Constraint'},
             { token: 'keyword.start', regex: '<-',  comment: 'Rule' },
             { token: 'keyword.start', regex: '<--', comment: 'Level 1 Rule' },
             { token: 'keyword.end',   regex: '\\.', comment: 'Terminator' },
             { token: 'keyword.other', regex: '!',   comment: 'Negation' },
             { token: 'keyword.other', regex: ',',   comment: 'Conjunction' },
             { token: 'keyword.other', regex: ';',   comment: 'Disjunction' },
             { token: 'keyword.operator', regex: '<=|>=|!=|<|>', comment: 'Equality'},
             { token: 'keyword.other', regex: '@', comment: 'Equality' },
             { token: 'keyword.operator', regex: '\\+|-|\\*|/', comment: 'Arithmetic operations'},
             { token: 'keyword', regex: '::', comment: 'Colon colon' },
             { token: 'support.function',
               regex: '\\b(agg\\s*<<)',
               push: 
                [ { include: '$self' },
                  { token: 'support.function',
                    regex: '>>',
                    next: 'pop' } ]
                },
             { token: 'storage.modifier',
               regex: '\\b(lang:[\\w:]*)'
                },
             { token: [ 'storage.type', 'text' ],
               regex: '(export|sealed|clauses|block|alias|alias_all)(\\s*\\()(?=`)'
                },
             { token: 'entity.name',
               regex: '[a-zA-Z_][a-zA-Z_0-9:]*(@prev|@init|@final)?(?=(\\(|\\[))'
                },
             { token: 'variable.parameter',
               regex: '([a-zA-Z][a-zA-Z_0-9]*|_)\\s*(?=(,|\\.|<-|->|\\)|\\]|=))'
                } ] }
        
        this.normalizeRules();
    };

    oop.inherits(LogiQLHighlightRules, TextHighlightRules);

    exports.LogiQLHighlightRules = LogiQLHighlightRules;
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

ace.define("ace/mode/logiql",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/logiql_highlight_rules","ace/mode/folding/coffee","ace/token_iterator","ace/range","ace/mode/behaviour/cstyle","ace/mode/matching_brace_outdent"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextMode = require("./text").Mode;
    const LogiQLHighlightRules = require("./logiql_highlight_rules").LogiQLHighlightRules;
    const FoldMode = require("./folding/coffee").FoldMode;
    const TokenIterator = require("../token_iterator").TokenIterator;
    const Range = require("../range").Range;
    const CstyleBehaviour = require("./behaviour/cstyle").CstyleBehaviour;
    const MatchingBraceOutdent = require("./matching_brace_outdent").MatchingBraceOutdent;

    const Mode = function() {
        this.HighlightRules = LogiQLHighlightRules;
        this.foldingRules = new FoldMode();
        this.$outdent = new MatchingBraceOutdent();
        this.$behaviour = new CstyleBehaviour();
    };
    oop.inherits(Mode, TextMode);

    (function() {
        this.lineCommentStart = "//";
        this.blockComment = {start: "/*", end: "*/"};

        this.getNextLineIndent = function(state, line, tab) {
            let indent = this.$getIndent(line);

            const tokenizedLine = this.getTokenizer().getLineTokens(line, state);
            const tokens = tokenizedLine.tokens;
            const endState = tokenizedLine.state;
            if (/comment|string/.test(endState))  
                return indent;
            if (tokens.length && tokens[tokens.length - 1].type == "comment.single")
                return indent;

            const match = line.match();
            if (/(-->|<--|<-|->|{)\s*$/.test(line))
                indent += tab;
            return indent;
        };

        this.checkOutdent = function(state, line, input) {
            if (this.$outdent.checkOutdent(line, input))
                return true;

            if (input !== "\n" && input !== "\r\n")
                return false;
                
            if (!/^\s+/.test(line))
                return false;

            return true;
        };

        this.autoOutdent = function(state, doc, row) {
            if (this.$outdent.autoOutdent(doc, row))
                return;
            const prevLine = doc.getLine(row);
            const match = prevLine.match(/^\s+/);
            let column = prevLine.lastIndexOf(".") + 1;
            if (!match || !row || !column) return 0;

            const line = doc.getLine(row + 1);
            const startRange = this.getMatching(doc, {row, column});
            if (!startRange || startRange.start.row == row) return 0;

            column = match[0].length;
            const indent = this.$getIndent(doc.getLine(startRange.start.row));
            doc.replace(new Range(row + 1, 0, row + 1, column), indent);
        };

        this.getMatching = (session, row, column) => {
            if (row == undefined)
                row = session.selection.lead
            if (typeof row == "object") {
                column = row.column;
                row = row.row;
            }

            const startToken = session.getTokenAt(row, column);
            const KW_START = "keyword.start";
            const KW_END = "keyword.end";
            let tok;
            if (!startToken)
                return;
            if (startToken.type == KW_START) {
                var it = new TokenIterator(session, row, column);
                it.step = it.stepForward;
            } else if (startToken.type == KW_END) {
                var it = new TokenIterator(session, row, column);
                it.step = it.stepBackward;
            } else
                return;

            while (tok = it.step()) {
                if (tok.type == KW_START || tok.type == KW_END)
                    break;
            }
            if (!tok || tok.type == startToken.type)
                return;

            const col = it.getCurrentTokenColumn();
            var row = it.getCurrentTokenRow();
            return new Range(row, col, row, col + tok.value.length);
        };
        this.$id = "ace/mode/logiql";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});
