ace.define("ace/ext/static_highlight",["require","exports","module","ace/edit_session","ace/layer/text","ace/config","ace/lib/dom"], (require, exports, module) => {
    const EditSession = require("../edit_session").EditSession;
    const TextLayer = require("../layer/text").Text;
    const baseStyles = ".ace_static_highlight {\
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', 'Droid Sans Mono', monospace;\
    font-size: 12px;\
    white-space: pre-wrap\
    }\
    .ace_static_highlight .ace_gutter {\
    width: 2em;\
    text-align: right;\
    padding: 0 3px 0 0;\
    margin-right: 3px;\
    }\
    .ace_static_highlight.ace_show_gutter .ace_line {\
    padding-left: 2.6em;\
    }\
    .ace_static_highlight .ace_line { position: relative; }\
    .ace_static_highlight .ace_gutter-cell {\
    -moz-user-select: -moz-none;\
    -khtml-user-select: none;\
    -webkit-user-select: none;\
    user-select: none;\
    top: 0;\
    bottom: 0;\
    left: 0;\
    position: absolute;\
    }\
    .ace_static_highlight .ace_gutter-cell:before {\
    content: counter(ace_line, decimal);\
    counter-increment: ace_line;\
    }\
    .ace_static_highlight {\
    counter-reset: ace_line;\
    }\
    ";
    const config = require("../config");
    const dom = require("../lib/dom");

    const SimpleTextLayer = function() {
        this.config = {};
    };
    SimpleTextLayer.prototype = TextLayer.prototype;

    class highlight {
        constructor(el, opts, callback) {
            const m = el.className.match(/lang-(\w+)/);
            const mode = opts.mode || m && (`ace/mode/${m[1]}`);
            if (!mode)
                return false;
            const theme = opts.theme || "ace/theme/textmate";
            
            let data = "";
            const nodes = [];

            if (el.firstElementChild) {
                let textLen = 0;

                for (const ch of el.childNodes) {
                    if (ch.nodeType == 3) {
                        textLen += ch.data.length;
                        data += ch.data;
                    } else {
                        nodes.push(textLen, ch);
                    }
                }
            } else {
                data = dom.getInnerText(el);
                if (opts.trim)
                    data = data.trim();
            }
            
            highlight.render(data, mode, theme, opts.firstLineNumber, !opts.showGutter, highlighted => {
                dom.importCssString(highlighted.css, "ace_highlight");
                el.innerHTML = highlighted.html;
                const container = el.firstChild.firstChild;
                for (let i = 0; i < nodes.length; i += 2) {
                    const pos = highlighted.session.doc.indexToPosition(nodes[i]);
                    const node = nodes[i + 1];
                    const lineEl = container.children[pos.row];
                    lineEl && lineEl.appendChild(node);
                }
                callback && callback();
            });
        }

        static render(input, mode, theme, lineStart, disableGutter, callback) {
            let waiting = 1;
            const modeCache = EditSession.prototype.$modes;
            if (typeof theme == "string") {
                waiting++;
                config.loadModule(['theme', theme], m => {
                    theme = m;
                    --waiting || done();
                });
            }
            let modeOptions;
            if (mode && typeof mode === "object" && !mode.getTokenizer) {
                modeOptions = mode;
                mode = modeOptions.path;
            }
            if (typeof mode == "string") {
                waiting++;
                config.loadModule(['mode', mode], m => {
                    if (!modeCache[mode] || modeOptions)
                        modeCache[mode] = new m.Mode(modeOptions);
                    mode = modeCache[mode];
                    --waiting || done();
                });
            }
            function done() {
                const result = highlight.renderSync(input, mode, theme, lineStart, disableGutter);
                return callback ? callback(result) : result;
            }
            return --waiting || done();
        }

        static renderSync(input, mode, theme, lineStart, disableGutter) {
            lineStart = parseInt(lineStart || 1, 10);

            const session = new EditSession("");
            session.setUseWorker(false);
            session.setMode(mode);

            const textLayer = new SimpleTextLayer();
            textLayer.setSession(session);

            session.setValue(input);

            const stringBuilder = [];
            const length =  session.getLength();

            for(let ix = 0; ix < length; ix++) {
                stringBuilder.push("<div class='ace_line'>");
                if (!disableGutter)
                    stringBuilder.push("<span class='ace_gutter ace_gutter-cell' unselectable='on'>" + /*(ix + lineStart) + */ "</span>");
                textLayer.$renderLine(stringBuilder, ix, true, false);
                stringBuilder.push("\n</div>");
            }
            const html = `<div class='${theme.cssClass}'><div class='ace_static_highlight${disableGutter ? "" : " ace_show_gutter"}' style='counter-reset:ace_line ${lineStart - 1}'>${stringBuilder.join("")}</div></div>`;

            textLayer.destroy();

            return {
                css: baseStyles + theme.cssText,
                html,
                session
            };
        }
    }

    module.exports = highlight;
    module.exports.highlight =highlight;
});
                ((() => {
                    ace.require(["ace/ext/static_highlight"], () => {});
                }))();
            