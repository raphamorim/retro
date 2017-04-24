ace.define("ace/mode/eiffel_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    const EiffelHighlightRules = function() {
        const keywords = "across|agent|alias|all|attached|as|assign|attribute|check|" +
            "class|convert|create|debug|deferred|detachable|do|else|elseif|end|" +
            "ensure|expanded|export|external|feature|from|frozen|if|inherit|" +
            "inspect|invariant|like|local|loop|not|note|obsolete|old|once|" +
            "Precursor|redefine|rename|require|rescue|retry|select|separate|" +
            "some|then|undefine|until|variant|when";

        const operatorKeywords = "and|implies|or|xor";

        const languageConstants = "Void";

        const booleanConstants = "True|False";

        const languageVariables = "Current|Result";

        const keywordMapper = this.createKeywordMapper({
            "constant.language": languageConstants,
            "constant.language.boolean": booleanConstants,
            "variable.language": languageVariables,
            "keyword.operator": operatorKeywords,
            "keyword": keywords
        }, "identifier", true);

        const simpleString = /(?:[^"%\b\f\v]|%[A-DFHLNQR-V%'"()<>]|%\/(?:0[xX][\da-fA-F](?:_*[\da-fA-F])*|0[cC][0-7](?:_*[0-7])*|0[bB][01](?:_*[01])*|\d(?:_*\d)*)\/)+?/;

        this.$rules = {
            "start": [{
                    token : "string.quoted.other", // Aligned-verbatim-strings (verbatim option not supported)
                    regex : /"\[/,
                    next: "aligned_verbatim_string"
                }, {
                    token : "string.quoted.other", // Non-aligned-verbatim-strings (verbatim option not supported)
                    regex : /"\{/,
                    next: "non-aligned_verbatim_string"
                }, {
                    token : "string.quoted.double",
                    regex : /"(?:[^%\b\f\n\r\v]|%[A-DFHLNQR-V%'"()<>]|%\/(?:0[xX][\da-fA-F](?:_*[\da-fA-F])*|0[cC][0-7](?:_*[0-7])*|0[bB][01](?:_*[01])*|\d(?:_*\d)*)\/)*?"/
                }, {
                    token : "comment.line.double-dash",
                    regex : /--.*/
                }, {
                    token : "constant.character",
                    regex : /'(?:[^%\b\f\n\r\t\v]|%[A-DFHLNQR-V%'"()<>]|%\/(?:0[xX][\da-fA-F](?:_*[\da-fA-F])*|0[cC][0-7](?:_*[0-7])*|0[bB][01](?:_*[01])*|\d(?:_*\d)*)\/)'/
                }, {
                    token : "constant.numeric", // hexa | octal | bin
                    regex : /\b0(?:[xX][\da-fA-F](?:_*[\da-fA-F])*|[cC][0-7](?:_*[0-7])*|[bB][01](?:_*[01])*)\b/
                }, {
                    token : "constant.numeric",
                    regex : /(?:\d(?:_*\d)*)?\.(?:(?:\d(?:_*\d)*)?[eE][+-]?)?\d(?:_*\d)*|\d(?:_*\d)*\.?/
                }, {
                    token : "paren.lparen",
                    regex : /[\[({]|<<|\|\(/
                }, {
                    token : "paren.rparen",
                    regex : /[\])}]|>>|\|\)/
                }, {
                    token : "keyword.operator", // punctuation
                    regex : /:=|->|\.(?=\w)|[;,:?]/
                }, {
                    token : "keyword.operator",
                    regex : /\\\\|\|\.\.\||\.\.|\/[~\/]?|[><\/]=?|[-+*^=~]/
                }, {
                    token(v) {
                        let result = keywordMapper(v);
                        if (result === "identifier" && v === v.toUpperCase()) {
                            result =  "entity.name.type";
                        }
                        return result;
                    },
                    regex : /[a-zA-Z][a-zA-Z\d_]*\b/
                }, {
                    token : "text",
                    regex : /\s+/
                }
            ],
            "aligned_verbatim_string" : [{
                    token : "string",
                    regex : /]"/,
                    next : "start"
                }, {
                    token : "string",
                    regex : simpleString
                }
            ],
            "non-aligned_verbatim_string" : [{
                    token : "string.quoted.other",
                    regex : /}"/,
                    next : "start"
                }, {
                    token : "string.quoted.other",
                    regex : simpleString
                }
            ]};
    };

    oop.inherits(EiffelHighlightRules, TextHighlightRules);

    exports.EiffelHighlightRules = EiffelHighlightRules;
});

ace.define("ace/mode/eiffel",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/eiffel_highlight_rules","ace/range"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextMode = require("./text").Mode;
    const EiffelHighlightRules = require("./eiffel_highlight_rules").EiffelHighlightRules;
    const Range = require("../range").Range;

    const Mode = function() {
        this.HighlightRules = EiffelHighlightRules;
    };
    oop.inherits(Mode, TextMode);

    (function() {
        this.lineCommentStart = "--";
        this.$id = "ace/mode/eiffel";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});
