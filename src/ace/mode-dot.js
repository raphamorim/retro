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

ace.define("ace/mode/dot_highlight_rules",["require","exports","module","ace/lib/oop","ace/lib/lang","ace/mode/text_highlight_rules","ace/mode/doc_comment_highlight_rules"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const lang = require("../lib/lang");
    const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;
    const DocCommentHighlightRules = require("./doc_comment_highlight_rules").DocCommentHighlightRules;

    const DotHighlightRules = function() {

       const keywords = lang.arrayToMap(
            ("strict|node|edge|graph|digraph|subgraph").split("|")
       );

       const attributes = lang.arrayToMap(
            ("damping|k|url|area|arrowhead|arrowsize|arrowtail|aspect|bb|bgcolor|center|charset|clusterrank|color|colorscheme|comment|compound|concentrate|constraint|decorate|defaultdist|dim|dimen|dir|diredgeconstraints|distortion|dpi|edgeurl|edgehref|edgetarget|edgetooltip|epsilon|esep|fillcolor|fixedsize|fontcolor|fontname|fontnames|fontpath|fontsize|forcelabels|gradientangle|group|headurl|head_lp|headclip|headhref|headlabel|headport|headtarget|headtooltip|height|href|id|image|imagepath|imagescale|label|labelurl|label_scheme|labelangle|labeldistance|labelfloat|labelfontcolor|labelfontname|labelfontsize|labelhref|labeljust|labelloc|labeltarget|labeltooltip|landscape|layer|layerlistsep|layers|layerselect|layersep|layout|len|levels|levelsgap|lhead|lheight|lp|ltail|lwidth|margin|maxiter|mclimit|mindist|minlen|mode|model|mosek|nodesep|nojustify|normalize|nslimit|nslimit1|ordering|orientation|outputorder|overlap|overlap_scaling|pack|packmode|pad|page|pagedir|pencolor|penwidth|peripheries|pin|pos|quadtree|quantum|rank|rankdir|ranksep|ratio|rects|regular|remincross|repulsiveforce|resolution|root|rotate|rotation|samehead|sametail|samplepoints|scale|searchsize|sep|shape|shapefile|showboxes|sides|size|skew|smoothing|sortv|splines|start|style|stylesheet|tailurl|tail_lp|tailclip|tailhref|taillabel|tailport|tailtarget|tailtooltip|target|tooltip|truecolor|vertices|viewport|voro_margin|weight|width|xlabel|xlp|z").split("|")
       );

       this.$rules = {
            "start" : [
                {
                    token : "comment",
                    regex : /\/\/.*$/
                }, {
                    token : "comment",
                    regex : /#.*$/
                }, {
                    token : "comment", // multi line comment
                    merge : true,
                    regex : /\/\*/,
                    next : "comment"
                }, {
                    token : "string",
                    regex : "'(?=.)",
                    next  : "qstring"
                }, {
                    token : "string",
                    regex : '"(?=.)',
                    next  : "qqstring"
                }, {
                    token : "constant.numeric",
                    regex : /[+\-]?\d+(?:(?:\.\d*)?(?:[eE][+\-]?\d+)?)?\b/
                }, {
                    token : "keyword.operator",
                    regex : /\+|=|\->/
                }, {
                    token : "punctuation.operator",
                    regex : /,|;/
                }, {
                    token : "paren.lparen",
                    regex : /[\[{]/
                }, {
                    token : "paren.rparen",
                    regex : /[\]}]/
                }, {
                    token: "comment",
                    regex: /^#!.*$/
                }, {
                    token(value) {
                        if (keywords.hasOwnProperty(value.toLowerCase())) {
                            return "keyword";
                        }
                        else if (attributes.hasOwnProperty(value.toLowerCase())) {
                            return "variable";
                        }
                        else {
                            return "text";
                        }
                    },
                    regex: "\\-?[a-zA-Z_][a-zA-Z0-9_\\-]*"
               }
            ],
            "comment" : [
                {
                    token : "comment", // closing comment
                    regex : ".*?\\*\\/",
                    merge : true,
                    next : "start"
                }, {
                    token : "comment", // comment spanning whole line
                    merge : true,
                    regex : ".+"
                }
            ],
            "qqstring" : [
                {
                    token : "string",
                    regex : '[^"\\\\]+',
                    merge : true
                }, {
                    token : "string",
                    regex : "\\\\$",
                    next  : "qqstring",
                    merge : true
                }, {
                    token : "string",
                    regex : '"|$',
                    next  : "start",
                    merge : true
                }
            ],
            "qstring" : [
                {
                    token : "string",
                    regex : "[^'\\\\]+",
                    merge : true
                }, {
                    token : "string",
                    regex : "\\\\$",
                    next  : "qstring",
                    merge : true
                }, {
                    token : "string",
                    regex : "'|$",
                    next  : "start",
                    merge : true
                }
            ]
       };
    };

    oop.inherits(DotHighlightRules, TextHighlightRules);

    exports.DotHighlightRules = DotHighlightRules;
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

ace.define("ace/mode/dot",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/matching_brace_outdent","ace/mode/dot_highlight_rules","ace/mode/folding/cstyle"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextMode = require("./text").Mode;
    const MatchingBraceOutdent = require("./matching_brace_outdent").MatchingBraceOutdent;
    const DotHighlightRules = require("./dot_highlight_rules").DotHighlightRules;
    const DotFoldMode = require("./folding/cstyle").FoldMode;

    const Mode = function() {
        this.HighlightRules = DotHighlightRules;
        this.$outdent = new MatchingBraceOutdent();
        this.foldingRules = new DotFoldMode();
    };
    oop.inherits(Mode, TextMode);

    (function() {

        this.lineCommentStart = ["//", "#"];
        this.blockComment = {start: "/*", end: "*/"};

        this.getNextLineIndent = function(state, line, tab) {
            let indent = this.$getIndent(line);

            const tokenizedLine = this.getTokenizer().getLineTokens(line, state);
            const tokens = tokenizedLine.tokens;
            const endState = tokenizedLine.state;

            if (tokens.length && tokens[tokens.length-1].type == "comment") {
                return indent;
            }

            if (state == "start") {
                const match = line.match(/^.*(?:\bcase\b.*:|[\{\(\[])\s*$/);
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

        this.$id = "ace/mode/dot";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});
