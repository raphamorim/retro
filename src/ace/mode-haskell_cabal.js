ace.define("ace/mode/haskell_cabal_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    const CabalHighlightRules = function() {
        this.$rules = {
            "start" : [
                {
                    token : "comment",
                    regex : "^\\s*--.*$"
                }, {
                    token: ["keyword"],
                    regex: /^(\s*\w.*?)(:(?:\s+|$))/
                }, {
                    token : "constant.numeric", // float
                    regex : /[\d_]+(?:(?:[\.\d_]*)?)/
                }, {
                    token : "constant.language.boolean",
                    regex : "(?:true|false|TRUE|FALSE|True|False|yes|no)\\b"
                }, {
                    token : "markup.heading",
                    regex : /^(\w.*)$/
                }
            ]};

    };

    oop.inherits(CabalHighlightRules, TextHighlightRules);

    exports.CabalHighlightRules = CabalHighlightRules;
});

ace.define("ace/mode/folding/haskell_cabal",["require","exports","module","ace/lib/oop","ace/mode/folding/fold_mode","ace/range"], (require, exports, module) => {
    const oop = require("../../lib/oop");
    const BaseFoldMode = require("./fold_mode").FoldMode;
    const Range = require("../../range").Range;

    const FoldMode = exports.FoldMode = () => {};
    oop.inherits(FoldMode, BaseFoldMode);

    (function() {
      this.isHeading = (session, row) => {
          const heading = "markup.heading";
          const token = session.getTokens(row)[0];
          return row==0 || (token && token.type.lastIndexOf(heading, 0) === 0);
      };

      this.getFoldWidget = function(session, foldStyle, row) {
          if (this.isHeading(session,row)){
            return "start";
          } else if (foldStyle === "markbeginend" && !(/^\s*$/.test(session.getLine(row)))){
            const maxRow = session.getLength();
            while (++row < maxRow) {
              if (!(/^\s*$/.test(session.getLine(row)))){
                  break;
              }
            }
            if (row==maxRow || this.isHeading(session,row)){
              return "end";
            }
          }
          return "";
      };


      this.getFoldWidgetRange = function(session, foldStyle, row) {
          var line = session.getLine(row);
          var startColumn = line.length;
          const maxRow = session.getLength();
          const startRow = row;
          var endRow = row;
          if (this.isHeading(session,row)) {
              while (++row < maxRow) {
                  if (this.isHeading(session,row)){
                    row--;
                    break;
                  }
              }

              endRow = row;
              if (endRow > startRow) {
                  while (endRow > startRow && /^\s*$/.test(session.getLine(endRow)))
                      endRow--;
              }

              if (endRow > startRow) {
                  var endColumn = session.getLine(endRow).length;
                  return new Range(startRow, startColumn, endRow, endColumn);
              }
          } else if (this.getFoldWidget(session, foldStyle, row)==="end"){
            var endRow = row;
            var endColumn = session.getLine(endRow).length;
            while (--row>=0){
              if (this.isHeading(session,row)){
                break;
              }
            }
            var line = session.getLine(row);
            var startColumn = line.length;
            return new Range(row, startColumn, endRow, endColumn);
          }
        };

    }).call(FoldMode.prototype);
});

ace.define("ace/mode/haskell_cabal",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/haskell_cabal_highlight_rules","ace/mode/folding/haskell_cabal"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextMode = require("./text").Mode;
    const CabalHighlightRules = require("./haskell_cabal_highlight_rules").CabalHighlightRules;
    const FoldMode = require("./folding/haskell_cabal").FoldMode;

    const Mode = function() {
        this.HighlightRules = CabalHighlightRules;
        this.foldingRules = new FoldMode();
    };
    oop.inherits(Mode, TextMode);

    (function() {
        this.lineCommentStart = "--";
        this.blockComment = null;
        this.$id = "ace/mode/haskell_cabal";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});
