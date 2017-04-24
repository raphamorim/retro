ace.define("ace/mode/lisp_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    const LispHighlightRules = function() {
        const keywordControl = "case|do|let|loop|if|else|when";
        const keywordOperator = "eq|neq|and|or";
        const constantLanguage = "null|nil";
        const supportFunctions = "cons|car|cdr|cond|lambda|format|setq|setf|quote|eval|append|list|listp|memberp|t|load|progn";

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
                token: ["storage.type.function-type.lisp", "text", "entity.name.function.lisp"],
                regex: "(?:\\b(?:(defun|defmethod|defmacro))\\b)(\\s+)((?:\\w|\\-|\\!|\\?)*)"
            },
            {
                token: ["punctuation.definition.constant.character.lisp", "constant.character.lisp"],
                regex: "(#)((?:\\w|[\\\\+-=<>'\"&#])+)"
            },
            {
                token: ["punctuation.definition.variable.lisp", "variable.other.global.lisp", "punctuation.definition.variable.lisp"],
                regex: "(\\*)(\\S*)(\\*)"
            },
            {
                token : "constant.numeric", // hex
                regex : "0[xX][0-9a-fA-F]+(?:L|l|UL|ul|u|U|F|f|ll|LL|ull|ULL)?\\b"
            }, 
            {
                token : "constant.numeric", // float
                regex : "[+-]?\\d+(?:(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)?(?:L|l|UL|ul|u|U|F|f|ll|LL|ull|ULL)?\\b"
            },
            {
                    token : keywordMapper,
                    regex : "[a-zA-Z_$][a-zA-Z0-9_$]*\\b"
            },
            {
                token : "string",
                regex : '"(?=.)',
                next  : "qqstring"
            }
        ],
        "qqstring": [
            {
                token: "constant.character.escape.lisp",
                regex: "\\\\."
            },
            {
                token : "string",
                regex : '[^"\\\\]+'
            }, {
                token : "string",
                regex : "\\\\$",
                next  : "qqstring"
            }, {
                token : "string",
                regex : '"|$',
                next  : "start"
            }
        ]
    }

    };

    oop.inherits(LispHighlightRules, TextHighlightRules);

    exports.LispHighlightRules = LispHighlightRules;
});

ace.define("ace/mode/lisp",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/lisp_highlight_rules"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextMode = require("./text").Mode;
    const LispHighlightRules = require("./lisp_highlight_rules").LispHighlightRules;

    const Mode = function() {
        this.HighlightRules = LispHighlightRules;
    };
    oop.inherits(Mode, TextMode);

    (function() {
           
        this.lineCommentStart = ";";
        
        this.$id = "ace/mode/lisp";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});
