ace.define("ace/ext/menu_tools/element_generator",["require","exports","module"], (require, exports, module) => {
    module.exports.createOption = function createOption (obj) {
        let attribute;
        const el = document.createElement('option');
        for(attribute in obj) {
            if(obj.hasOwnProperty(attribute)) {
                if(attribute === 'selected') {
                    el.setAttribute(attribute, obj[attribute]);
                } else {
                    el[attribute] = obj[attribute];
                }
            }
        }
        return el;
    };
    module.exports.createCheckbox = function createCheckbox (id, checked, clss) {
        const el = document.createElement('input');
        el.setAttribute('type', 'checkbox');
        el.setAttribute('id', id);
        el.setAttribute('name', id);
        el.setAttribute('value', checked);
        el.setAttribute('class', clss);
        if(checked) {
            el.setAttribute('checked', 'checked');
        }
        return el;
    };
    module.exports.createInput = function createInput (id, value, clss) {
        const el = document.createElement('input');
        el.setAttribute('type', 'text');
        el.setAttribute('id', id);
        el.setAttribute('name', id);
        el.setAttribute('value', value);
        el.setAttribute('class', clss);
        return el;
    };
    module.exports.createLabel = function createLabel (text, labelFor) {
        const el = document.createElement('label');
        el.setAttribute('for', labelFor);
        el.textContent = text;
        return el;
    };
    module.exports.createSelection = function createSelection (id, values, clss) {
        const el = document.createElement('select');
        el.setAttribute('id', id);
        el.setAttribute('name', id);
        el.setAttribute('class', clss);
        values.forEach(item => {
            el.appendChild(module.exports.createOption(item));
        });
        return el;
    };
});

ace.define("ace/ext/modelist",["require","exports","module"], (require, exports, module) => {
    const modes = [];
    function getModeForPath(path) {
        let mode = modesByName.text;
        const fileName = path.split(/[\/\\]/).pop();
        for (let i = 0; i < modes.length; i++) {
            if (modes[i].supportsFile(fileName)) {
                mode = modes[i];
                break;
            }
        }
        return mode;
    }

    class Mode {
        constructor(name, caption, extensions) {
            this.name = name;
            this.caption = caption;
            this.mode = `ace/mode/${name}`;
            this.extensions = extensions;
            let re;
            if (/\^/.test(extensions)) {
                re = `${extensions.replace(/\|(\^)?/g, (a, b) => "$|" + (b ? "^" : "^.*\\."))}$`;
            } else {
                re = `^.*\\.(${extensions})$`;
            }

            this.extRe = new RegExp(re, "gi");
        }

        supportsFile(filename) {
            return filename.match(this.extRe);
        }
    }

    const supportedModes = {
        ABAP:        ["abap"],
        ABC:         ["abc"],
        ActionScript:["as"],
        ADA:         ["ada|adb"],
        Apache_Conf: ["^htaccess|^htgroups|^htpasswd|^conf|htaccess|htgroups|htpasswd"],
        AsciiDoc:    ["asciidoc|adoc"],
        Assembly_x86:["asm|a"],
        AutoHotKey:  ["ahk"],
        BatchFile:   ["bat|cmd"],
        C_Cpp:       ["cpp|c|cc|cxx|h|hh|hpp|ino"],
        C9Search:    ["c9search_results"],
        Cirru:       ["cirru|cr"],
        Clojure:     ["clj|cljs"],
        Cobol:       ["CBL|COB"],
        coffee:      ["coffee|cf|cson|^Cakefile"],
        ColdFusion:  ["cfm"],
        CSharp:      ["cs"],
        CSS:         ["css"],
        Curly:       ["curly"],
        D:           ["d|di"],
        Dart:        ["dart"],
        Diff:        ["diff|patch"],
        Dockerfile:  ["^Dockerfile"],
        Dot:         ["dot"],
        Drools:      ["drl"],
        Dummy:       ["dummy"],
        DummySyntax: ["dummy"],
        Eiffel:      ["e|ge"],
        EJS:         ["ejs"],
        Elixir:      ["ex|exs"],
        Elm:         ["elm"],
        Erlang:      ["erl|hrl"],
        Forth:       ["frt|fs|ldr|fth|4th"],
        Fortran:     ["f|f90"],
        FTL:         ["ftl"],
        Gcode:       ["gcode"],
        Gherkin:     ["feature"],
        Gitignore:   ["^.gitignore"],
        Glsl:        ["glsl|frag|vert"],
        Gobstones:   ["gbs"],
        golang:      ["go"],
        Groovy:      ["groovy"],
        HAML:        ["haml"],
        Handlebars:  ["hbs|handlebars|tpl|mustache"],
        Haskell:     ["hs"],
        Haskell_Cabal:     ["cabal"],
        haXe:        ["hx"],
        HTML:        ["html|htm|xhtml"],
        HTML_Elixir: ["eex|html.eex"],
        HTML_Ruby:   ["erb|rhtml|html.erb"],
        INI:         ["ini|conf|cfg|prefs"],
        Io:          ["io"],
        Jack:        ["jack"],
        Jade:        ["jade"],
        Java:        ["java"],
        JavaScript:  ["js|jsm|jsx"],
        JSON:        ["json"],
        JSONiq:      ["jq"],
        JSP:         ["jsp"],
        JSX:         ["jsx"],
        Julia:       ["jl"],
        Kotlin:      ["kt|kts"],
        LaTeX:       ["tex|latex|ltx|bib"],
        LESS:        ["less"],
        Liquid:      ["liquid"],
        Lisp:        ["lisp"],
        LiveScript:  ["ls"],
        LogiQL:      ["logic|lql"],
        LSL:         ["lsl"],
        Lua:         ["lua"],
        LuaPage:     ["lp"],
        Lucene:      ["lucene"],
        Makefile:    ["^Makefile|^GNUmakefile|^makefile|^OCamlMakefile|make"],
        Markdown:    ["md|markdown"],
        Mask:        ["mask"],
        MATLAB:      ["matlab"],
        Maze:        ["mz"],
        MEL:         ["mel"],
        MUSHCode:    ["mc|mush"],
        MySQL:       ["mysql"],
        Nix:         ["nix"],
        NSIS:        ["nsi|nsh"],
        ObjectiveC:  ["m|mm"],
        OCaml:       ["ml|mli"],
        Pascal:      ["pas|p"],
        Perl:        ["pl|pm"],
        pgSQL:       ["pgsql"],
        PHP:         ["php|phtml|shtml|php3|php4|php5|phps|phpt|aw|ctp|module"],
        Powershell:  ["ps1"],
        Praat:       ["praat|praatscript|psc|proc"],
        Prolog:      ["plg|prolog"],
        Properties:  ["properties"],
        Protobuf:    ["proto"],
        Python:      ["py"],
        R:           ["r"],
        Razor:       ["cshtml|asp"],
        RDoc:        ["Rd"],
        RHTML:       ["Rhtml"],
        RST:         ["rst"],
        Ruby:        ["rb|ru|gemspec|rake|^Guardfile|^Rakefile|^Gemfile"],
        Rust:        ["rs"],
        SASS:        ["sass"],
        SCAD:        ["scad"],
        Scala:       ["scala"],
        Scheme:      ["scm|sm|rkt|oak|scheme"],
        SCSS:        ["scss"],
        SH:          ["sh|bash|^.bashrc"],
        SJS:         ["sjs"],
        Smarty:      ["smarty|tpl"],
        snippets:    ["snippets"],
        Soy_Template:["soy"],
        Space:       ["space"],
        SQL:         ["sql"],
        SQLServer:   ["sqlserver"],
        Stylus:      ["styl|stylus"],
        SVG:         ["svg"],
        Swift:       ["swift"],
        Tcl:         ["tcl"],
        Tex:         ["tex"],
        Text:        ["txt"],
        Textile:     ["textile"],
        Toml:        ["toml"],
        Twig:        ["twig|swig"],
        Typescript:  ["ts|typescript|str"],
        TSX:         ["tsx"],
        Vala:        ["vala"],
        VBScript:    ["vbs|vb"],
        Velocity:    ["vm"],
        Verilog:     ["v|vh|sv|svh"],
        VHDL:        ["vhd|vhdl"],
        Wollok:      ["wlk|wpgm|wtest"],
        XML:         ["xml|rdf|rss|wsdl|xslt|atom|mathml|mml|xul|xbl|xaml"],
        XQuery:      ["xq"],
        YAML:        ["yaml|yml"],
        Django:      ["html"]
    };

    const nameOverrides = {
        ObjectiveC: "Objective-C",
        CSharp: "C#",
        golang: "Go",
        C_Cpp: "C and C++",
        coffee: "CoffeeScript",
        HTML_Ruby: "HTML (Ruby)",
        HTML_Elixir: "HTML (Elixir)",
        FTL: "FreeMarker"
    };
    var modesByName = {};
    for (const name in supportedModes) {
        const data = supportedModes[name];
        const displayName = (nameOverrides[name] || name).replace(/_/g, " ");
        const filename = name.toLowerCase();
        const mode = new Mode(filename, displayName, data[0]);
        modesByName[filename] = mode;
        modes.push(mode);
    }

    module.exports = {
        getModeForPath,
        modes,
        modesByName
    };
});

ace.define("ace/ext/themelist",["require","exports","module","ace/lib/fixoldbrowsers"], (require, exports, module) => {
    require("ace/lib/fixoldbrowsers");

    const themeData = [
        ["Chrome"         ],
        ["Clouds"         ],
        ["Crimson Editor" ],
        ["Dawn"           ],
        ["Dreamweaver"    ],
        ["Eclipse"        ],
        ["GitHub"         ],
        ["IPlastic"       ],
        ["Solarized Light"],
        ["TextMate"       ],
        ["Tomorrow"       ],
        ["XCode"          ],
        ["Kuroir"],
        ["KatzenMilch"],
        ["SQL Server"           ,"sqlserver"               , "light"],
        ["Ambiance"             ,"ambiance"                ,  "dark"],
        ["Chaos"                ,"chaos"                   ,  "dark"],
        ["Clouds Midnight"      ,"clouds_midnight"         ,  "dark"],
        ["Cobalt"               ,"cobalt"                  ,  "dark"],
        ["Gruvbox"              ,"gruvbox"                 ,  "dark"],
        ["idle Fingers"         ,"idle_fingers"            ,  "dark"],
        ["krTheme"              ,"kr_theme"                ,  "dark"],
        ["Merbivore"            ,"merbivore"               ,  "dark"],
        ["Merbivore Soft"       ,"merbivore_soft"          ,  "dark"],
        ["Mono Industrial"      ,"mono_industrial"         ,  "dark"],
        ["Monokai"              ,"monokai"                 ,  "dark"],
        ["Pastel on dark"       ,"pastel_on_dark"          ,  "dark"],
        ["Solarized Dark"       ,"solarized_dark"          ,  "dark"],
        ["Terminal"             ,"terminal"                ,  "dark"],
        ["Tomorrow Night"       ,"tomorrow_night"          ,  "dark"],
        ["Tomorrow Night Blue"  ,"tomorrow_night_blue"     ,  "dark"],
        ["Tomorrow Night Bright","tomorrow_night_bright"   ,  "dark"],
        ["Tomorrow Night 80s"   ,"tomorrow_night_eighties" ,  "dark"],
        ["Twilight"             ,"twilight"                ,  "dark"],
        ["Vibrant Ink"          ,"vibrant_ink"             ,  "dark"]
    ];


    exports.themesByName = {};
    exports.themes = themeData.map(data => {
        const name = data[1] || data[0].replace(/ /g, "_").toLowerCase();
        const theme = {
            caption: data[0],
            theme: `ace/theme/${name}`,
            isDark: data[2] == "dark",
            name
        };
        exports.themesByName[name] = theme;
        return theme;
    });
});

ace.define("ace/ext/menu_tools/add_editor_menu_options",["require","exports","module","ace/ext/modelist","ace/ext/themelist"], (require, exports, module) => {
    module.exports.addEditorMenuOptions = function addEditorMenuOptions (editor) {
        const modelist = require('../modelist');
        const themelist = require('../themelist');
        editor.menuOptions = {
            setNewLineMode: [{
                textContent: "unix",
                value: "unix"
            }, {
                textContent: "windows",
                value: "windows"
            }, {
                textContent: "auto",
                value: "auto"
            }],
            setTheme: [],
            setMode: [],
            setKeyboardHandler: [{
                textContent: "ace",
                value: ""
            }, {
                textContent: "vim",
                value: "ace/keyboard/vim"
            }, {
                textContent: "emacs",
                value: "ace/keyboard/emacs"
            }, {
                textContent: "textarea",
                value: "ace/keyboard/textarea"
            }, {
                textContent: "sublime",
                value: "ace/keyboard/sublime"
            }]
        };

        editor.menuOptions.setTheme = themelist.themes.map(theme => ({
            textContent: theme.caption,
            value: theme.theme
        }));

        editor.menuOptions.setMode = modelist.modes.map(mode => ({
            textContent: mode.name,
            value: mode.mode
        }));
    };
});

ace.define("ace/ext/menu_tools/get_set_functions",["require","exports","module"], (require, exports, module) => {
    module.exports.getSetFunctions = function getSetFunctions (editor) {
        const out = [];
        const my = {
            'editor' : editor,
            'session' : editor.session,
            'renderer' : editor.renderer
        };
        const opts = [];
        const skip = [
            'setOption',
            'setUndoManager',
            'setDocument',
            'setValue',
            'setBreakpoints',
            'setScrollTop',
            'setScrollLeft',
            'setSelectionStyle',
            'setWrapLimitRange'
        ];
        ['renderer', 'session', 'editor'].forEach(esra => {
            const esr = my[esra];
            const clss = esra;
            for(const fn in esr) {
                if(!skip.includes(fn)) {
                    if(/^set/.test(fn) && !opts.includes(fn)) {
                        opts.push(fn);
                        out.push({
                            'functionName' : fn,
                            'parentObj' : esr,
                            'parentName' : clss
                        });
                    }
                }
            }
        });
        return out;
    };
});

ace.define("ace/ext/menu_tools/generate_settings_menu",["require","exports","module","ace/ext/menu_tools/element_generator","ace/ext/menu_tools/add_editor_menu_options","ace/ext/menu_tools/get_set_functions","ace/ace"], (require, exports, module) => {
    const egen = require('./element_generator');
    const addEditorMenuOptions = require('./add_editor_menu_options').addEditorMenuOptions;
    const getSetFunctions = require('./get_set_functions').getSetFunctions;
    module.exports.generateSettingsMenu = function generateSettingsMenu (editor) {
        const elements = [];
        function cleanupElementsList() {
            elements.sort((a, b) => {
                const x = a.getAttribute('contains');
                const y = b.getAttribute('contains');
                return x.localeCompare(y);
            });
        }
        function wrapElements() {
            const topmenu = document.createElement('div');
            topmenu.setAttribute('id', 'ace_settingsmenu');
            elements.forEach(element => {
                topmenu.appendChild(element);
            });
            
            const el = topmenu.appendChild(document.createElement('div'));
            const version = require("../../ace").version;
            el.style.padding = "1em";
            el.textContent = `Ace version ${version}`;
            
            return topmenu;
        }
        function createNewEntry(obj, clss, item, val) {
            let el;
            const div = document.createElement('div');
            div.setAttribute('contains', item);
            div.setAttribute('class', 'ace_optionsMenuEntry');
            div.setAttribute('style', 'clear: both;');

            div.appendChild(egen.createLabel(
                item.replace(/^set/, '').replace(/([A-Z])/g, ' $1').trim(),
                item
            ));

            if (Array.isArray(val)) {
                el = egen.createSelection(item, val, clss);
                el.addEventListener('change', e => {
                    try{
                        editor.menuOptions[e.target.id].forEach(x => {
                            if(x.textContent !== e.target.textContent) {
                                delete x.selected;
                            }
                        });
                        obj[e.target.id](e.target.value);
                    } catch (err) {
                        throw new Error(err);
                    }
                });
            } else if(typeof val === 'boolean') {
                el = egen.createCheckbox(item, val, clss);
                el.addEventListener('change', e => {
                    try{
                        obj[e.target.id](!!e.target.checked);
                    } catch (err) {
                        throw new Error(err);
                    }
                });
            } else {
                el = egen.createInput(item, val, clss);
                el.addEventListener('change', e => {
                    try{
                        if(e.target.value === 'true') {
                            obj[e.target.id](true);
                        } else if(e.target.value === 'false') {
                            obj[e.target.id](false);
                        } else {
                            obj[e.target.id](e.target.value);
                        }
                    } catch (err) {
                        throw new Error(err);
                    }
                });
            }
            el.style.cssText = 'float:right;';
            div.appendChild(el);
            return div;
        }
        function makeDropdown(item, esr, clss, fn) {
            const val = editor.menuOptions[item];
            let currentVal = esr[fn]();
            if (typeof currentVal == 'object')
                currentVal = currentVal.$id;
            val.forEach(valuex => {
                if (valuex.value === currentVal)
                    valuex.selected = 'selected';
            });
            return createNewEntry(esr, clss, item, val);
        }
        function handleSet(setObj) {
            const item = setObj.functionName;
            const esr = setObj.parentObj;
            const clss = setObj.parentName;
            let val;
            const fn = item.replace(/^set/, 'get');
            if(editor.menuOptions[item] !== undefined) {
                elements.push(makeDropdown(item, esr, clss, fn));
            } else if(typeof esr[fn] === 'function') {
                try {
                    val = esr[fn]();
                    if(typeof val === 'object') {
                        val = val.$id;
                    }
                    elements.push(
                        createNewEntry(esr, clss, item, val)
                    );
                } catch (e) {
                }
            }
        }
        addEditorMenuOptions(editor);
        getSetFunctions(editor).forEach(setObj => {
            handleSet(setObj);
        });
        cleanupElementsList();
        return wrapElements();
    };
});

ace.define("ace/ext/menu_tools/overlay_page",["require","exports","module","ace/lib/dom"], (require, exports, module) => {
    const dom = require("../../lib/dom");
    const cssText = "#ace_settingsmenu, #kbshortcutmenu {\
    background-color: #F7F7F7;\
    color: black;\
    box-shadow: -5px 4px 5px rgba(126, 126, 126, 0.55);\
    padding: 1em 0.5em 2em 1em;\
    overflow: auto;\
    position: absolute;\
    margin: 0;\
    bottom: 0;\
    right: 0;\
    top: 0;\
    z-index: 9991;\
    cursor: default;\
    }\
    .ace_dark #ace_settingsmenu, .ace_dark #kbshortcutmenu {\
    box-shadow: -20px 10px 25px rgba(126, 126, 126, 0.25);\
    background-color: rgba(255, 255, 255, 0.6);\
    color: black;\
    }\
    .ace_optionsMenuEntry:hover {\
    background-color: rgba(100, 100, 100, 0.1);\
    -webkit-transition: all 0.5s;\
    transition: all 0.3s\
    }\
    .ace_closeButton {\
    background: rgba(245, 146, 146, 0.5);\
    border: 1px solid #F48A8A;\
    border-radius: 50%;\
    padding: 7px;\
    position: absolute;\
    right: -8px;\
    top: -8px;\
    z-index: 1000;\
    }\
    .ace_closeButton{\
    background: rgba(245, 146, 146, 0.9);\
    }\
    .ace_optionsMenuKey {\
    color: darkslateblue;\
    font-weight: bold;\
    }\
    .ace_optionsMenuCommand {\
    color: darkcyan;\
    font-weight: normal;\
    }";
    dom.importCssString(cssText);
    module.exports.overlayPage = function overlayPage(editor, contentElement, top, right, bottom, left) {
        top = top ? `top: ${top};` : '';
        bottom = bottom ? `bottom: ${bottom};` : '';
        right = right ? `right: ${right};` : '';
        left = left ? `left: ${left};` : '';

        let closer = document.createElement('div');
        const contentContainer = document.createElement('div');

        function documentEscListener(e) {
            if (e.keyCode === 27) {
                closer.click();
            }
        }

        closer.style.cssText = 'margin: 0; padding: 0; ' +
            'position: fixed; top:0; bottom:0; left:0; right:0;' +
            'z-index: 9990; ' +
            'background-color: rgba(0, 0, 0, 0.3);';
        closer.addEventListener('click', () => {
            document.removeEventListener('keydown', documentEscListener);
            closer.parentNode.removeChild(closer);
            editor.focus();
            closer = null;
        });
        document.addEventListener('keydown', documentEscListener);

        contentContainer.style.cssText = top + right + bottom + left;
        contentContainer.addEventListener('click', e => {
            e.stopPropagation();
        });

        const wrapper = dom.createElement("div");
        wrapper.style.position = "relative";
        
        const closeButton = dom.createElement("div");
        closeButton.className = "ace_closeButton";
        closeButton.addEventListener('click', () => {
            closer.click();
        });
        
        wrapper.appendChild(closeButton);
        contentContainer.appendChild(wrapper);
        
        contentContainer.appendChild(contentElement);
        closer.appendChild(contentContainer);
        document.body.appendChild(closer);
        editor.blur();
    };
});

ace.define("ace/ext/settings_menu",["require","exports","module","ace/ext/menu_tools/generate_settings_menu","ace/ext/menu_tools/overlay_page","ace/editor"], (require, exports, module) => {
    const generateSettingsMenu = require('./menu_tools/generate_settings_menu').generateSettingsMenu;
    const overlayPage = require('./menu_tools/overlay_page').overlayPage;
    function showSettingsMenu(editor) {
        const sm = document.getElementById('ace_settingsmenu');
        if (!sm)    
            overlayPage(editor, generateSettingsMenu(editor), '0', '0', '0');
    }
    module.exports.init = editor => {
        const Editor = require("ace/editor").Editor;
        Editor.prototype.showSettingsMenu = function() {
            showSettingsMenu(this);
        };
    };
});
                ((() => {
                    ace.require(["ace/ext/settings_menu"], () => {});
                }))();
            