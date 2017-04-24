ace.define("ace/mode/rdoc_highlight_rules",["require","exports","module","ace/lib/oop","ace/lib/lang","ace/mode/text_highlight_rules","ace/mode/latex_highlight_rules"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const lang = require("../lib/lang");
    const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;
    const LaTeXHighlightRules = require("./latex_highlight_rules");

    const RDocHighlightRules = function() {

        this.$rules = {
            "start" : [
                {
                    token : "comment",
                    regex : "%.*$"
                }, {
                    token : "text", // non-command
                    regex : "\\\\[$&%#\\{\\}]"
                }, {
                    token : "keyword", // command
                    regex : "\\\\(?:name|alias|method|S3method|S4method|item|code|preformatted|kbd|pkg|var|env|option|command|author|email|url|source|cite|acronym|href|code|preformatted|link|eqn|deqn|keyword|usage|examples|dontrun|dontshow|figure|if|ifelse|Sexpr|RdOpts|inputencoding|usepackage)\\b",
                   next : "nospell"
                }, {
                    token : "keyword", // command
                    regex : "\\\\(?:[a-zA-z0-9]+|[^a-zA-z0-9])"
                }, {
                   token : "paren.keyword.operator",
                    regex : "[[({]"
                }, {
                   token : "paren.keyword.operator",
                    regex : "[\\])}]"
                }, {
                    token : "text",
                    regex : "\\s+"
                }
            ],
            "nospell" : [
               {
                   token : "comment",
                   regex : "%.*$",
                   next : "start"
               }, {
                   token : "nospell.text", // non-command
                   regex : "\\\\[$&%#\\{\\}]"
               }, {
                   token : "keyword", // command
                   regex : "\\\\(?:name|alias|method|S3method|S4method|item|code|preformatted|kbd|pkg|var|env|option|command|author|email|url|source|cite|acronym|href|code|preformatted|link|eqn|deqn|keyword|usage|examples|dontrun|dontshow|figure|if|ifelse|Sexpr|RdOpts|inputencoding|usepackage)\\b"
               }, {
                   token : "keyword", // command
                   regex : "\\\\(?:[a-zA-z0-9]+|[^a-zA-z0-9])",
                   next : "start"
               }, {
                   token : "paren.keyword.operator",
                   regex : "[[({]"
               }, {
                   token : "paren.keyword.operator",
                   regex : "[\\])]"
               }, {
                   token : "paren.keyword.operator",
                   regex : "}",
                   next : "start"
               }, {
                   token : "nospell.text",
                   regex : "\\s+"
               }, {
                   token : "nospell.text",
                   regex : "\\w+"
               }
            ]
        };
    };

    oop.inherits(RDocHighlightRules, TextHighlightRules);

    exports.RDocHighlightRules = RDocHighlightRules;
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

ace.define("ace/mode/rdoc",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/text_highlight_rules","ace/mode/rdoc_highlight_rules","ace/mode/matching_brace_outdent"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextMode = require("./text").Mode;
    const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;
    const RDocHighlightRules = require("./rdoc_highlight_rules").RDocHighlightRules;
    const MatchingBraceOutdent = require("./matching_brace_outdent").MatchingBraceOutdent;

    const Mode = function(suppressHighlighting) {
        this.HighlightRules = RDocHighlightRules;
        this.$outdent = new MatchingBraceOutdent();
    };
    oop.inherits(Mode, TextMode);

    (function() {
        this.getNextLineIndent = function(state, line, tab) {
            return this.$getIndent(line);
        };
        this.$id = "ace/mode/rdoc";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});
