ace.define("ace/mode/diff_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    const DiffHighlightRules = function() {

        this.$rules = {
            "start" : [{
                    regex: "^(?:\\*{15}|={67}|-{3}|\\+{3})$",
                    token: "punctuation.definition.separator.diff",
                    "name": "keyword"
                }, { //diff.range.unified
                    regex: "^(@@)(\\s*.+?\\s*)(@@)(.*)$",
                    token: [
                        "constant",
                        "constant.numeric",
                        "constant",
                        "comment.doc.tag"
                    ]
                }, { //diff.range.normal
                    regex: "^(\\d+)([,\\d]+)(a|d|c)(\\d+)([,\\d]+)(.*)$",
                    token: [
                        "constant.numeric",
                        "punctuation.definition.range.diff",
                        "constant.function",
                        "constant.numeric",
                        "punctuation.definition.range.diff",
                        "invalid"
                    ],
                    "name": "meta."
                }, {
                    regex: "^(\\-{3}|\\+{3}|\\*{3})( .+)$",
                    token: [
                        "constant.numeric",
                        "meta.tag"
                    ]
                }, { // added
                    regex: "^([!+>])(.*?)(\\s*)$",
                    token: [
                        "support.constant",
                        "text",
                        "invalid"
                    ]
                }, { // removed
                    regex: "^([<\\-])(.*?)(\\s*)$",
                    token: [
                        "support.function",
                        "string",
                        "invalid"
                    ]
                }, {
                    regex: "^(diff)(\\s+--\\w+)?(.+?)( .+)?$",
                    token: ["variable", "variable", "keyword", "variable"]
                }, {
                    regex: "^Index.+$",
                    token: "variable"
                }, {
                    regex: "^\\s+$",
                    token: "text"
                }, {
                    regex: "\\s*$",
                    token: "invalid"
                }, {
                    defaultToken: "invisible",
                    caseInsensitive: true
                }
            ]
        };
    };

    oop.inherits(DiffHighlightRules, TextHighlightRules);

    exports.DiffHighlightRules = DiffHighlightRules;
});

ace.define("ace/mode/folding/diff",["require","exports","module","ace/lib/oop","ace/mode/folding/fold_mode","ace/range"], (require, exports, module) => {
    const oop = require("../../lib/oop");
    const BaseFoldMode = require("./fold_mode").FoldMode;
    const Range = require("../../range").Range;

    const FoldMode = exports.FoldMode = function(levels, flag) {
        this.regExpList = levels;
        this.flag = flag;
        this.foldingStartMarker = RegExp(`^(${levels.join("|")})`, this.flag);
    };
    oop.inherits(FoldMode, BaseFoldMode);

    (function() {
        this.getFoldWidgetRange = function(session, foldStyle, row) {
            let line = session.getLine(row);
            const start = {row, column: line.length};

            const regList = this.regExpList;
            for (let i = 1; i <= regList.length; i++) {
                var re = RegExp(`^(${regList.slice(0, i).join("|")})`, this.flag);
                if (re.test(line))
                    break;
            }

            for (const l = session.getLength(); ++row < l; ) {
                line = session.getLine(row);
                if (re.test(line))
                    break;
            }
            if (row == start.row + 1)
                return;
            return  Range.fromPoints(start, {row: row - 1, column: line.length});
        };

    }).call(FoldMode.prototype);
});

ace.define("ace/mode/diff",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/diff_highlight_rules","ace/mode/folding/diff"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextMode = require("./text").Mode;
    const HighlightRules = require("./diff_highlight_rules").DiffHighlightRules;
    const FoldMode = require("./folding/diff").FoldMode;

    const Mode = function() {
        this.HighlightRules = HighlightRules;
        this.foldingRules = new FoldMode(["diff", "index", "\\+{3}", "@@|\\*{5}"], "i");
    };
    oop.inherits(Mode, TextMode);

    (function() {

        this.$id = "ace/mode/diff";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});
