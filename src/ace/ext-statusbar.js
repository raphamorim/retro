ace.define("ace/ext/statusbar",["require","exports","module","ace/lib/dom","ace/lib/lang"], (require, exports, module) => {
    const dom = require("ace/lib/dom");
    const lang = require("ace/lib/lang");

    const StatusBar = function(editor, parentNode) {
        this.element = dom.createElement("div");
        this.element.className = "ace_status-indicator";
        this.element.style.cssText = "display: inline-block;";
        parentNode.appendChild(this.element);

        const statusUpdate = lang.delayedCall(() => {
            this.updateStatus(editor)
        }).schedule.bind(null, 100);
        
        editor.on("changeStatus", statusUpdate);
        editor.on("changeSelection", statusUpdate);
        editor.on("keyboardActivity", statusUpdate);
    };

    (function(){
        this.updateStatus = function(editor) {
            const status = [];
            function add(str, separator) {
                str && status.push(str, separator || "|");
            }

            add(editor.keyBinding.getStatusText(editor));
            if (editor.commands.recording)
                add("REC");
            
            const sel = editor.selection;
            const c = sel.lead;
            
            if (!sel.isEmpty()) {
                const r = editor.getSelectionRange();
                add(`(${r.end.row - r.start.row}:${r.end.column - r.start.column})`, " ");
            }
            add(`${c.row}:${c.column}`, " ");        
            if (sel.rangeCount)
                add(`[${sel.rangeCount}]`, " ");
            status.pop();
            this.element.textContent = status.join("");
        };
    }).call(StatusBar.prototype);

    exports.StatusBar = StatusBar;
});
                ((() => {
                    ace.require(["ace/ext/statusbar"], () => {});
                }))();
            