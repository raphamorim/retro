ace.define("ace/mode/plain_text",["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/text_highlight_rules","ace/mode/behaviour"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const TextMode = require("./text").Mode;
    const TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;
    const Behaviour = require("./behaviour").Behaviour;

    const Mode = function() {
        this.HighlightRules = TextHighlightRules;
        this.$behaviour = new Behaviour();
    };

    oop.inherits(Mode, TextMode);

    (function() {
        this.type = "text";
        this.getNextLineIndent = (state, line, tab) => '';
        this.$id = "ace/mode/plain_text";
    }).call(Mode.prototype);

    exports.Mode = Mode;
});
