ace.define("ace/theme/textmate",["require","exports","module","ace/lib/dom"], (require, exports, module) => {
    exports.isDark = false;
    exports.cssClass = "ace-tm";
    exports.cssText = ".ace-tm .ace_gutter {\
    background: #f0f0f0;\
    color: #333;\
    }\
    .ace-tm .ace_print-margin {\
    width: 1px;\
    background: #e8e8e8;\
    }\
    .ace-tm .ace_fold {\
    background-color: #6B72E6;\
    }\
    .ace-tm {\
    background-color: #FFFFFF;\
    color: black;\
    }\
    .ace-tm .ace_cursor {\
    color: black;\
    }\
    .ace-tm .ace_invisible {\
    color: rgb(191, 191, 191);\
    }\
    .ace-tm .ace_storage,\
    .ace-tm .ace_keyword {\
    color: blue;\
    }\
    .ace-tm .ace_constant {\
    color: rgb(197, 6, 11);\
    }\
    .ace-tm .ace_constant.ace_buildin {\
    color: rgb(88, 72, 246);\
    }\
    .ace-tm .ace_constant.ace_language {\
    color: rgb(88, 92, 246);\
    }\
    .ace-tm .ace_constant.ace_library {\
    color: rgb(6, 150, 14);\
    }\
    .ace-tm .ace_invalid {\
    background-color: rgba(255, 0, 0, 0.1);\
    color: red;\
    }\
    .ace-tm .ace_support.ace_function {\
    color: rgb(60, 76, 114);\
    }\
    .ace-tm .ace_support.ace_constant {\
    color: rgb(6, 150, 14);\
    }\
    .ace-tm .ace_support.ace_type,\
    .ace-tm .ace_support.ace_class {\
    color: rgb(109, 121, 222);\
    }\
    .ace-tm .ace_keyword.ace_operator {\
    color: rgb(104, 118, 135);\
    }\
    .ace-tm .ace_string {\
    color: rgb(3, 106, 7);\
    }\
    .ace-tm .ace_comment {\
    color: rgb(76, 136, 107);\
    }\
    .ace-tm .ace_comment.ace_doc {\
    color: rgb(0, 102, 255);\
    }\
    .ace-tm .ace_comment.ace_doc.ace_tag {\
    color: rgb(128, 159, 191);\
    }\
    .ace-tm .ace_constant.ace_numeric {\
    color: rgb(0, 0, 205);\
    }\
    .ace-tm .ace_variable {\
    color: rgb(49, 132, 149);\
    }\
    .ace-tm .ace_xml-pe {\
    color: rgb(104, 104, 91);\
    }\
    .ace-tm .ace_entity.ace_name.ace_function {\
    color: #0000A2;\
    }\
    .ace-tm .ace_heading {\
    color: rgb(12, 7, 255);\
    }\
    .ace-tm .ace_list {\
    color:rgb(185, 6, 144);\
    }\
    .ace-tm .ace_meta.ace_tag {\
    color:rgb(0, 22, 142);\
    }\
    .ace-tm .ace_string.ace_regex {\
    color: rgb(255, 0, 0)\
    }\
    .ace-tm .ace_marker-layer .ace_selection {\
    background: rgb(181, 213, 255);\
    }\
    .ace-tm.ace_multiselect .ace_selection.ace_start {\
    box-shadow: 0 0 3px 0px white;\
    }\
    .ace-tm .ace_marker-layer .ace_step {\
    background: rgb(252, 255, 0);\
    }\
    .ace-tm .ace_marker-layer .ace_stack {\
    background: rgb(164, 229, 101);\
    }\
    .ace-tm .ace_marker-layer .ace_bracket {\
    margin: -1px 0 0 -1px;\
    border: 1px solid rgb(192, 192, 192);\
    }\
    .ace-tm .ace_marker-layer .ace_active-line {\
    background: rgba(0, 0, 0, 0.07);\
    }\
    .ace-tm .ace_gutter-active-line {\
    background-color : #dcdcdc;\
    }\
    .ace-tm .ace_marker-layer .ace_selected-word {\
    background: rgb(250, 250, 255);\
    border: 1px solid rgb(200, 200, 250);\
    }\
    .ace-tm .ace_indent-guide {\
    background: url(\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAE0lEQVQImWP4////f4bLly//BwAmVgd1/w11/gAAAABJRU5ErkJggg==\") right repeat-y;\
    }\
    ";

    const dom = require("../lib/dom");
    dom.importCssString(exports.cssText, exports.cssClass);
});

ace.define("ace/ext/textarea",["require","exports","module","ace/lib/event","ace/lib/useragent","ace/lib/net","ace/ace","ace/theme/textmate"], (require, exports, module) => {
    const event = require("../lib/event");
    const UA = require("../lib/useragent");
    const net = require("../lib/net");
    const ace = require("../ace");

    require("../theme/textmate");

    module.exports = exports = ace;
    const getCSSProperty = (element, container, property) => {
        let ret = element.style[property];

        if (!ret) {
            if (window.getComputedStyle) {
                ret = window.getComputedStyle(element, '').getPropertyValue(property);
            } else {
                ret = element.currentStyle[property];
            }
        }

        if (!ret || ret == 'auto' || ret == 'intrinsic') {
            ret = container.style[property];
        }
        return ret;
    };

    function applyStyles(elm, styles) {
        for (const style in styles) {
            elm.style[style] = styles[style];
        }
    }

    function setupContainer(element, getValue) {
        if (element.type != 'textarea') {
            throw new Error("Textarea required!");
        }

        let parentNode = element.parentNode;
        const container = document.createElement('div');
        const resizeEvent = () => {
            let style = 'position:relative;';
            [
                'margin-top', 'margin-left', 'margin-right', 'margin-bottom'
            ].forEach(item => {
                style += `${item}:${getCSSProperty(element, container, item)};`;
            });
            const width = getCSSProperty(element, container, 'width') || (`${element.clientWidth}px`);
            const height = getCSSProperty(element, container, 'height')  || (`${element.clientHeight}px`);
            style += `height:${height};width:${width};`;
            style += 'display:inline-block;';
            container.setAttribute('style', style);
        };
        event.addListener(window, 'resize', resizeEvent);
        resizeEvent();
        parentNode.insertBefore(container, element.nextSibling);
        while (parentNode !== document) {
            if (parentNode.tagName.toUpperCase() === 'FORM') {
                const oldSumit = parentNode.onsubmit;
                parentNode.onsubmit = function(evt) {
                    element.value = getValue();
                    if (oldSumit) {
                        oldSumit.call(this, evt);
                    }
                };
                break;
            }
            parentNode = parentNode.parentNode;
        }
        return container;
    }

    exports.transformTextarea = (element, options) => {
        let session;
        const container = setupContainer(element, () => session.getValue());
        element.style.display = 'none';
        container.style.background = 'white';
        const editorDiv = document.createElement("div");
        applyStyles(editorDiv, {
            top: "0px",
            left: "0px",
            right: "0px",
            bottom: "0px",
            border: "1px solid gray",
            position: "absolute"
        });
        container.appendChild(editorDiv);

        const settingOpener = document.createElement("div");
        applyStyles(settingOpener, {
            position: "absolute",
            right: "0px",
            bottom: "0px",
            background: "red",
            cursor: "nw-resize",
            borderStyle: "solid",
            borderWidth: "9px 8px 10px 9px",
            width: "2px",
            borderColor: "lightblue gray gray lightblue",
            zIndex: 101
        });

        const settingDiv = document.createElement("div");
        const settingDivStyles = {
            top: "0px",
            left: "20%",
            right: "0px",
            bottom: "0px",
            position: "absolute",
            padding: "5px",
            zIndex: 100,
            color: "white",
            display: "none",
            overflow: "auto",
            fontSize: "14px",
            boxShadow: "-5px 2px 3px gray"
        };
        if (!UA.isOldIE) {
            settingDivStyles.backgroundColor = "rgba(0, 0, 0, 0.6)";
        } else {
            settingDivStyles.backgroundColor = "#333";
        }

        applyStyles(settingDiv, settingDivStyles);
        container.appendChild(settingDiv);

        options = options || exports.defaultOptions;
        const editor = ace.edit(editorDiv);
        session = editor.getSession();

        session.setValue(element.value || element.innerHTML);
        editor.focus();
        container.appendChild(settingOpener);
        setupApi(editor, editorDiv, settingDiv, ace, options, load);
        setupSettingPanel(settingDiv, settingOpener, editor);

        let state = "";
        event.addListener(settingOpener, "mousemove", function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            if (x + y < (rect.width + rect.height)/2) {
                this.style.cursor = "pointer";
                state = "toggle";
            } else {
                state = "resize";
                this.style.cursor = "nw-resize";
            }
        });

        event.addListener(settingOpener, "mousedown", e => {
            if (state == "toggle") {
                editor.setDisplaySettings();
                return;
            }
            container.style.zIndex = 100000;
            const rect = container.getBoundingClientRect();
            const startX = rect.width  + rect.left - e.clientX;
            const startY = rect.height  + rect.top - e.clientY;
            event.capture(settingOpener, e => {
                container.style.width = `${e.clientX - rect.left + startX}px`;
                container.style.height = `${e.clientY - rect.top + startY}px`;
                editor.resize();
            }, () => {});
        });

        return editor;
    };

    function load(url, module, callback) {
        net.loadScript(url, () => {
            require([module], callback);
        });
    }

    function setupApi(editor, editorDiv, settingDiv, ace, options, loader) {
        const session = editor.getSession();
        const renderer = editor.renderer;
        loader = loader || load;

        function toBool(value) {
            return value === "true" || value == true;
        }

        editor.setDisplaySettings = display => {
            if (display == null)
                display = settingDiv.style.display == "none";
            if (display) {
                settingDiv.style.display = "block";
                settingDiv.hideButton.focus();
                editor.on("focus", function onFocus() {
                    editor.removeListener("focus", onFocus);
                    settingDiv.style.display = "none";
                });
            } else {
                editor.focus();
            }
        };

        editor.$setOption = editor.setOption;
        editor.$getOption = editor.getOption;
        editor.setOption = (key, value) => {
            switch (key) {
                case "mode":
                    editor.$setOption("mode", `ace/mode/${value}`)
                break;
                case "theme":
                    editor.$setOption("theme", `ace/theme/${value}`)
                break;
                case "keybindings":
                    switch (value) {
                        case "vim":
                            editor.setKeyboardHandler("ace/keyboard/vim");
                            break;
                        case "emacs":
                            editor.setKeyboardHandler("ace/keyboard/emacs");
                            break;
                        default:
                            editor.setKeyboardHandler(null);
                    }
                break;

                case "softWrap":
                case "fontSize":
                    editor.$setOption(key, value);
                break;
                
                default:
                    editor.$setOption(key, toBool(value));
            }
        };

        editor.getOption = key => {
            switch (key) {
                case "mode":
                    return editor.$getOption("mode").substr("ace/mode/".length)
                break;

                case "theme":
                    return editor.$getOption("theme").substr("ace/theme/".length)
                break;

                case "keybindings":
                    const value = editor.getKeyboardHandler();
                    switch (value && value.$id) {
                        case "ace/keyboard/vim":
                            return "vim";
                        case "ace/keyboard/emacs":
                            return "emacs";
                        default:
                            return "ace";
                    }
                break;

                default:
                    return editor.$getOption(key);
            }
        };

        editor.setOptions(options);
        return editor;
    }

    function setupSettingPanel(settingDiv, settingOpener, editor) {
        const BOOL = null;

        const desc = {
            mode:            "Mode:",
            wrap:            "Soft Wrap:",
            theme:           "Theme:",
            fontSize:        "Font Size:",
            showGutter:      "Display Gutter:",
            keybindings:     "Keyboard",
            showPrintMargin: "Show Print Margin:",
            useSoftTabs:     "Use Soft Tabs:",
            showInvisibles:  "Show Invisibles"
        };

        const optionValues = {
            mode: {
                text:       "Plain",
                javascript: "JavaScript",
                xml:        "XML",
                html:       "HTML",
                css:        "CSS",
                scss:       "SCSS",
                python:     "Python",
                php:        "PHP",
                java:       "Java",
                ruby:       "Ruby",
                c_cpp:      "C/C++",
                coffee:     "CoffeeScript",
                json:       "json",
                perl:       "Perl",
                clojure:    "Clojure",
                ocaml:      "OCaml",
                csharp:     "C#",
                haxe:       "haXe",
                svg:        "SVG",
                textile:    "Textile",
                groovy:     "Groovy",
                liquid:     "Liquid",
                Scala:      "Scala"
            },
            theme: {
                clouds:           "Clouds",
                clouds_midnight:  "Clouds Midnight",
                cobalt:           "Cobalt",
                crimson_editor:   "Crimson Editor",
                dawn:             "Dawn",
                eclipse:          "Eclipse",
                idle_fingers:     "Idle Fingers",
                kr_theme:         "Kr Theme",
                merbivore:        "Merbivore",
                merbivore_soft:   "Merbivore Soft",
                mono_industrial:  "Mono Industrial",
                monokai:          "Monokai",
                pastel_on_dark:   "Pastel On Dark",
                solarized_dark:   "Solarized Dark",
                solarized_light:  "Solarized Light",
                textmate:         "Textmate",
                twilight:         "Twilight",
                vibrant_ink:      "Vibrant Ink"
            },
            showGutter: BOOL,
            fontSize: {
                "10px": "10px",
                "11px": "11px",
                "12px": "12px",
                "14px": "14px",
                "16px": "16px"
            },
            wrap: {
                off:    "Off",
                40:     "40",
                80:     "80",
                free:   "Free"
            },
            keybindings: {
                ace: "ace",
                vim: "vim",
                emacs: "emacs"
            },
            showPrintMargin:    BOOL,
            useSoftTabs:        BOOL,
            showInvisibles:     BOOL
        };

        const table = [];
        table.push("<table><tr><th>Setting</th><th>Value</th></tr>");

        function renderOption(builder, option, obj, cValue) {
            if (!obj) {
                builder.push(
                    "<input type='checkbox' title='", option, "' ",
                        `${cValue}` == "true" ? "checked='true'" : "",
                   "'></input>"
                );
                return;
            }
            builder.push(`<select title='${option}'>`);
            for (const value in obj) {
                builder.push(`<option value='${value}' `);

                if (cValue == value) {
                    builder.push(" selected ");
                }

                builder.push(">",
                    obj[value],
                    "</option>");
            }
            builder.push("</select>");
        }

        for (const option in exports.defaultOptions) {
            table.push("<tr><td>", desc[option], "</td>");
            table.push("<td>");
            renderOption(table, option, optionValues[option], editor.getOption(option));
            table.push("</td></tr>");
        }
        table.push("</table>");
        settingDiv.innerHTML = table.join("");

        const onChange = e => {
            const select = e.currentTarget;
            editor.setOption(select.title, select.value);
        };
        const onClick = e => {
            const cb = e.currentTarget;
            editor.setOption(cb.title, cb.checked);
        };
        const selects = settingDiv.getElementsByTagName("select");
        for (var i = 0; i < selects.length; i++)
            selects[i].onchange = onChange;
        const cbs = settingDiv.getElementsByTagName("input");
        for (var i = 0; i < cbs.length; i++)
            cbs[i].onclick = onClick;


        const button = document.createElement("input");
        button.type = "button";
        button.value = "Hide";
        event.addListener(button, "click", () => {
            editor.setDisplaySettings(false);
        });
        settingDiv.appendChild(button);
        settingDiv.hideButton = button;
    }
    exports.defaultOptions = {
        mode:               "javascript",
        theme:              "textmate",
        wrap:               "off",
        fontSize:           "12px",
        showGutter:         "false",
        keybindings:        "ace",
        showPrintMargin:    "false",
        useSoftTabs:        "true",
        showInvisibles:     "false"
    };
});
                ((() => {
                    ace.require(["ace/ext/textarea"], () => {});
                }))();
            