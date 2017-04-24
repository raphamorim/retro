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

ace.define("ace/mode/lean_highlight_rules",["require","exports","module","ace/lib/oop","ace/mode/doc_comment_highlight_rules","ace/mode/text_highlight_rules"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const DocCommentHighlightRules = require("./doc_comment_highlight_rules").DocCommentHighlightRules;
    const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

    const leanHighlightRules = function() {

        const keywordControls = (
            [ "add_rewrite", "alias", "as", "assume", "attribute",
              "begin", "by", "calc", "calc_refl", "calc_subst", "calc_trans", "check",
              "classes", "coercions", "conjecture", "constants", "context",
              "corollary", "else", "end", "environment", "eval", "example",
              "exists", "exit", "export", "exposing", "extends", "fields", "find_decl",
              "forall", "from", "fun", "have", "help", "hiding", "if",
              "import", "in", "infix", "infixl", "infixr", "instances",
              "let", "local", "match", "namespace", "notation", "obtain", "obtains",
              "omit", "opaque", "open", "options", "parameter", "parameters", "postfix",
              "precedence", "prefix", "premise", "premises", "print", "private", "proof",
              "protected", "qed", "raw", "renaming", "section", "set_option",
              "show", "tactic_hint", "take", "then", "universe",
              "universes", "using", "variable", "variables", "with"].join("|")
        );

        const nameProviders = (
            ["inductive", "structure", "record", "theorem", "axiom",
             "axioms", "lemma", "hypothesis", "definition", "constant"].join("|")
        );

        const storageType = (
            ["Prop", "Type", "Type'", "Type₊", "Type₁", "Type₂", "Type₃"].join("|")
        );

        const storageModifiers = (
            `\\[(${["abbreviations", "all-transparent", "begin-end-hints", "class", "classes", "coercion",
 "coercions", "declarations", "decls", "instance", "irreducible",
 "multiple-instances", "notation", "notations", "parsing-only", "persistent",
 "reduce-hints", "reducible", "tactic-hints", "visible", "wf", "whnf"
].join("|")})\\]`
        );

        const keywordOperators = (
            [].join("|")
        );

        const keywordMapper = this.$keywords = this.createKeywordMapper({
            "keyword.control" : keywordControls,
            "storage.type" : storageType,
            "keyword.operator" : keywordOperators,
            "variable.language": "sorry"
        }, "identifier");

        const identifierRe = "[A-Za-z_\u03b1-\u03ba\u03bc-\u03fb\u1f00-\u1ffe\u2100-\u214f][A-Za-z0-9_'\u03b1-\u03ba\u03bc-\u03fb\u1f00-\u1ffe\u2070-\u2079\u207f-\u2089\u2090-\u209c\u2100-\u214f]*";
        const operatorRe = new RegExp(["#", "@", "->", "∼", "↔", "/", "==", "=", ":=", "<->",
                                     "/\\", "\\/", "∧", "∨", "≠", "<", ">", "≤", "≥", "¬",
                                     "<=", ">=", "⁻¹", "⬝", "▸", "\\+", "\\*", "-", "/",
                                     "λ", "→", "∃", "∀", ":="].join("|"));

        this.$rules = {
            "start" : [
                {
                    token : "comment", // single line comment "--"
                    regex : "--.*$"
                },
                DocCommentHighlightRules.getStartRule("doc-start"),
                {
                    token : "comment", // multi line comment "/-"
                    regex : "\\/-",
                    next : "comment"
                }, {
                    stateName: "qqstring",
                    token : "string.start", regex : '"', next : [
                        {token : "string.end", regex : '"', next : "start"},
                        {token : "constant.language.escape", regex : /\\[n"\\]/},
                        {defaultToken: "string"}
                    ]
                }, {
                    token : "keyword.control", regex : nameProviders, next : [
                        {token : "variable.language", regex : identifierRe, next : "start"} ]
                }, {
                    token : "constant.numeric", // hex
                    regex : "0[xX][0-9a-fA-F]+(L|l|UL|ul|u|U|F|f|ll|LL|ull|ULL)?\\b"
                }, {
                    token : "constant.numeric", // float
                    regex : "[+-]?\\d+(?:(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)?(L|l|UL|ul|u|U|F|f|ll|LL|ull|ULL)?\\b"
                }, {
                    token : "storage.modifier",
                    regex : storageModifiers
                }, {
                    token : keywordMapper,
                    regex : identifierRe
                }, {
                    token : "operator",
                    regex : operatorRe
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
            "comment" : [ {token: "comment", regex: "-/", next: "start"},
                          {defaultToken: "comment"} ]
        };

        this.embedRules(DocCommentHighlightRules, "doc-",
            [ DocCommentHighlightRules.getEndRule("start") ]);
        this.normalizeRules();
    };

    oop.inherits(leanHighlightRules, TextHighlightRules);

    exports.leanHighlightRules = leanHighlightRules;
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

ace.define("ace/mode/lean",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/lean_highlight_rules","ace/mode/matching_brace_outdent","ace/range"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextMode = require("./text").Mode;
    const leanHighlightRules = require("./lean_highlight_rules").leanHighlightRules;
    const MatchingBraceOutdent = require("./matching_brace_outdent").MatchingBraceOutdent;
    const Range = require("../range").Range;

    const Mode = function() {
        this.HighlightRules = leanHighlightRules;

        this.$outdent = new MatchingBraceOutdent();
    };
    oop.inherits(Mode, TextMode);

    (function() {

        this.lineCommentStart = "--";
        this.blockComment = {start: "/-", end: "-/"};

        this.getNextLineIndent = function(state, line, tab) {
            let indent = this.$getIndent(line);

            const tokenizedLine = this.getTokenizer().getLineTokens(line, state);
            const tokens = tokenizedLine.tokens;
            const endState = tokenizedLine.state;

            if (tokens.length && tokens[tokens.length-1].type == "comment") {
                return indent;
            }

            if (state == "start") {
                var match = line.match(/^.*[\{\(\[]\s*$/);
                if (match) {
                    indent += tab;
                }
            } else if (state == "doc-start") {
                if (endState == "start") {
                    return "";
                }
                var match = line.match(/^\s*(\/?)\*/);
                if (match) {
                    if (match[1]) {
                        indent += " ";
                    }
                    indent += "- ";
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

        this.$id = "ace/mode/lean";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});
