ace.define("ace/mode/perl_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/text_highlight_rules"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    const PerlHighlightRules = function() {

        const keywords = (
            "base|constant|continue|else|elsif|for|foreach|format|goto|if|last|local|my|next|" +
             "no|package|parent|redo|require|scalar|sub|unless|until|while|use|vars"
        );

        const buildinConstants = ("ARGV|ENV|INC|SIG");

        const builtinFunctions = (
            "getprotobynumber|getprotobyname|getservbyname|gethostbyaddr|" +
             "gethostbyname|getservbyport|getnetbyaddr|getnetbyname|getsockname|" +
             "getpeername|setpriority|getprotoent|setprotoent|getpriority|" +
             "endprotoent|getservent|setservent|endservent|sethostent|socketpair|" +
             "getsockopt|gethostent|endhostent|setsockopt|setnetent|quotemeta|" +
             "localtime|prototype|getnetent|endnetent|rewinddir|wantarray|getpwuid|" +
             "closedir|getlogin|readlink|endgrent|getgrgid|getgrnam|shmwrite|" +
             "shutdown|readline|endpwent|setgrent|readpipe|formline|truncate|" +
             "dbmclose|syswrite|setpwent|getpwnam|getgrent|getpwent|ucfirst|sysread|" +
             "setpgrp|shmread|sysseek|sysopen|telldir|defined|opendir|connect|" +
             "lcfirst|getppid|binmode|syscall|sprintf|getpgrp|readdir|seekdir|" +
             "waitpid|reverse|unshift|symlink|dbmopen|semget|msgrcv|rename|listen|" +
             "chroot|msgsnd|shmctl|accept|unpack|exists|fileno|shmget|system|" +
             "unlink|printf|gmtime|msgctl|semctl|values|rindex|substr|splice|" +
             "length|msgget|select|socket|return|caller|delete|alarm|ioctl|index|" +
             "undef|lstat|times|srand|chown|fcntl|close|write|umask|rmdir|study|" +
             "sleep|chomp|untie|print|utime|mkdir|atan2|split|crypt|flock|chmod|" +
             "BEGIN|bless|chdir|semop|shift|reset|link|stat|chop|grep|fork|dump|" +
             "join|open|tell|pipe|exit|glob|warn|each|bind|sort|pack|eval|push|" +
             "keys|getc|kill|seek|sqrt|send|wait|rand|tied|read|time|exec|recv|" +
             "eof|chr|int|ord|exp|pos|pop|sin|log|abs|oct|hex|tie|cos|vec|END|ref|" +
             "map|die|uc|lc|do"
        );

        const keywordMapper = this.createKeywordMapper({
            "keyword": keywords,
            "constant.language": buildinConstants,
            "support.function": builtinFunctions
        }, "identifier");

        this.$rules = {
            "start" : [
                {
                    token : "comment.doc",
                    regex : "^=(?:begin|item)\\b",
                    next : "block_comment"
                }, {
                    token : "string.regexp",
                    regex : "[/](?:(?:\\[(?:\\\\]|[^\\]])+\\])|(?:\\\\/|[^\\]/]))*[/]\\w*\\s*(?=[).,;]|$)"
                }, {
                    token : "string", // single line
                    regex : '["](?:(?:\\\\.)|(?:[^"\\\\]))*?["]'
                }, {
                    token : "string", // multi line string start
                    regex : '["].*\\\\$',
                    next : "qqstring"
                }, {
                    token : "string", // single line
                    regex : "['](?:(?:\\\\.)|(?:[^'\\\\]))*?[']"
                }, {
                    token : "string", // multi line string start
                    regex : "['].*\\\\$",
                    next : "qstring"
                }, {
                    token : "constant.numeric", // hex
                    regex : "0x[0-9a-fA-F]+\\b"
                }, {
                    token : "constant.numeric", // float
                    regex : "[+-]?\\d+(?:(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)?\\b"
                }, {
                    token : keywordMapper,
                    regex : "[a-zA-Z_$][a-zA-Z0-9_$]*\\b"
                }, {
                    token : "keyword.operator",
                    regex : "%#|\\$#|\\.\\.\\.|\\|\\|=|>>=|<<=|<=>|&&=|=>|!~|\\^=|&=|\\|=|\\.=|x=|%=|\\/=|\\*=|\\-=|\\+=|=~|\\*\\*|\\-\\-|\\.\\.|\\|\\||&&|\\+\\+|\\->|!=|==|>=|<=|>>|<<|,|=|\\?\\:|\\^|\\||x|%|\\/|\\*|<|&|\\\\|~|!|>|\\.|\\-|\\+|\\-C|\\-b|\\-S|\\-u|\\-t|\\-p|\\-l|\\-d|\\-f|\\-g|\\-s|\\-z|\\-k|\\-e|\\-O|\\-T|\\-B|\\-M|\\-A|\\-X|\\-W|\\-c|\\-R|\\-o|\\-x|\\-w|\\-r|\\b(?:and|cmp|eq|ge|gt|le|lt|ne|not|or|xor)"
                }, {
                    token : "comment",
                    regex : "#.*$"
                }, {
                    token : "lparen",
                    regex : "[[({]"
                }, {
                    token : "rparen",
                    regex : "[\\])}]"
                }, {
                    token : "text",
                    regex : "\\s+"
                }
            ],
            "qqstring" : [
                {
                    token : "string",
                    regex : '(?:(?:\\\\.)|(?:[^"\\\\]))*?"',
                    next : "start"
                }, {
                    token : "string",
                    regex : '.+'
                }
            ],
            "qstring" : [
                {
                    token : "string",
                    regex : "(?:(?:\\\\.)|(?:[^'\\\\]))*?'",
                    next : "start"
                }, {
                    token : "string",
                    regex : '.+'
                }
            ],
            "block_comment": [
                {
                    token: "comment.doc", 
                    regex: "^=cut\\b",
                    next: "start"
                },
                {
                    defaultToken: "comment.doc"
                }
            ]
        };
    };

    oop.inherits(PerlHighlightRules, TextHighlightRules);

    exports.PerlHighlightRules = PerlHighlightRules;
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

ace.define("ace/mode/perl",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/perl_highlight_rules","ace/mode/matching_brace_outdent","ace/range","ace/mode/folding/cstyle"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextMode = require("./text").Mode;
    const PerlHighlightRules = require("./perl_highlight_rules").PerlHighlightRules;
    const MatchingBraceOutdent = require("./matching_brace_outdent").MatchingBraceOutdent;
    const Range = require("../range").Range;
    const CStyleFoldMode = require("./folding/cstyle").FoldMode;

    const Mode = function() {
        this.HighlightRules = PerlHighlightRules;
        
        this.$outdent = new MatchingBraceOutdent();
        this.foldingRules = new CStyleFoldMode({start: "^=(begin|item)\\b", end: "^=(cut)\\b"});
    };
    oop.inherits(Mode, TextMode);

    (function() {

        this.lineCommentStart = "#";
        this.blockComment = [
            {start: "=begin", end: "=cut", lineStartOnly: true},
            {start: "=item", end: "=cut", lineStartOnly: true}
        ];


        this.getNextLineIndent = function(state, line, tab) {
            let indent = this.$getIndent(line);

            const tokenizedLine = this.getTokenizer().getLineTokens(line, state);
            const tokens = tokenizedLine.tokens;

            if (tokens.length && tokens[tokens.length-1].type == "comment") {
                return indent;
            }

            if (state == "start") {
                const match = line.match(/^.*[\{\(\[:]\s*$/);
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

        this.$id = "ace/mode/perl";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});
