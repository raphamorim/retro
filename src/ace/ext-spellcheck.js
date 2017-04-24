ace.define("ace/ext/spellcheck",["require","exports","module","ace/lib/event","ace/editor","ace/config"], (require, exports, module) => {
    const event = require("../lib/event");

    exports.contextMenuHandler = e => {
        const host = e.target;
        const text = host.textInput.getElement();
        if (!host.selection.isEmpty())
            return;
        const c = host.getCursorPosition();
        const r = host.session.getWordRange(c.row, c.column);
        const w = host.session.getTextRange(r);

        host.session.tokenRe.lastIndex = 0;
        if (!host.session.tokenRe.test(w))
            return;
        const PLACEHOLDER = "\x01\x01";
        const value = `${w} ${PLACEHOLDER}`;
        text.value = value;
        text.setSelectionRange(w.length, w.length + 1);
        text.setSelectionRange(0, 0);
        text.setSelectionRange(0, w.length);

        let afterKeydown = false;
        event.addListener(text, "keydown", function onKeydown() {
            event.removeListener(text, "keydown", onKeydown);
            afterKeydown = true;
        });

        host.textInput.setInputHandler(newVal => {
            console.log(newVal , value, text.selectionStart, text.selectionEnd)
            if (newVal == value)
                return '';
            if (newVal.lastIndexOf(value, 0) === 0)
                return newVal.slice(value.length);
            if (newVal.substr(text.selectionEnd) == value)
                return newVal.slice(0, -value.length);
            if (newVal.slice(-2) == PLACEHOLDER) {
                let val = newVal.slice(0, -2);
                if (val.slice(-1) == " ") {
                    if (afterKeydown)
                        return val.substring(0, text.selectionEnd);
                    val = val.slice(0, -1);
                    host.session.replace(r, val);
                    return "";
                }
            }

            return newVal;
        });
    };
    const Editor = require("../editor").Editor;
    require("../config").defineOptions(Editor.prototype, "editor", {
        spellcheck: {
            set(val) {
                const text = this.textInput.getElement();
                text.spellcheck = !!val;
                if (!val)
                    this.removeListener("nativecontextmenu", exports.contextMenuHandler);
                else
                    this.on("nativecontextmenu", exports.contextMenuHandler);
            },
            value: true
        }
    });
});
                ((() => {
                    ace.require(["ace/ext/spellcheck"], () => {});
                }))();
            