ace.define("ace/ext/searchbox",["require","exports","module","ace/lib/dom","ace/lib/lang","ace/lib/event","ace/keyboard/hash_handler","ace/lib/keys"], (require, exports, module) => {
    const dom = require("../lib/dom");
    const lang = require("../lib/lang");
    const event = require("../lib/event");
    const searchboxCss = "\
    .ace_search {\
    background-color: #ddd;\
    border: 1px solid #cbcbcb;\
    border-top: 0 none;\
    max-width: 325px;\
    overflow: hidden;\
    margin: 0;\
    padding: 4px;\
    padding-right: 6px;\
    padding-bottom: 0;\
    position: absolute;\
    top: 0px;\
    z-index: 99;\
    white-space: normal;\
    }\
    .ace_search.left {\
    border-left: 0 none;\
    border-radius: 0px 0px 5px 0px;\
    left: 0;\
    }\
    .ace_search.right {\
    border-radius: 0px 0px 0px 5px;\
    border-right: 0 none;\
    right: 0;\
    }\
    .ace_search_form, .ace_replace_form {\
    border-radius: 3px;\
    border: 1px solid #cbcbcb;\
    float: left;\
    margin-bottom: 4px;\
    overflow: hidden;\
    }\
    .ace_search_form.ace_nomatch {\
    outline: 1px solid red;\
    }\
    .ace_search_field {\
    background-color: white;\
    border-right: 1px solid #cbcbcb;\
    border: 0 none;\
    -webkit-box-sizing: border-box;\
    -moz-box-sizing: border-box;\
    box-sizing: border-box;\
    float: left;\
    height: 22px;\
    outline: 0;\
    padding: 0 7px;\
    width: 214px;\
    margin: 0;\
    }\
    .ace_searchbtn,\
    .ace_replacebtn {\
    background: #fff;\
    border: 0 none;\
    border-left: 1px solid #dcdcdc;\
    cursor: pointer;\
    float: left;\
    height: 22px;\
    margin: 0;\
    position: relative;\
    }\
    .ace_searchbtn:last-child,\
    .ace_replacebtn:last-child {\
    border-top-right-radius: 3px;\
    border-bottom-right-radius: 3px;\
    }\
    .ace_searchbtn:disabled {\
    background: none;\
    cursor: default;\
    }\
    .ace_searchbtn {\
    background-position: 50% 50%;\
    background-repeat: no-repeat;\
    width: 27px;\
    }\
    .ace_searchbtn.prev {\
    background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAFCAYAAAB4ka1VAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAADFJREFUeNpiSU1NZUAC/6E0I0yACYskCpsJiySKIiY0SUZk40FyTEgCjGgKwTRAgAEAQJUIPCE+qfkAAAAASUVORK5CYII=);    \
    }\
    .ace_searchbtn.next {\
    background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAFCAYAAAB4ka1VAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAADRJREFUeNpiTE1NZQCC/0DMyIAKwGJMUAYDEo3M/s+EpvM/mkKwCQxYjIeLMaELoLMBAgwAU7UJObTKsvAAAAAASUVORK5CYII=);    \
    }\
    .ace_searchbtn_close {\
    background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAcCAYAAABRVo5BAAAAZ0lEQVR42u2SUQrAMAhDvazn8OjZBilCkYVVxiis8H4CT0VrAJb4WHT3C5xU2a2IQZXJjiQIRMdkEoJ5Q2yMqpfDIo+XY4k6h+YXOyKqTIj5REaxloNAd0xiKmAtsTHqW8sR2W5f7gCu5nWFUpVjZwAAAABJRU5ErkJggg==) no-repeat 50% 0;\
    border-radius: 50%;\
    border: 0 none;\
    color: #656565;\
    cursor: pointer;\
    float: right;\
    font: 16px/16px Arial;\
    height: 14px;\
    margin: 5px 1px 9px 5px;\
    padding: 0;\
    text-align: center;\
    width: 14px;\
    }\
    .ace_searchbtn_close:hover {\
    background-color: #656565;\
    background-position: 50% 100%;\
    color: white;\
    }\
    .ace_replacebtn.prev {\
    width: 54px\
    }\
    .ace_replacebtn.next {\
    width: 27px\
    }\
    .ace_button {\
    margin-left: 2px;\
    cursor: pointer;\
    -webkit-user-select: none;\
    -moz-user-select: none;\
    -o-user-select: none;\
    -ms-user-select: none;\
    user-select: none;\
    overflow: hidden;\
    opacity: 0.7;\
    border: 1px solid rgba(100,100,100,0.23);\
    padding: 1px;\
    -moz-box-sizing: border-box;\
    box-sizing:    border-box;\
    color: black;\
    }\
    .ace_button:hover {\
    background-color: #eee;\
    opacity:1;\
    }\
    .ace_button:active {\
    background-color: #ddd;\
    }\
    .ace_button.checked {\
    border-color: #3399ff;\
    opacity:1;\
    }\
    .ace_search_options{\
    margin-bottom: 3px;\
    text-align: right;\
    -webkit-user-select: none;\
    -moz-user-select: none;\
    -o-user-select: none;\
    -ms-user-select: none;\
    user-select: none;\
    }";
    const HashHandler = require("../keyboard/hash_handler").HashHandler;
    const keyUtil = require("../lib/keys");

    dom.importCssString(searchboxCss, "ace_searchbox");

    const html = '<div class="ace_search right">\
        <button type="button" action="hide" class="ace_searchbtn_close"></button>\
        <div class="ace_search_form">\
            <input class="ace_search_field" placeholder="Search for" spellcheck="false"></input>\
            <button type="button" action="findNext" class="ace_searchbtn next"></button>\
            <button type="button" action="findPrev" class="ace_searchbtn prev"></button>\
            <button type="button" action="findAll" class="ace_searchbtn" title="Alt-Enter">All</button>\
        </div>\
        <div class="ace_replace_form">\
            <input class="ace_search_field" placeholder="Replace with" spellcheck="false"></input>\
            <button type="button" action="replaceAndFindNext" class="ace_replacebtn">Replace</button>\
            <button type="button" action="replaceAll" class="ace_replacebtn">All</button>\
        </div>\
        <div class="ace_search_options">\
            <span action="toggleRegexpMode" class="ace_button" title="RegExp Search">.*</span>\
            <span action="toggleCaseSensitive" class="ace_button" title="CaseSensitive Search">Aa</span>\
            <span action="toggleWholeWords" class="ace_button" title="Whole Word Search">\\b</span>\
        </div>\
    </div>'.replace(/>\s+/g, ">");

    const SearchBox = function(editor, range, showReplaceForm) {
        const div = dom.createElement("div");
        div.innerHTML = html;
        this.element = div.firstChild;

        this.$init();
        this.setEditor(editor);
    };

    (function() {
        this.setEditor = function(editor) {
            editor.searchBox = this;
            editor.container.appendChild(this.element);
            this.editor = editor;
        };

        this.$initElements = function(sb) {
            this.searchBox = sb.querySelector(".ace_search_form");
            this.replaceBox = sb.querySelector(".ace_replace_form");
            this.searchOptions = sb.querySelector(".ace_search_options");
            this.regExpOption = sb.querySelector("[action=toggleRegexpMode]");
            this.caseSensitiveOption = sb.querySelector("[action=toggleCaseSensitive]");
            this.wholeWordOption = sb.querySelector("[action=toggleWholeWords]");
            this.searchInput = this.searchBox.querySelector(".ace_search_field");
            this.replaceInput = this.replaceBox.querySelector(".ace_search_field");
        };
        
        this.$init = function() {
            const sb = this.element;
            
            this.$initElements(sb);
            
            const _this = this;
            event.addListener(sb, "mousedown", e => {
                setTimeout(() => {
                    _this.activeInput.focus();
                }, 0);
                event.stopPropagation(e);
            });
            event.addListener(sb, "click", e => {
                const t = e.target || e.srcElement;
                const action = t.getAttribute("action");
                if (action && _this[action])
                    _this[action]();
                else if (_this.$searchBarKb.commands[action])
                    _this.$searchBarKb.commands[action].exec(_this);
                event.stopPropagation(e);
            });

            event.addCommandKeyListener(sb, (e, hashId, keyCode) => {
                const keyString = keyUtil.keyCodeToString(keyCode);
                const command = _this.$searchBarKb.findKeyCommand(hashId, keyString);
                if (command && command.exec) {
                    command.exec(_this);
                    event.stopEvent(e);
                }
            });

            this.$onChange = lang.delayedCall(() => {
                _this.find(false, false);
            });

            event.addListener(this.searchInput, "input", () => {
                _this.$onChange.schedule(20);
            });
            event.addListener(this.searchInput, "focus", () => {
                _this.activeInput = _this.searchInput;
                _this.searchInput.value && _this.highlight();
            });
            event.addListener(this.replaceInput, "focus", () => {
                _this.activeInput = _this.replaceInput;
                _this.searchInput.value && _this.highlight();
            });
        };
        this.$closeSearchBarKb = new HashHandler([{
            bindKey: "Esc",
            name: "closeSearchBar",
            exec(editor) {
                editor.searchBox.hide();
            }
        }]);
        this.$searchBarKb = new HashHandler();
        this.$searchBarKb.bindKeys({
            "Ctrl-f|Command-f"(sb) {
                const isReplace = sb.isReplace = !sb.isReplace;
                sb.replaceBox.style.display = isReplace ? "" : "none";
                sb.searchInput.focus();
            },
            "Ctrl-H|Command-Option-F"(sb) {
                sb.replaceBox.style.display = "";
                sb.replaceInput.focus();
            },
            "Ctrl-G|Command-G"(sb) {
                sb.findNext();
            },
            "Ctrl-Shift-G|Command-Shift-G"(sb) {
                sb.findPrev();
            },
            "esc"(sb) {
                setTimeout(() => { sb.hide();});
            },
            "Return"(sb) {
                if (sb.activeInput == sb.replaceInput)
                    sb.replace();
                sb.findNext();
            },
            "Shift-Return"(sb) {
                if (sb.activeInput == sb.replaceInput)
                    sb.replace();
                sb.findPrev();
            },
            "Alt-Return"(sb) {
                if (sb.activeInput == sb.replaceInput)
                    sb.replaceAll();
                sb.findAll();
            },
            "Tab"(sb) {
                (sb.activeInput == sb.replaceInput ? sb.searchInput : sb.replaceInput).focus();
            }
        });

        this.$searchBarKb.addCommands([{
            name: "toggleRegexpMode",
            bindKey: {win: "Alt-R|Alt-/", mac: "Ctrl-Alt-R|Ctrl-Alt-/"},
            exec(sb) {
                sb.regExpOption.checked = !sb.regExpOption.checked;
                sb.$syncOptions();
            }
        }, {
            name: "toggleCaseSensitive",
            bindKey: {win: "Alt-C|Alt-I", mac: "Ctrl-Alt-R|Ctrl-Alt-I"},
            exec(sb) {
                sb.caseSensitiveOption.checked = !sb.caseSensitiveOption.checked;
                sb.$syncOptions();
            }
        }, {
            name: "toggleWholeWords",
            bindKey: {win: "Alt-B|Alt-W", mac: "Ctrl-Alt-B|Ctrl-Alt-W"},
            exec(sb) {
                sb.wholeWordOption.checked = !sb.wholeWordOption.checked;
                sb.$syncOptions();
            }
        }]);

        this.$syncOptions = function() {
            dom.setCssClass(this.regExpOption, "checked", this.regExpOption.checked);
            dom.setCssClass(this.wholeWordOption, "checked", this.wholeWordOption.checked);
            dom.setCssClass(this.caseSensitiveOption, "checked", this.caseSensitiveOption.checked);
            this.find(false, false);
        };

        this.highlight = function(re) {
            this.editor.session.highlight(re || this.editor.$search.$options.re);
            this.editor.renderer.updateBackMarkers()
        };
        this.find = function(skipCurrent, backwards, preventScroll) {
            const range = this.editor.find(this.searchInput.value, {
                skipCurrent,
                backwards,
                wrap: true,
                regExp: this.regExpOption.checked,
                caseSensitive: this.caseSensitiveOption.checked,
                wholeWord: this.wholeWordOption.checked,
                preventScroll
            });
            dom.setCssClass(this.searchBox, "ace_nomatch", !range && this.searchInput.value);
            this.highlight();
        };
        this.findNext = function() {
            this.find(true, false);
        };
        this.findPrev = function() {
            this.find(true, true);
        };
        this.findAll = function(){
            const range = this.editor.findAll(this.searchInput.value, {            
                regExp: this.regExpOption.checked,
                caseSensitive: this.caseSensitiveOption.checked,
                wholeWord: this.wholeWordOption.checked
            });
            const noMatch = !range && this.searchInput.value;
            dom.setCssClass(this.searchBox, "ace_nomatch", noMatch);
            this.editor._emit("findSearchBox", { match: !noMatch });
            this.highlight();
            this.hide();
        };
        this.replace = function() {
            if (!this.editor.getReadOnly())
                this.editor.replace(this.replaceInput.value);
        };    
        this.replaceAndFindNext = function() {
            if (!this.editor.getReadOnly()) {
                this.editor.replace(this.replaceInput.value);
                this.findNext()
            }
        };
        this.replaceAll = function() {
            if (!this.editor.getReadOnly())
                this.editor.replaceAll(this.replaceInput.value);
        };

        this.hide = function() {
            this.element.style.display = "none";
            this.editor.keyBinding.removeKeyboardHandler(this.$closeSearchBarKb);
            this.editor.focus();
        };
        this.show = function(value, isReplace) {
            this.element.style.display = "";
            this.replaceBox.style.display = isReplace ? "" : "none";

            this.isReplace = isReplace;

            if (value)
                this.searchInput.value = value;
            
            this.find(false, false, true);
            
            this.searchInput.focus();
            this.searchInput.select();

            this.editor.keyBinding.addKeyboardHandler(this.$closeSearchBarKb);
        };

        this.isFocused = function() {
            const el = document.activeElement;
            return el == this.searchInput || el == this.replaceInput;
        }
    }).call(SearchBox.prototype);

    exports.SearchBox = SearchBox;

    exports.Search = (editor, isReplace) => {
        const sb = editor.searchBox || new SearchBox(editor);
        sb.show(editor.session.getTextRange(), isReplace);
    };
});
                ((() => {
                    ace.require(["ace/ext/searchbox"], () => {});
                }))();
            