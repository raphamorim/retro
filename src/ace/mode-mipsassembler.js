ace.define("ace/mode/mipsassembler_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    const mipsassemblerHighlightRules = function() {

        this.$rules = {
                start: [{
                    token: "string.start",
                    regex: '"',
                    next: "qstring"
                }],
                qstring: [{
                    token: "escape",
                    regex: /\\./,
                }, {
                    token: "string.end",
                    regex: '"',
                    next: "start"
                }],
            }
        
        this.normalizeRules();
    };

    mipsassemblerHighlightRules.metaData = 


    oop.inherits(mipsassemblerHighlightRules, TextHighlightRules);

    exports.mipsassemblerHighlightRules = mipsassemblerHighlightRules;
});

ace.define("ace/mode/folding/cstyle",["require","exports","module","ace/lib/oop","ace/range","ace/mode/folding/fold_mode"], (require, exports, module) => {
    const oop = require("../../lib/oop");
    const Range = require("../../range").Range;
    const BaseFoldMode = require("./fold_mode").FoldMode;

    const FoldMode = exports.FoldMode = function(commentRegex) {
        if (commentRegex) {
            this.foldingStartMarker = new RegExp(
                this.foldingStartMarker.source.replace(/\|[^|]*?$/, `|${commentRegex.start}`)
            );
            this.foldingStopMarker = new RegExp(
                this.foldingStopMarker.source.replace(/\|[^|]*?$/, `|${commentRegex.end}`)
            );
        }
    };
    oop.inherits(FoldMode, BaseFoldMode);

    (function() {
        
        this.foldingStartMarker = /(\{|\[)[^\}\]]*$|^\s*(\/\*)/;
        this.foldingStopMarker = /^[^\[\{]*(\}|\])|^[\s\*]*(\*\/)/;
        this.singleLineBlockCommentRe= /^\s*(\/\*).*\*\/\s*$/;
        this.tripleStarBlockCommentRe = /^\s*(\/\*\*\*).*\*\/\s*$/;
        this.startRegionRe = /^\s*(\/\*|\/\/)#region\b/;
        this._getFoldWidgetBase = this.getFoldWidget;
        this.getFoldWidget = function(session, foldStyle, row) {
            const line = session.getLine(row);
        
            if (this.singleLineBlockCommentRe.test(line)) {
                if (!this.startRegionRe.test(line) && !this.tripleStarBlockCommentRe.test(line))
                    return "";
            }
        
            const fw = this._getFoldWidgetBase(session, foldStyle, row);
        
            if (!fw && this.startRegionRe.test(line))
                return "start"; // lineCommentRegionStart
        
            return fw;
        };

        this.getFoldWidgetRange = function(session, foldStyle, row, forceMultiline) {
            const line = session.getLine(row);
            
            if (this.startRegionRe.test(line))
                return this.getCommentRegionBlock(session, line, row);
            
            var match = line.match(this.foldingStartMarker);
            if (match) {
                var i = match.index;

                if (match[1])
                    return this.openingBracketBlock(session, match[1], row, i);
                    
                let range = session.getCommentFoldRange(row, i + match[0].length, 1);
                
                if (range && !range.isMultiLine()) {
                    if (forceMultiline) {
                        range = this.getSectionRange(session, row);
                    } else if (foldStyle != "all")
                        range = null;
                }
                
                return range;
            }

            if (foldStyle === "markbegin")
                return;

            var match = line.match(this.foldingStopMarker);
            if (match) {
                var i = match.index + match[0].length;

                if (match[1])
                    return this.closingBracketBlock(session, match[1], row, i);

                return session.getCommentFoldRange(row, i, -1);
            }
        };
        
        this.getSectionRange = function(session, row) {
            let line = session.getLine(row);
            const startIndent = line.search(/\S/);
            const startRow = row;
            const startColumn = line.length;
            row = row + 1;
            let endRow = row;
            const maxRow = session.getLength();
            while (++row < maxRow) {
                line = session.getLine(row);
                const indent = line.search(/\S/);
                if (indent === -1)
                    continue;
                if  (startIndent > indent)
                    break;
                const subRange = this.getFoldWidgetRange(session, "all", row);
                
                if (subRange) {
                    if (subRange.start.row <= startRow) {
                        break;
                    } else if (subRange.isMultiLine()) {
                        row = subRange.end.row;
                    } else if (startIndent == indent) {
                        break;
                    }
                }
                endRow = row;
            }
            
            return new Range(startRow, startColumn, endRow, session.getLine(endRow).length);
        };
        
        this.getCommentRegionBlock = (session, line, row) => {
            const startColumn = line.search(/\s*$/);
            const maxRow = session.getLength();
            const startRow = row;
            
            const re = /^\s*(?:\/\*|\/\/)#(end)?region\b/;
            let depth = 1;
            while (++row < maxRow) {
                line = session.getLine(row);
                const m = re.exec(line);
                if (!m) continue;
                if (m[1]) depth--;
                else depth++;

                if (!depth) break;
            }

            const endRow = row;
            if (endRow > startRow) {
                return new Range(startRow, startColumn, endRow, line.length);
            }
        };

    }).call(FoldMode.prototype);
});

ace.define("ace/mode/mipsassembler",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/mipsassembler_highlight_rules","ace/mode/folding/cstyle"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextMode = require("./text").Mode;
    const HighlightRules = require("./mipsassembler_highlight_rules").HighlightRules;
    const FoldMode = require("./folding/cstyle").FoldMode;

    const Mode = function() {
        this.HighlightRules = HighlightRules;
        this.foldingRules = new FoldMode();
    };
    oop.inherits(Mode, TextMode);

    (function() {
        this.$id = "ace/mode/mipsassembler"
    }).call(Mode.prototype);

    exports.Mode = Mode;
});
