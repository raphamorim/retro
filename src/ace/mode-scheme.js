ace.define("ace/mode/scheme_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    const SchemeHighlightRules = function() {
        const keywordControl = "case|do|let|loop|if|else|when";
        const keywordOperator = "eq?|eqv?|equal?|and|or|not|null?";
        const constantLanguage = "#t|#f";
        const supportFunctions = "cons|car|cdr|cond|lambda|lambda*|syntax-rules|format|set!|quote|eval|append|list|list?|member?|load";

        const keywordMapper = this.createKeywordMapper({
            "keyword.control": keywordControl,
            "keyword.operator": keywordOperator,
            "constant.language": constantLanguage,
            "support.function": supportFunctions
        }, "identifier", true);

        this.$rules = 
            {
        "start": [
            {
                token : "comment",
                regex : ";.*$"
            },
            {
                "token": ["storage.type.function-type.scheme", "text", "entity.name.function.scheme"],
                "regex": "(?:\\b(?:(define|define-syntax|define-macro))\\b)(\\s+)((?:\\w|\\-|\\!|\\?)*)"
            },
            {
                "token": "punctuation.definition.constant.character.scheme",
                "regex": "#:\\S+"
            },
            {
                "token": ["punctuation.definition.variable.scheme", "variable.other.global.scheme", "punctuation.definition.variable.scheme"],
                "regex": "(\\*)(\\S*)(\\*)"
            },
            {
                "token" : "constant.numeric", // hex
                "regex" : "#[xXoObB][0-9a-fA-F]+"
            }, 
            {
                "token" : "constant.numeric", // float
                "regex" : "[+-]?\\d+(?:(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)?"
            },
            {
                    "token" : keywordMapper,
                    "regex" : "[a-zA-Z_#][a-zA-Z0-9_\\-\\?\\!\\*]*"
            },
            {
                "token" : "string",
                "regex" : '"(?=.)',
                "next"  : "qqstring"
            }
        ],
        "qqstring": [
            {
                "token": "constant.character.escape.scheme",
                "regex": "\\\\."
            },
            {
                "token" : "string",
                "regex" : '[^"\\\\]+',
                "merge" : true
            }, {
                "token" : "string",
                "regex" : "\\\\$",
                "next"  : "qqstring",
                "merge" : true
            }, {
                "token" : "string",
                "regex" : '"|$',
                "next"  : "start",
                "merge" : true
            }
        ]
    }

    };

    oop.inherits(SchemeHighlightRules, TextHighlightRules);

    exports.SchemeHighlightRules = SchemeHighlightRules;
});

ace.define("ace/mode/matching_parens_outdent",["require","exports","module","ace/range"], (require, exports, module) => {
    const Range = require("../range").Range;

    const MatchingParensOutdent = () => {};

    (function() {

        this.checkOutdent = (line, input) => {
            if (! /^\s+$/.test(line))
                return false;

            return /^\s*\)/.test(input);
        };

        this.autoOutdent = function(doc, row) {
            const line = doc.getLine(row);
            const match = line.match(/^(\s*\))/);

            if (!match) return 0;

            const column = match[1].length;
            const openBracePos = doc.findMatchingBracket({row, column});

            if (!openBracePos || openBracePos.row == row) return 0;

            const indent = this.$getIndent(doc.getLine(openBracePos.row));
            doc.replace(new Range(row, 0, row, column-1), indent);
        };

        this.$getIndent = line => {
            const match = line.match(/^(\s+)/);
            if (match) {
                return match[1];
            }

            return "";
        };

    }).call(MatchingParensOutdent.prototype);

    exports.MatchingParensOutdent = MatchingParensOutdent;
});

ace.define("ace/mode/scheme",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/scheme_highlight_rules","ace/mode/matching_parens_outdent"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextMode = require("./text").Mode;
    const SchemeHighlightRules = require("./scheme_highlight_rules").SchemeHighlightRules;
    const MatchingParensOutdent = require("./matching_parens_outdent").MatchingParensOutdent;

    const Mode = function() {
        this.HighlightRules = SchemeHighlightRules;
        this.$outdent = new MatchingParensOutdent();
    };
    oop.inherits(Mode, TextMode);

    (function() {
           
        this.lineCommentStart = ";";
        this.minorIndentFunctions = ["define", "lambda", "define-macro", "define-syntax", "syntax-rules", "define-record-type", "define-structure"];

        this.$toIndent = str => str.split('').map(ch => {
            if (/\s/.exec(ch)) {
                return ch;
            } else {
                return ' ';
            }
        }).join('');

        this.$calculateIndent = function(line, tab) {
            let baseIndent = this.$getIndent(line);
            let delta = 0;
            let isParen;
            let ch;
            for (var i = line.length - 1; i >= 0; i--) {
                ch = line[i];
                if (ch === '(') {
                    delta--;
                    isParen = true;
                } else if (ch === '(' || ch === '[' || ch === '{') {
                    delta--;
                    isParen = false;
                } else if (ch === ')' || ch === ']' || ch === '}') {
                    delta++;
                }
                if (delta < 0) {
                    break;
                }
            }
            if (delta < 0 && isParen) {
                i += 1;
                const iBefore = i;
                let fn = '';
                while (true) {
                    ch = line[i];
                    if (ch === ' ' || ch === '\t') {
                        if(this.minorIndentFunctions.includes(fn)) {
                            return this.$toIndent(line.substring(0, iBefore - 1) + tab);
                        } else {
                            return this.$toIndent(line.substring(0, i + 1));
                        }
                    } else if (ch === undefined) {
                        return this.$toIndent(line.substring(0, iBefore - 1) + tab);
                    }
                    fn += line[i];
                    i++;
                }
            } else if(delta < 0 && !isParen) {
                return this.$toIndent(line.substring(0, i+1));
            } else if(delta > 0) {
                baseIndent = baseIndent.substring(0, baseIndent.length - tab.length);
                return baseIndent;
            } else {
                return baseIndent;
            }
        };

        this.getNextLineIndent = function(state, line, tab) {
            return this.$calculateIndent(line, tab);
        };

        this.checkOutdent = function(state, line, input) {
            return this.$outdent.checkOutdent(line, input);
        };

        this.autoOutdent = function(state, doc, row) {
            this.$outdent.autoOutdent(doc, row);
        };
        
        this.$id = "ace/mode/scheme";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});
