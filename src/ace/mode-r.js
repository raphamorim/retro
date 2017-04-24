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

ace.define("ace/mode/r_highlight_rules",["require","exports","module","ace/lib/oop","ace/lib/lang","ace/mode/text_highlight_rules","ace/mode/tex_highlight_rules"], (require, exports, module) => {

   const oop = require("../lib/oop");
   const lang = require("../lib/lang");
   const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;
   const TexHighlightRules = require("./tex_highlight_rules").TexHighlightRules;

   const RHighlightRules = function()
   {

      const keywords = lang.arrayToMap(
            ("function|if|in|break|next|repeat|else|for|return|switch|while|try|tryCatch|stop|warning|require|library|attach|detach|source|setMethod|setGeneric|setGroupGeneric|setClass")
                  .split("|")
            );

      const buildinConstants = lang.arrayToMap(
            ("NULL|NA|TRUE|FALSE|T|F|Inf|NaN|NA_integer_|NA_real_|NA_character_|" +
             "NA_complex_").split("|")
            );

      this.$rules = {
         "start" : [
            {
               token : "comment.sectionhead",
               regex : "#+(?!').*(?:----|====|####)\\s*$"
            },
            {
               token : "comment",
               regex : "#+'",
               next : "rd-start"
            },
            {
               token : "comment",
               regex : "#.*$"
            },
            {
               token : "string", // multi line string start
               regex : '["]',
               next : "qqstring"
            },
            {
               token : "string", // multi line string start
               regex : "[']",
               next : "qstring"
            },
            {
               token : "constant.numeric", // hex
               regex : "0[xX][0-9a-fA-F]+[Li]?\\b"
            },
            {
               token : "constant.numeric", // explicit integer
               regex : "\\d+L\\b"
            },
            {
               token : "constant.numeric", // number
               regex : "\\d+(?:\\.\\d*)?(?:[eE][+\\-]?\\d*)?i?\\b"
            },
            {
               token : "constant.numeric", // number with leading decimal
               regex : "\\.\\d+(?:[eE][+\\-]?\\d*)?i?\\b"
            },
            {
               token : "constant.language.boolean",
               regex : "(?:TRUE|FALSE|T|F)\\b"
            },
            {
               token : "identifier",
               regex : "`.*?`"
            },
            {
               onMatch(value) {
                  if (keywords[value])
                     return "keyword";
                  else if (buildinConstants[value])
                     return "constant.language";
                  else if (value == '...' || value.match(/^\.\.\d+$/))
                     return "variable.language";
                  else
                     return "identifier";
               },
               regex : "[a-zA-Z.][a-zA-Z0-9._]*\\b"
            },
            {
               token : "keyword.operator",
               regex : "%%|>=|<=|==|!=|\\->|<\\-|\\|\\||&&|=|\\+|\\-|\\*|/|\\^|>|<|!|&|\\||~|\\$|:"
            },
            {
               token : "keyword.operator", // infix operators
               regex : "%.*?%"
            },
            {
               token : "paren.keyword.operator",
               regex : "[[({]"
            },
            {
               token : "paren.keyword.operator",
               regex : "[\\])}]"
            },
            {
               token : "text",
               regex : "\\s+"
            }
         ],
         "qqstring" : [
            {
               token : "string",
               regex : '(?:(?:\\\\.)|(?:[^"\\\\]))*?"',
               next : "start"
            },
            {
               token : "string",
               regex : '.+'
            }
         ],
         "qstring" : [
            {
               token : "string",
               regex : "(?:(?:\\\\.)|(?:[^'\\\\]))*?'",
               next : "start"
            },
            {
               token : "string",
               regex : '.+'
            }
         ]
      };

      const rdRules = new TexHighlightRules("comment").getRules();
      for (let i = 0; i < rdRules["start"].length; i++) {
         rdRules["start"][i].token += ".virtual-comment";
      }

      this.addRules(rdRules, "rd-");
      this.$rules["rd-start"].unshift({
          token: "text",
          regex: "^",
          next: "start"
      });
      this.$rules["rd-start"].unshift({
         token : "keyword",
         regex : "@(?!@)[^ ]*"
      });
      this.$rules["rd-start"].unshift({
         token : "comment",
         regex : "@@"
      });
      this.$rules["rd-start"].push({
         token : "comment",
         regex : "[^%\\\\[({\\])}]+"
      });
   };

   oop.inherits(RHighlightRules, TextHighlightRules);

   exports.RHighlightRules = RHighlightRules;
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

ace.define("ace/mode/r",["require","exports","module","ace/range","ace/lib/oop","ace/mode/text","ace/mode/text_highlight_rules","ace/mode/r_highlight_rules","ace/mode/matching_brace_outdent","ace/unicode"], (require, exports, module) => {
   const Range = require("../range").Range;
   const oop = require("../lib/oop");
   const TextMode = require("./text").Mode;
   const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;
   const RHighlightRules = require("./r_highlight_rules").RHighlightRules;
   const MatchingBraceOutdent = require("./matching_brace_outdent").MatchingBraceOutdent;
   const unicode = require("../unicode");

   const Mode = function()
   {
      this.HighlightRules = RHighlightRules;
      this.$outdent = new MatchingBraceOutdent();
   };
   oop.inherits(Mode, TextMode);

   (function()
   {
      this.lineCommentStart = "#";
       this.$id = "ace/mode/r";
   }).call(Mode.prototype);
   exports.Mode = Mode;
});
