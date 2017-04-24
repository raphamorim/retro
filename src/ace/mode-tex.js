ace.define("ace/mode/tex_highlight_rules",["require","exports","module","ace/lib/oop","ace/lib/lang","ace/mode/text_highlight_rules"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const lang = require("../lib/lang");
    const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    const TexHighlightRules = function(textClass) {

        if (!textClass)
            textClass = "text";

        this.$rules = {
            "start" : [
                {
                    token : "comment",
                    regex : "%.*$"
                }, {
                    token : textClass, // non-command
                    regex : "\\\\[$&%#\\{\\}]"
                }, {
                    token : "keyword", // command
                    regex : "\\\\(?:documentclass|usepackage|newcounter|setcounter|addtocounter|value|arabic|stepcounter|newenvironment|renewenvironment|ref|vref|eqref|pageref|label|cite[a-zA-Z]*|tag|begin|end|bibitem)\\b",
                   next : "nospell"
                }, {
                    token : "keyword", // command
                    regex : "\\\\(?:[a-zA-Z0-9]+|[^a-zA-Z0-9])"
                }, {
                   token : "paren.keyword.operator",
                    regex : "[[({]"
                }, {
                   token : "paren.keyword.operator",
                    regex : "[\\])}]"
                }, {
                    token : textClass,
                    regex : "\\s+"
                }
            ],
            "nospell" : [
               {
                   token : "comment",
                   regex : "%.*$",
                   next : "start"
               }, {
                   token : `nospell.${textClass}`, // non-command
                   regex : "\\\\[$&%#\\{\\}]"
               }, {
                   token : "keyword", // command
                   regex : "\\\\(?:documentclass|usepackage|newcounter|setcounter|addtocounter|value|arabic|stepcounter|newenvironment|renewenvironment|ref|vref|eqref|pageref|label|cite[a-zA-Z]*|tag|begin|end|bibitem)\\b"
               }, {
                   token : "keyword", // command
                   regex : "\\\\(?:[a-zA-Z0-9]+|[^a-zA-Z0-9])",
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
                   token : `nospell.${textClass}`,
                   regex : "\\s+"
               }, {
                   token : `nospell.${textClass}`,
                   regex : "\\w+"
               }
            ]
        };
    };

    oop.inherits(TexHighlightRules, TextHighlightRules);

    exports.TexHighlightRules = TexHighlightRules;
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

ace.define("ace/mode/tex",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/text_highlight_rules","ace/mode/tex_highlight_rules","ace/mode/matching_brace_outdent"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextMode = require("./text").Mode;
    const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;
    const TexHighlightRules = require("./tex_highlight_rules").TexHighlightRules;
    const MatchingBraceOutdent = require("./matching_brace_outdent").MatchingBraceOutdent;

    const Mode = function(suppressHighlighting) {
        if (suppressHighlighting)
            this.HighlightRules = TextHighlightRules;
        else
            this.HighlightRules = TexHighlightRules;
        this.$outdent = new MatchingBraceOutdent();
    };
    oop.inherits(Mode, TextMode);

    (function() {
       this.lineCommentStart = "%";
       this.getNextLineIndent = function(state, line, tab) {
          return this.$getIndent(line);
       };

       this.allowAutoInsert = () => false;
        this.$id = "ace/mode/tex";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});
