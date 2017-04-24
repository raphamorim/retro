ace.define("ace/mode/ini_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    const escapeRe = "\\\\(?:[\\\\0abtrn;#=:]|x[a-fA-F\\d]{4})";

    const IniHighlightRules = function() {
        this.$rules = {
            start: [{
                token: 'punctuation.definition.comment.ini',
                regex: '#.*',
                push_: [{
                    token: 'comment.line.number-sign.ini',
                    regex: '$|^',
                    next: 'pop'
                }, {
                    defaultToken: 'comment.line.number-sign.ini'
                }]
            }, {
                token: 'punctuation.definition.comment.ini',
                regex: ';.*',
                push_: [{
                    token: 'comment.line.semicolon.ini',
                    regex: '$|^',
                    next: 'pop'
                }, {
                    defaultToken: 'comment.line.semicolon.ini'
                }]
            }, {
                token: ['keyword.other.definition.ini', 'text', 'punctuation.separator.key-value.ini'],
                regex: '\\b([a-zA-Z0-9_.-]+)\\b(\\s*)(=)'
            }, {
                token: ['punctuation.definition.entity.ini', 'constant.section.group-title.ini', 'punctuation.definition.entity.ini'],
                regex: '^(\\[)(.*?)(\\])'
            }, {
                token: 'punctuation.definition.string.begin.ini',
                regex: "'",
                push: [{
                    token: 'punctuation.definition.string.end.ini',
                    regex: "'",
                    next: 'pop'
                }, {
                    token: "constant.language.escape",
                    regex: escapeRe
                }, {
                    defaultToken: 'string.quoted.single.ini'
                }]
            }, {
                token: 'punctuation.definition.string.begin.ini',
                regex: '"',
                push: [{
                    token: "constant.language.escape",
                    regex: escapeRe
                }, {
                    token: 'punctuation.definition.string.end.ini',
                    regex: '"',
                    next: 'pop'
                }, {
                    defaultToken: 'string.quoted.double.ini'
                }]
            }]
        };

        this.normalizeRules();
    };

    IniHighlightRules.metaData = {
        fileTypes: ['ini', 'conf'],
        keyEquivalent: '^~I',
        name: 'Ini',
        scopeName: 'source.ini'
    };


    oop.inherits(IniHighlightRules, TextHighlightRules);

    exports.IniHighlightRules = IniHighlightRules;
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

ace.define("ace/mode/ini",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/ini_highlight_rules","ace/mode/folding/ini"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextMode = require("./text").Mode;
    const IniHighlightRules = require("./ini_highlight_rules").IniHighlightRules;
    const FoldMode = require("./folding/ini").FoldMode;

    const Mode = function() {
        this.HighlightRules = IniHighlightRules;
        this.foldingRules = new FoldMode();
    };
    oop.inherits(Mode, TextMode);

    (function() {
        this.lineCommentStart = ";";
        this.blockComment = null;
        this.$id = "ace/mode/ini";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});
