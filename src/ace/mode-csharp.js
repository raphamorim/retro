ace.define("ace/mode/doc_comment_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    class DocCommentHighlightRules {
        constructor() {
            this.$rules = {
                "start" : [ {
                    token : "comment.doc.tag",
                    regex : "@[\\w\\d_]+" // TODO: fix email addresses
                }, 
                DocCommentHighlightRules.getTagRule(),
                {
                    defaultToken : "comment.doc",
                    caseInsensitive: true
                }]
            };
        }

        static getTagRule(start) {
            return {
                token : "comment.doc.tag.storage.type",
                regex : "\\b(?:TODO|FIXME|XXX|HACK)\\b"
            };
        }

        static getStartRule(start) {
            return {
                token : "comment.doc", // doc comment
                regex : "\\/\\*(?=\\*)",
                next  : start
            };
        }

        static getEndRule(start) {
            return {
                token : "comment.doc", // closing comment
                regex : "\\*\\/",
                next  : start
            };
        }
    }

    oop.inherits(DocCommentHighlightRules, TextHighlightRules);


    exports.DocCommentHighlightRules = DocCommentHighlightRules;
});

ace.define("ace/mode/csharp_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/doc_comment_highlight_rules","ace/mode/text_highlight_rules"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const DocCommentHighlightRules = require("./doc_comment_highlight_rules").DocCommentHighlightRules;
    const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    const CSharpHighlightRules = function() {
        const keywordMapper = this.createKeywordMapper({
            "variable.language": "this",
            "keyword": "abstract|event|new|struct|as|explicit|null|switch|base|extern|object|this|bool|false|operator|throw|break|finally|out|true|byte|fixed|override|try|case|float|params|typeof|catch|for|private|uint|char|foreach|protected|ulong|checked|goto|public|unchecked|class|if|readonly|unsafe|const|implicit|ref|ushort|continue|in|return|using|decimal|int|sbyte|virtual|default|interface|sealed|volatile|delegate|internal|short|void|do|is|sizeof|while|double|lock|stackalloc|else|long|static|enum|namespace|string|var|dynamic",
            "constant.language": "null|true|false"
        }, "identifier");

        this.$rules = {
            "start" : [
                {
                    token : "comment",
                    regex : "\\/\\/.*$"
                },
                DocCommentHighlightRules.getStartRule("doc-start"),
                {
                    token : "comment", // multi line comment
                    regex : "\\/\\*",
                    next : "comment"
                }, {
                    token : "string", // character
                    regex : /'(?:.|\\(:?u[\da-fA-F]+|x[\da-fA-F]+|[tbrf'"n]))'/
                }, {
                    token : "string", start : '"', end : '"|$', next: [
                        {token: "constant.language.escape", regex: /\\(:?u[\da-fA-F]+|x[\da-fA-F]+|[tbrf'"n])/},
                        {token: "invalid", regex: /\\./}
                    ]
                }, {
                    token : "string", start : '@"', end : '"', next:[
                        {token: "constant.language.escape", regex: '""'}
                    ]
                }, {
                    token : "string", start : /\$"/, end : '"|$', next: [
                        {token: "constant.language.escape", regex: /\\(:?$)|{{/},
                        {token: "constant.language.escape", regex: /\\(:?u[\da-fA-F]+|x[\da-fA-F]+|[tbrf'"n])/},
                        {token: "invalid", regex: /\\./}
                    ]
                }, {
                    token : "constant.numeric", // hex
                    regex : "0[xX][0-9a-fA-F]+\\b"
                }, {
                    token : "constant.numeric", // float
                    regex : "[+-]?\\d+(?:(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)?\\b"
                }, {
                    token : "constant.language.boolean",
                    regex : "(?:true|false)\\b"
                }, {
                    token : keywordMapper,
                    regex : "[a-zA-Z_$][a-zA-Z0-9_$]*\\b"
                }, {
                    token : "keyword.operator",
                    regex : "!|\\$|%|&|\\*|\\-\\-|\\-|\\+\\+|\\+|~|===|==|=|!=|!==|<=|>=|<<=|>>=|>>>=|<>|<|>|!|&&|\\|\\||\\?\\:|\\*=|%=|\\+=|\\-=|&=|\\^=|\\b(?:in|instanceof|new|delete|typeof|void)"
                }, {
                    token : "keyword",
                    regex : "^\\s*#(if|else|elif|endif|define|undef|warning|error|line|region|endregion|pragma)"
                }, {
                    token : "punctuation.operator",
                    regex : "\\?|\\:|\\,|\\;|\\."
                }, {
                    token : "paren.lparen",
                    regex : "[[({]"
                }, {
                    token : "paren.rparen",
                    regex : "[\\])}]"
                }, {
                    token : "text",
                    regex : "\\s+"
                }
            ],
            "comment" : [
                {
                    token : "comment", // closing comment
                    regex : ".*?\\*\\/",
                    next : "start"
                }, {
                    token : "comment", // comment spanning whole line
                    regex : ".+"
                }
            ]
        };

        this.embedRules(DocCommentHighlightRules, "doc-",
            [ DocCommentHighlightRules.getEndRule("start") ]);
        this.normalizeRules();
    };

    oop.inherits(CSharpHighlightRules, TextHighlightRules);

    exports.CSharpHighlightRules = CSharpHighlightRules;
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
        this.startRegionRe = /^\s*(\/\*|\/\/)#?region\b/;
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
            
            const re = /^\s*(?:\/\*|\/\/|--)#?(end)?region\b/;
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

ace.define("ace/mode/folding/csharp",["require","exports","module","ace/lib/oop","ace/range","ace/mode/folding/cstyle"], (require, exports, module) => {
    const oop = require("../../lib/oop");
    const Range = require("../../range").Range;
    const CFoldMode = require("./cstyle").FoldMode;

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
    oop.inherits(FoldMode, CFoldMode);

    (function() {
        this.usingRe = /^\s*using \S/;

        this.getFoldWidgetRangeBase = this.getFoldWidgetRange;
        this.getFoldWidgetBase = this.getFoldWidget;
        
        this.getFoldWidget = function(session, foldStyle, row) {
            const fw = this.getFoldWidgetBase(session, foldStyle, row);
            if (!fw) {
                const line = session.getLine(row);
                if (/^\s*#region\b/.test(line)) 
                    return "start";
                const usingRe = this.usingRe;
                if (usingRe.test(line)) {
                    const prev = session.getLine(row - 1);
                    const next = session.getLine(row + 1);
                    if (!usingRe.test(prev) && usingRe.test(next))
                        return "start"
                }
            }
            return fw;
        };
        
        this.getFoldWidgetRange = function(session, foldStyle, row) {
            const range = this.getFoldWidgetRangeBase(session, foldStyle, row);
            if (range)
                return range;

            const line = session.getLine(row);
            if (this.usingRe.test(line))
                return this.getUsingStatementBlock(session, line, row);
                
            if (/^\s*#region\b/.test(line))
                return this.getRegionBlock(session, line, row);
        };
        
        this.getUsingStatementBlock = function(session, line, row) {
            const startColumn = line.match(this.usingRe)[0].length - 1;
            const maxRow = session.getLength();
            const startRow = row;
            let endRow = row;

            while (++row < maxRow) {
                line = session.getLine(row);
                if (/^\s*$/.test(line))
                    continue;
                if (!this.usingRe.test(line))
                    break;

                endRow = row;
            }

            if (endRow > startRow) {
                const endColumn = session.getLine(endRow).length;
                return new Range(startRow, startColumn, endRow, endColumn);
            }
        };
        
        this.getRegionBlock = (session, line, row) => {
            const startColumn = line.search(/\s*$/);
            const maxRow = session.getLength();
            const startRow = row;
            
            const re = /^\s*#(end)?region\b/;
            let depth = 1;
            while (++row < maxRow) {
                line = session.getLine(row);
                const m = re.exec(line);
                if (!m)
                    continue;
                if (m[1])
                    depth--;
                else
                    depth++;

                if (!depth)
                    break;
            }

            const endRow = row;
            if (endRow > startRow) {
                return new Range(startRow, startColumn, endRow, line.length);
            }
        };

    }).call(FoldMode.prototype);
});

ace.define("ace/mode/csharp",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/csharp_highlight_rules","ace/mode/matching_brace_outdent","ace/mode/behaviour/cstyle","ace/mode/folding/csharp"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextMode = require("./text").Mode;
    const CSharpHighlightRules = require("./csharp_highlight_rules").CSharpHighlightRules;
    const MatchingBraceOutdent = require("./matching_brace_outdent").MatchingBraceOutdent;
    const CstyleBehaviour = require("./behaviour/cstyle").CstyleBehaviour;
    const CStyleFoldMode = require("./folding/csharp").FoldMode;

    const Mode = function() {
        this.HighlightRules = CSharpHighlightRules;
        this.$outdent = new MatchingBraceOutdent();
        this.$behaviour = new CstyleBehaviour();
        this.foldingRules = new CStyleFoldMode();
    };
    oop.inherits(Mode, TextMode);

    (function() {
        
        this.lineCommentStart = "//";
        this.blockComment = {start: "/*", end: "*/"};
        
        this.getNextLineIndent = function(state, line, tab) {
            let indent = this.$getIndent(line);
      
            const tokenizedLine = this.getTokenizer().getLineTokens(line, state);
            const tokens = tokenizedLine.tokens;
      
            if (tokens.length && tokens[tokens.length-1].type == "comment") {
                return indent;
            }
        
            if (state == "start") {
                const match = line.match(/^.*[\{\(\[]\s*$/);
                if (match) {
                    indent += tab;
                }
            }
      
            return indent;
        };

        this.checkOutdent = function(state, line, input) {
            return this.$outdent.checkOutdent(line, input);
        };
      
        this.autoOutdent = function(state, doc, row) {
            this.$outdent.autoOutdent(doc, row);
        };


        this.createWorker = session => null;

        this.$id = "ace/mode/csharp";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});
