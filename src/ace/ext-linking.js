ace.define("ace/ext/linking",["require","exports","module","ace/editor","ace/config"], (require, exports, module) => {

const Editor = require("ace/editor").Editor;

require("../config").defineOptions(Editor.prototype, "editor", {
    enableLinking: {
        set(val) {
            if (val) {
                this.on("click", onClick);
                this.on("mousemove", onMouseMove);
            } else {
                this.off("click", onClick);
                this.off("mousemove", onMouseMove);
            }
        },
        value: false
    }
})

function onMouseMove(e) {
    var editor = e.editor;
    const ctrl = e.getAccelKey();

    if (ctrl) {
        var editor = e.editor;
        const docPos = e.getDocumentPosition();
        const session = editor.session;
        const token = session.getTokenAt(docPos.row, docPos.column);

        editor._emit("linkHover", {position: docPos, token});
    }
}

function onClick(e) {
    const ctrl = e.getAccelKey();
    const button = e.getButton();

    if (button == 0 && ctrl) {
        const editor = e.editor;
        const docPos = e.getDocumentPosition();
        const session = editor.session;
        const token = session.getTokenAt(docPos.row, docPos.column);

        editor._emit("linkClick", {position: docPos, token});
    }
}

});
                ((() => {
                    ace.require(["ace/ext/linking"], () => {});
                }))();
            