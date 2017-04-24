ace.define("ace/mode/toml_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    const TomlHighlightRules = function() {
        const keywordMapper = this.createKeywordMapper({
            "constant.language.boolean": "true|false"
        }, "identifier");

        const identifierRe = "[a-zA-Z\\$_\u00a1-\uffff][a-zA-Z\\d\\$_\u00a1-\uffff]*\\b";

        this.$rules = {
        "start": [
            {
                token: "comment.toml",
                regex: /#.*$/
            },
            {
                token : "string",
                regex : '"(?=.)',
                next  : "qqstring"
            },
            {
                token: ["variable.keygroup.toml"],
                regex: "(?:^\\s*)(\\[\\[([^\\]]+)\\]\\])"
            },
            {
                token: ["variable.keygroup.toml"],
                regex: "(?:^\\s*)(\\[([^\\]]+)\\])"
            },
            {
                token : keywordMapper,
                regex : identifierRe
            },
            {
               token : "support.date.toml",
               regex: "\\d{4}-\\d{2}-\\d{2}(T)\\d{2}:\\d{2}:\\d{2}(Z)"
            },
            {
               token: "constant.numeric.toml",
               regex: "-?\\d+(\\.?\\d+)?"
            }
        ],
        "qqstring" : [
            {
                token : "string",
                regex : "\\\\$",
                next  : "qqstring"
            },
            {
                token : "constant.language.escape",
                regex : '\\\\[0tnr"\\\\]'
            },
            {
                token : "string",
                regex : '"|$',
                next  : "start"
            },
            {
                defaultToken: "string"
            }
        ]
        }

    };

    oop.inherits(TomlHighlightRules, TextHighlightRules);

    exports.TomlHighlightRules = TomlHighlightRules;
});

ace.define("ace/mode/folding/ini",["require","exports","module","ace/lib/oop","ace/range","ace/mode/folding/fold_mode"], (require, exports, module) => {
    const oop = require("../../lib/oop");
    const Range = require("../../range").Range;
    const BaseFoldMode = require("./fold_mode").FoldMode;

    const FoldMode = exports.FoldMode = () => {
    };
    oop.inherits(FoldMode, BaseFoldMode);

    (function() {

        this.foldingStartMarker = /^\s*\[([^\])]*)]\s*(?:$|[;#])/;

        this.getFoldWidgetRange = function(session, foldStyle, row) {
            const re = this.foldingStartMarker;
            let line = session.getLine(row);
            
            let m = line.match(re);
            
            if (!m) return;
            
            const startName = `${m[1]}.`;
            
            const startColumn = line.length;
            const maxRow = session.getLength();
            const startRow = row;
            let endRow = row;

            while (++row < maxRow) {
                line = session.getLine(row);
                if (/^\s*$/.test(line))
                    continue;
                m = line.match(re);
                if (m && m[1].lastIndexOf(startName, 0) !== 0)
                    break;

                endRow = row;
            }

            if (endRow > startRow) {
                const endColumn = session.getLine(endRow).length;
                return new Range(startRow, startColumn, endRow, endColumn);
            }
        };

    }).call(FoldMode.prototype);
});

ace.define("ace/mode/toml",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/toml_highlight_rules","ace/mode/folding/ini"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextMode = require("./text").Mode;
    const TomlHighlightRules = require("./toml_highlight_rules").TomlHighlightRules;
    const FoldMode = require("./folding/ini").FoldMode;

    const Mode = function() {
        this.HighlightRules = TomlHighlightRules;
        this.foldingRules = new FoldMode();
    };
    oop.inherits(Mode, TextMode);

    (function() {
        this.lineCommentStart = "#";
        this.$id = "ace/mode/toml";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});
