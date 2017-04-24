ace.define("ace/snippets",["require","exports","module","ace/lib/oop","ace/lib/event_emitter","ace/lib/lang","ace/range","ace/anchor","ace/keyboard/hash_handler","ace/tokenizer","ace/lib/dom","ace/editor"], (require, exports, module) => {
    const oop = require("./lib/oop");
    const EventEmitter = require("./lib/event_emitter").EventEmitter;
    const lang = require("./lib/lang");
    const Range = require("./range").Range;
    const Anchor = require("./anchor").Anchor;
    const HashHandler = require("./keyboard/hash_handler").HashHandler;
    const Tokenizer = require("./tokenizer").Tokenizer;
    const comparePoints = Range.comparePoints;

    class SnippetManager {
        constructor() {
            this.snippetMap = {};
            this.snippetNameMap = {};
        }

        getTokenizer() {
            return SnippetManager.$tokenizer;
        }
    }

    (function() {
        oop.implement(this, EventEmitter);
        
        this.getTokenizer = () => {
            function TabstopToken(str, _, stack) {
                str = str.substr(1);
                if (/^\d+$/.test(str) && !stack.inFormatString)
                    return [{tabstopId: parseInt(str, 10)}];
                return [{text: str}];
            }
            function escape(ch) {
                return `(?:[^\\\\${ch}]|\\\\.)`;
            }
            SnippetManager.$tokenizer = new Tokenizer({
                start: [
                    {regex: /:/, onMatch(val, state, stack) {
                        if (stack.length && stack[0].expectIf) {
                            stack[0].expectIf = false;
                            stack[0].elseBranch = stack[0];
                            return [stack[0]];
                        }
                        return ":";
                    }},
                    {regex: /\\./, onMatch(val, state, stack) {
                        const ch = val[1];
                        if (ch == "}" && stack.length) {
                            val = ch;
                        }else if ("`$\\".includes(ch)) {
                            val = ch;
                        } else if (stack.inFormatString) {
                            if (ch == "n")
                                val = "\n";
                            else if (ch == "t")
                                val = "\n";
                            else if ("ulULE".includes(ch)) {
                                val = {changeCase: ch, local: ch > "a"};
                            }
                        }

                        return [val];
                    }},
                    {regex: /}/, onMatch(val, state, stack) {
                        return [stack.length ? stack.shift() : val];
                    }},
                    {regex: /\$(?:\d+|\w+)/, onMatch: TabstopToken},
                    {regex: /\$\{[\dA-Z_a-z]+/, onMatch(str, state, stack) {
                        const t = TabstopToken(str.substr(1), state, stack);
                        stack.unshift(t[0]);
                        return t;
                    }, next: "snippetVar"},
                    {regex: /\n/, token: "newline", merge: false}
                ],
                snippetVar: [
                    {regex: `\\|${escape("\\|")}*\\|`, onMatch(val, state, stack) {
                        stack[0].choices = val.slice(1, -1).split(",");
                    }, next: "start"},
                    {regex: `/(${escape("/")}+)/(?:(${escape("/")}*)/)(\\w*):?`,
                     onMatch(val, state, stack) {
                        const ts = stack[0];
                        ts.fmtString = val;

                        val = this.splitRegex.exec(val);
                        ts.guard = val[1];
                        ts.fmt = val[2];
                        ts.flag = val[3];
                        return "";
                    }, next: "start"},
                    {regex: `\`${escape("`")}*\``, onMatch(val, state, stack) {
                        stack[0].code = val.splice(1, -1);
                        return "";
                    }, next: "start"},
                    {regex: "\\?", onMatch(val, state, stack) {
                        if (stack[0])
                            stack[0].expectIf = true;
                    }, next: "start"},
                    {regex: "([^:}\\\\]|\\\\.)*:?", token: "", next: "start"}
                ],
                formatString: [
                    {regex: `/(${escape("/")}+)/`, token: "regex"},
                    {regex: "", onMatch(val, state, stack) {
                        stack.inFormatString = true;
                    }, next: "start"}
                ]
            });
            return SnippetManager.$tokenizer;
        };

        this.tokenizeTmSnippet = function(str, startState) {
            return this.getTokenizer().getLineTokens(str, startState).tokens.map(x => x.value || x);
        };

        this.$getDefaultValue = function(editor, name) {
            if (/^[A-Z]\d+$/.test(name)) {
                const i = name.substr(1);
                return (this.variables[`${name[0]}__`] || {})[i];
            }
            if (/^\d+$/.test(name)) {
                return (this.variables.__ || {})[name];
            }
            name = name.replace(/^TM_/, "");

            if (!editor)
                return;
            const s = editor.session;
            switch(name) {
                case "CURRENT_WORD":
                    const r = s.getWordRange();
                case "SELECTION":
                case "SELECTED_TEXT":
                    return s.getTextRange(r);
                case "CURRENT_LINE":
                    return s.getLine(editor.getCursorPosition().row);
                case "PREV_LINE": // not possible in textmate
                    return s.getLine(editor.getCursorPosition().row - 1);
                case "LINE_INDEX":
                    return editor.getCursorPosition().column;
                case "LINE_NUMBER":
                    return editor.getCursorPosition().row + 1;
                case "SOFT_TABS":
                    return s.getUseSoftTabs() ? "YES" : "NO";
                case "TAB_SIZE":
                    return s.getTabSize();
                case "FILENAME":
                case "FILEPATH":
                    return "";
                case "FULLNAME":
                    return "Ace";
            }
        };
        this.variables = {};
        this.getVariableValue = function(editor, varName) {
            if (this.variables.hasOwnProperty(varName))
                return this.variables[varName](editor, varName) || "";
            return this.$getDefaultValue(editor, varName) || "";
        };
        this.tmStrFormat = function(str, ch, editor) {
            const flag = ch.flag || "";
            let re = ch.guard;
            re = new RegExp(re, flag.replace(/[^gi]/, ""));
            const fmtTokens = this.tokenizeTmSnippet(ch.fmt, "formatString");
            const _self = this;
            const formatted = str.replace(re, function() {
                _self.variables.__ = arguments;
                const fmtParts = _self.resolveVariables(fmtTokens, editor);
                let gChangeCase = "E";
                for (let i  = 0; i < fmtParts.length; i++) {
                    const ch = fmtParts[i];
                    if (typeof ch == "object") {
                        fmtParts[i] = "";
                        if (ch.changeCase && ch.local) {
                            const next = fmtParts[i + 1];
                            if (next && typeof next == "string") {
                                if (ch.changeCase == "u")
                                    fmtParts[i] = next[0].toUpperCase();
                                else
                                    fmtParts[i] = next[0].toLowerCase();
                                fmtParts[i + 1] = next.substr(1);
                            }
                        } else if (ch.changeCase) {
                            gChangeCase = ch.changeCase;
                        }
                    } else if (gChangeCase == "U") {
                        fmtParts[i] = ch.toUpperCase();
                    } else if (gChangeCase == "L") {
                        fmtParts[i] = ch.toLowerCase();
                    }
                }
                return fmtParts.join("");
            });
            this.variables.__ = null;
            return formatted;
        };

        this.resolveVariables = function(snippet, editor) {
            const result = [];
            for (var i = 0; i < snippet.length; i++) {
                const ch = snippet[i];
                if (typeof ch == "string") {
                    result.push(ch);
                } else if (typeof ch != "object") {
                    continue;
                } else if (ch.skip) {
                    gotoNext(ch);
                } else if (ch.processed < i) {
                    continue;
                } else if (ch.text) {
                    let value = this.getVariableValue(editor, ch.text);
                    if (value && ch.fmtString)
                        value = this.tmStrFormat(value, ch);
                    ch.processed = i;
                    if (ch.expectIf == null) {
                        if (value) {
                            result.push(value);
                            gotoNext(ch);
                        }
                    } else {
                        if (value) {
                            ch.skip = ch.elseBranch;
                        } else
                            gotoNext(ch);
                    }
                } else if (ch.tabstopId != null) {
                    result.push(ch);
                } else if (ch.changeCase != null) {
                    result.push(ch);
                }
            }
            function gotoNext(ch) {
                const i1 = snippet.indexOf(ch, i + 1);
                if (i1 != -1)
                    i = i1;
            }
            return result;
        };

        this.insertSnippetForSelection = function(editor, snippetText) {
            const cursor = editor.getCursorPosition();
            const line = editor.session.getLine(cursor.row);
            const tabString = editor.session.getTabString();
            let indentString = line.match(/^\s*/)[0];

            if (cursor.column < indentString.length)
                indentString = indentString.slice(0, cursor.column);

            snippetText = snippetText.replace(/\r/g, "");
            let tokens = this.tokenizeTmSnippet(snippetText);
            tokens = this.resolveVariables(tokens, editor);
            tokens = tokens.map(x => {
                if (x == "\n")
                    return x + indentString;
                if (typeof x == "string")
                    return x.replace(/\t/g, tabString);
                return x;
            });
            const tabstops = [];
            tokens.forEach((p, i) => {
                if (typeof p != "object")
                    return;
                const id = p.tabstopId;
                let ts = tabstops[id];
                if (!ts) {
                    ts = tabstops[id] = [];
                    ts.index = id;
                    ts.value = "";
                }
                if (ts.includes(p))
                    return;
                ts.push(p);
                const i1 = tokens.indexOf(p, i + 1);
                if (i1 === -1)
                    return;

                const value = tokens.slice(i + 1, i1);
                const isNested = value.some(t => typeof t === "object");          
                if (isNested && !ts.value) {
                    ts.value = value;
                } else if (value.length && (!ts.value || typeof ts.value !== "string")) {
                    ts.value = value.join("");
                }
            });
            tabstops.forEach(ts => {ts.length = 0});
            const expanding = {};
            function copyValue(val) {
                const copy = [];
                for (let i = 0; i < val.length; i++) {
                    let p = val[i];
                    if (typeof p == "object") {
                        if (expanding[p.tabstopId])
                            continue;
                        const j = val.lastIndexOf(p, i - 1);
                        p = copy[j] || {tabstopId: p.tabstopId};
                    }
                    copy[i] = p;
                }
                return copy;
            }
            for (let i = 0; i < tokens.length; i++) {
                const p = tokens[i];
                if (typeof p != "object")
                    continue;
                const id = p.tabstopId;
                const i1 = tokens.indexOf(p, i + 1);
                if (expanding[id]) {
                    if (expanding[id] === p)
                        expanding[id] = null;
                    continue;
                }
                
                const ts = tabstops[id];
                const arg = typeof ts.value == "string" ? [ts.value] : copyValue(ts.value);
                arg.unshift(i + 1, Math.max(0, i1 - i));
                arg.push(p);
                expanding[id] = p;
                tokens.splice(...arg);

                if (!ts.includes(p))
                    ts.push(p);
            }
            let row = 0;
            let column = 0;
            let text = "";
            tokens.forEach(t => {
                if (typeof t === "string") {
                    const lines = t.split("\n");
                    if (lines.length > 1){
                        column = lines[lines.length - 1].length;
                        row += lines.length - 1;
                    } else
                        column += t.length;
                    text += t;
                } else {
                    if (!t.start)
                        t.start = {row, column};
                    else
                        t.end = {row, column};
                }
            });
            const range = editor.getSelectionRange();
            const end = editor.session.replace(range, text);

            const tabstopManager = new TabstopManager(editor);
            const selectionId = editor.inVirtualSelectionMode && editor.selection.index;
            tabstopManager.addTabstops(tabstops, range.start, end, selectionId);
        };
        
        this.insertSnippet = function(editor, snippetText) {
            const self = this;
            if (editor.inVirtualSelectionMode)
                return self.insertSnippetForSelection(editor, snippetText);
            
            editor.forEachSelection(() => {
                self.insertSnippetForSelection(editor, snippetText);
            }, null, {keepOrder: true});
            
            if (editor.tabstopManager)
                editor.tabstopManager.tabNext();
        };

        this.$getScope = editor => {
            let scope = editor.session.$mode.$id || "";
            scope = scope.split("/").pop();
            if (scope === "html" || scope === "php") {
                if (scope === "php" && !editor.session.$mode.inlinePhp) 
                    scope = "html";
                const c = editor.getCursorPosition();
                let state = editor.session.getState(c.row);
                if (typeof state === "object") {
                    state = state[0];
                }
                if (state.substring) {
                    if (state.substring(0, 3) == "js-")
                        scope = "javascript";
                    else if (state.substring(0, 4) == "css-")
                        scope = "css";
                    else if (state.substring(0, 4) == "php-")
                        scope = "php";
                }
            }
            
            return scope;
        };

        this.getActiveScopes = function(editor) {
            const scope = this.$getScope(editor);
            const scopes = [scope];
            const snippetMap = this.snippetMap;
            if (snippetMap[scope] && snippetMap[scope].includeScopes) {
                scopes.push(...snippetMap[scope].includeScopes);
            }
            scopes.push("_");
            return scopes;
        };

        this.expandWithTab = function(editor, options) {
            const self = this;
            const result = editor.forEachSelection(() => self.expandSnippetForSelection(editor, options), null, {keepOrder: true});
            if (result && editor.tabstopManager)
                editor.tabstopManager.tabNext();
            return result;
        };
        
        this.expandSnippetForSelection = function(editor, options) {
            const cursor = editor.getCursorPosition();
            const line = editor.session.getLine(cursor.row);
            const before = line.substring(0, cursor.column);
            const after = line.substr(cursor.column);

            const snippetMap = this.snippetMap;
            let snippet;
            this.getActiveScopes(editor).some(function(scope) {
                const snippets = snippetMap[scope];
                if (snippets)
                    snippet = this.findMatchingSnippet(snippets, before, after);
                return !!snippet;
            }, this);
            if (!snippet)
                return false;
            if (options && options.dryRun)
                return true;
            editor.session.doc.removeInLine(cursor.row,
                cursor.column - snippet.replaceBefore.length,
                cursor.column + snippet.replaceAfter.length
            );

            this.variables.M__ = snippet.matchBefore;
            this.variables.T__ = snippet.matchAfter;
            this.insertSnippetForSelection(editor, snippet.content);

            this.variables.M__ = this.variables.T__ = null;
            return true;
        };

        this.findMatchingSnippet = (snippetList, before, after) => {
            for (let i = snippetList.length; i--;) {
                const s = snippetList[i];
                if (s.startRe && !s.startRe.test(before))
                    continue;
                if (s.endRe && !s.endRe.test(after))
                    continue;
                if (!s.startRe && !s.endRe)
                    continue;

                s.matchBefore = s.startRe ? s.startRe.exec(before) : [""];
                s.matchAfter = s.endRe ? s.endRe.exec(after) : [""];
                s.replaceBefore = s.triggerRe ? s.triggerRe.exec(before)[0] : "";
                s.replaceAfter = s.endTriggerRe ? s.endTriggerRe.exec(after)[0] : "";
                return s;
            }
        };

        this.snippetMap = {};
        this.snippetNameMap = {};
        this.register = function(snippets, scope) {
            const snippetMap = this.snippetMap;
            const snippetNameMap = this.snippetNameMap;
            const self = this;
            
            if (!snippets) 
                snippets = [];
            
            function wrapRegexp(src) {
                if (src && !/^\^?\(.*\)\$?$|^\\b$/.test(src))
                    src = `(?:${src})`;

                return src || "";
            }
            function guardedRegexp(re, guard, opening) {
                re = wrapRegexp(re);
                guard = wrapRegexp(guard);
                if (opening) {
                    re = guard + re;
                    if (re && re[re.length - 1] != "$")
                        re = `${re}$`;
                } else {
                    re = re + guard;
                    if (re && re[0] != "^")
                        re = `^${re}`;
                }
                return new RegExp(re);
            }

            function addSnippet(s) {
                if (!s.scope)
                    s.scope = scope || "_";
                scope = s.scope;
                if (!snippetMap[scope]) {
                    snippetMap[scope] = [];
                    snippetNameMap[scope] = {};
                }

                const map = snippetNameMap[scope];
                if (s.name) {
                    const old = map[s.name];
                    if (old)
                        self.unregister(old);
                    map[s.name] = s;
                }
                snippetMap[scope].push(s);

                if (s.tabTrigger && !s.trigger) {
                    if (!s.guard && /^\w/.test(s.tabTrigger))
                        s.guard = "\\b";
                    s.trigger = lang.escapeRegExp(s.tabTrigger);
                }
                
                if (!s.trigger && !s.guard && !s.endTrigger && !s.endGuard)
                    return;
                
                s.startRe = guardedRegexp(s.trigger, s.guard, true);
                s.triggerRe = new RegExp(s.trigger, "", true);

                s.endRe = guardedRegexp(s.endTrigger, s.endGuard, true);
                s.endTriggerRe = new RegExp(s.endTrigger, "", true);
            }

            if (snippets && snippets.content)
                addSnippet(snippets);
            else if (Array.isArray(snippets))
                snippets.forEach(addSnippet);
            
            this._signal("registerSnippets", {scope});
        };
        this.unregister = function(snippets, scope) {
            const snippetMap = this.snippetMap;
            const snippetNameMap = this.snippetNameMap;

            function removeSnippet(s) {
                const nameMap = snippetNameMap[s.scope||scope];
                if (nameMap && nameMap[s.name]) {
                    delete nameMap[s.name];
                    const map = snippetMap[s.scope||scope];
                    const i = map && map.indexOf(s);
                    if (i >= 0)
                        map.splice(i, 1);
                }
            }
            if (snippets.content)
                removeSnippet(snippets);
            else if (Array.isArray(snippets))
                snippets.forEach(removeSnippet);
        };
        this.parseSnippetFile = str => {
            str = str.replace(/\r/g, "");
            const list = [];
            let snippet = {};
            const re = /^#.*|^({[\s\S]*})\s*$|^(\S+) (.*)$|^((?:\n*\t.*)+)/gm;
            let m;
            while (m = re.exec(str)) {
                if (m[1]) {
                    try {
                        snippet = JSON.parse(m[1]);
                        list.push(snippet);
                    } catch (e) {}
                } if (m[4]) {
                    snippet.content = m[4].replace(/^\t/gm, "");
                    list.push(snippet);
                    snippet = {};
                } else {
                const key = m[2];
                const val = m[3];
                if (key == "regex") {
                    const guardRe = /\/((?:[^\/\\]|\\.)*)|$/g;
                    snippet.guard = guardRe.exec(val)[1];
                    snippet.trigger = guardRe.exec(val)[1];
                    snippet.endTrigger = guardRe.exec(val)[1];
                    snippet.endGuard = guardRe.exec(val)[1];
                } else if (key == "snippet") {
                    snippet.tabTrigger = val.match(/^\S*/)[0];
                    if (!snippet.name)
                        snippet.name = val;
                } else {
                    snippet[key] = val;
                }
            }
            }
            return list;
        };
        this.getSnippetByName = function(name, editor) {
            const snippetMap = this.snippetNameMap;
            let snippet;
            this.getActiveScopes(editor).some(scope => {
                const snippets = snippetMap[scope];
                if (snippets)
                    snippet = snippets[name];
                return !!snippet;
            }, this);
            return snippet;
        };

    }).call(SnippetManager.prototype);


    var TabstopManager = function(editor) {
        if (editor.tabstopManager)
            return editor.tabstopManager;
        editor.tabstopManager = this;
        this.$onChange = this.onChange.bind(this);
        this.$onChangeSelection = lang.delayedCall(this.onChangeSelection.bind(this)).schedule;
        this.$onChangeSession = this.onChangeSession.bind(this);
        this.$onAfterExec = this.onAfterExec.bind(this);
        this.attach(editor);
    };
    (function() {
        this.attach = function(editor) {
            this.index = 0;
            this.ranges = [];
            this.tabstops = [];
            this.$openTabstops = null;
            this.selectedTabstop = null;

            this.editor = editor;
            this.editor.on("change", this.$onChange);
            this.editor.on("changeSelection", this.$onChangeSelection);
            this.editor.on("changeSession", this.$onChangeSession);
            this.editor.commands.on("afterExec", this.$onAfterExec);
            this.editor.keyBinding.addKeyboardHandler(this.keyboardHandler);
        };
        this.detach = function() {
            this.tabstops.forEach(this.removeTabstopMarkers, this);
            this.ranges = null;
            this.tabstops = null;
            this.selectedTabstop = null;
            this.editor.removeListener("change", this.$onChange);
            this.editor.removeListener("changeSelection", this.$onChangeSelection);
            this.editor.removeListener("changeSession", this.$onChangeSession);
            this.editor.commands.removeListener("afterExec", this.$onAfterExec);
            this.editor.keyBinding.removeKeyboardHandler(this.keyboardHandler);
            this.editor.tabstopManager = null;
            this.editor = null;
        };

        this.onChange = function(delta) {
            const changeRange = delta;
            const isRemove = delta.action[0] == "r";
            const start = delta.start;
            const end = delta.end;
            const startRow = start.row;
            const endRow = end.row;
            let lineDif = endRow - startRow;
            let colDiff = end.column - start.column;

            if (isRemove) {
                lineDif = -lineDif;
                colDiff = -colDiff;
            }
            if (!this.$inChange && isRemove) {
                const ts = this.selectedTabstop;
                const changedOutside = ts && !ts.some(r => comparePoints(r.start, start) <= 0 && comparePoints(r.end, end) >= 0);
                if (changedOutside)
                    return this.detach();
            }
            const ranges = this.ranges;
            for (let i = 0; i < ranges.length; i++) {
                const r = ranges[i];
                if (r.end.row < start.row)
                    continue;

                if (isRemove && comparePoints(start, r.start) < 0 && comparePoints(end, r.end) > 0) {
                    this.removeRange(r);
                    i--;
                    continue;
                }

                if (r.start.row == startRow && r.start.column > start.column)
                    r.start.column += colDiff;
                if (r.end.row == startRow && r.end.column >= start.column)
                    r.end.column += colDiff;
                if (r.start.row >= startRow)
                    r.start.row += lineDif;
                if (r.end.row >= startRow)
                    r.end.row += lineDif;

                if (comparePoints(r.start, r.end) > 0)
                    this.removeRange(r);
            }
            if (!ranges.length)
                this.detach();
        };
        this.updateLinkedFields = function() {
            const ts = this.selectedTabstop;
            if (!ts || !ts.hasLinkedRanges)
                return;
            this.$inChange = true;
            const session = this.editor.session;
            const text = session.getTextRange(ts.firstNonLinked);
            for (let i = ts.length; i--;) {
                const range = ts[i];
                if (!range.linked)
                    continue;
                const fmt = exports.snippetManager.tmStrFormat(text, range.original);
                session.replace(range, fmt);
            }
            this.$inChange = false;
        };
        this.onAfterExec = function(e) {
            if (e.command && !e.command.readOnly)
                this.updateLinkedFields();
        };
        this.onChangeSelection = function() {
            if (!this.editor)
                return;
            const lead = this.editor.selection.lead;
            const anchor = this.editor.selection.anchor;
            const isEmpty = this.editor.selection.isEmpty();
            for (let i = this.ranges.length; i--;) {
                if (this.ranges[i].linked)
                    continue;
                const containsLead = this.ranges[i].contains(lead.row, lead.column);
                const containsAnchor = isEmpty || this.ranges[i].contains(anchor.row, anchor.column);
                if (containsLead && containsAnchor)
                    return;
            }
            this.detach();
        };
        this.onChangeSession = function() {
            this.detach();
        };
        this.tabNext = function(dir) {
            const max = this.tabstops.length;
            let index = this.index + (dir || 1);
            index = Math.min(Math.max(index, 1), max);
            if (index == max)
                index = 0;
            this.selectTabstop(index);
            if (index === 0)
                this.detach();
        };
        this.selectTabstop = function(index) {
            this.$openTabstops = null;
            let ts = this.tabstops[this.index];
            if (ts)
                this.addTabstopMarkers(ts);
            this.index = index;
            ts = this.tabstops[this.index];
            if (!ts || !ts.length)
                return;
            
            this.selectedTabstop = ts;
            if (!this.editor.inVirtualSelectionMode) {        
                const sel = this.editor.multiSelect;
                sel.toSingleRange(ts.firstNonLinked.clone());
                for (let i = ts.length; i--;) {
                    if (ts.hasLinkedRanges && ts[i].linked)
                        continue;
                    sel.addRange(ts[i].clone(), true);
                }
                if (sel.ranges[0])
                    sel.addRange(sel.ranges[0].clone());
            } else {
                this.editor.selection.setRange(ts.firstNonLinked);
            }
            
            this.editor.keyBinding.addKeyboardHandler(this.keyboardHandler);
        };
        this.addTabstops = function(tabstops, start, end) {
            if (!this.$openTabstops)
                this.$openTabstops = [];
            if (!tabstops[0]) {
                const p = Range.fromPoints(end, end);
                moveRelative(p.start, start);
                moveRelative(p.end, start);
                tabstops[0] = [p];
                tabstops[0].index = 0;
            }

            const i = this.index;
            const arg = [i + 1, 0];
            const ranges = this.ranges;
            tabstops.forEach(function(ts, index) {
                const dest = this.$openTabstops[index] || ts;
                    
                for (let i = ts.length; i--;) {
                    const p = ts[i];
                    const range = Range.fromPoints(p.start, p.end || p.start);
                    movePoint(range.start, start);
                    movePoint(range.end, start);
                    range.original = p;
                    range.tabstop = dest;
                    ranges.push(range);
                    if (dest != ts)
                        dest.unshift(range);
                    else
                        dest[i] = range;
                    if (p.fmtString) {
                        range.linked = true;
                        dest.hasLinkedRanges = true;
                    } else if (!dest.firstNonLinked)
                        dest.firstNonLinked = range;
                }
                if (!dest.firstNonLinked)
                    dest.hasLinkedRanges = false;
                if (dest === ts) {
                    arg.push(dest);
                    this.$openTabstops[index] = dest;
                }
                this.addTabstopMarkers(dest);
            }, this);
            
            if (arg.length > 2) {
                if (this.tabstops.length)
                    arg.push(arg.splice(2, 1)[0]);
                this.tabstops.splice(...arg);
            }
        };

        this.addTabstopMarkers = function(ts) {
            const session = this.editor.session;
            ts.forEach(range => {
                if  (!range.markerId)
                    range.markerId = session.addMarker(range, "ace_snippet-marker", "text");
            });
        };
        this.removeTabstopMarkers = function(ts) {
            const session = this.editor.session;
            ts.forEach(range => {
                session.removeMarker(range.markerId);
                range.markerId = null;
            });
        };
        this.removeRange = function(range) {
            let i = range.tabstop.indexOf(range);
            range.tabstop.splice(i, 1);
            i = this.ranges.indexOf(range);
            this.ranges.splice(i, 1);
            this.editor.session.removeMarker(range.markerId);
            if (!range.tabstop.length) {
                i = this.tabstops.indexOf(range.tabstop);
                if (i != -1)
                    this.tabstops.splice(i, 1);
                if (!this.tabstops.length)
                    this.detach();
            }
        };

        this.keyboardHandler = new HashHandler();
        this.keyboardHandler.bindKeys({
            "Tab"(ed) {
                if (exports.snippetManager && exports.snippetManager.expandWithTab(ed)) {
                    return;
                }

                ed.tabstopManager.tabNext(1);
            },
            "Shift-Tab"(ed) {
                ed.tabstopManager.tabNext(-1);
            },
            "Esc"(ed) {
                ed.tabstopManager.detach();
            },
            "Return"(ed) {
                return false;
            }
        });
    }).call(TabstopManager.prototype);



    const changeTracker = {};
    changeTracker.onChange = Anchor.prototype.onChange;
    changeTracker.setPosition = function(row, column) {
        this.pos.row = row;
        this.pos.column = column;
    };
    changeTracker.update = function(pos, delta, $insertRight) {
        this.$insertRight = $insertRight;
        this.pos = pos; 
        this.onChange(delta);
    };

    var movePoint = (point, diff) => {
        if (point.row == 0)
            point.column += diff.column;
        point.row += diff.row;
    };

    var moveRelative = (point, start) => {
        if (point.row == start.row)
            point.column -= start.column;
        point.row -= start.row;
    };


    require("./lib/dom").importCssString("\
    .ace_snippet-marker {\
        -moz-box-sizing: border-box;\
        box-sizing: border-box;\
        background: rgba(194, 193, 208, 0.09);\
        border: 1px dotted rgba(211, 208, 235, 0.62);\
        position: absolute;\
    }");

    exports.snippetManager = new SnippetManager();


    const Editor = require("./editor").Editor;
    (function() {
        this.insertSnippet = function(content, options) {
            return exports.snippetManager.insertSnippet(this, content, options);
        };
        this.expandSnippet = function(options) {
            return exports.snippetManager.expandWithTab(this, options);
        };
    }).call(Editor.prototype);
});

ace.define("ace/ext/emmet",["require","exports","module","ace/keyboard/hash_handler","ace/editor","ace/snippets","ace/range","resources","resources","range","tabStops","resources","utils","actions","ace/config","ace/config"], (require, exports, module) => {
    const HashHandler = require("ace/keyboard/hash_handler").HashHandler;
    const Editor = require("ace/editor").Editor;
    const snippetManager = require("ace/snippets").snippetManager;
    const Range = require("ace/range").Range;
    let emmet;
    let emmetPath;

    class AceEmmetEditor {
        setupContext(editor) {
            this.ace = editor;
            this.indentation = editor.session.getTabString();
            if (!emmet)
                emmet = window.emmet;
            emmet.require("resources").setVariable("indentation", this.indentation);
            this.$syntax = null;
            this.$syntax = this.getSyntax();
        }

        getSelectionRange() {
            const range = this.ace.getSelectionRange();
            const doc = this.ace.session.doc;
            return {
                start: doc.positionToIndex(range.start),
                end: doc.positionToIndex(range.end)
            };
        }

        createSelection(start, end) {
            const doc = this.ace.session.doc;
            this.ace.selection.setRange({
                start: doc.indexToPosition(start),
                end: doc.indexToPosition(end)
            });
        }

        getCurrentLineRange() {
            const ace = this.ace;
            const row = ace.getCursorPosition().row;
            const lineLength = ace.session.getLine(row).length;
            const index = ace.session.doc.positionToIndex({row, column: 0});
            return {
                start: index,
                end: index + lineLength
            };
        }

        getCaretPos() {
            const pos = this.ace.getCursorPosition();
            return this.ace.session.doc.positionToIndex(pos);
        }

        setCaretPos(index) {
            const pos = this.ace.session.doc.indexToPosition(index);
            this.ace.selection.moveToPosition(pos);
        }

        getCurrentLine() {
            const row = this.ace.getCursorPosition().row;
            return this.ace.session.getLine(row);
        }

        replaceContent(value, start, end, noIndent) {
            if (end == null)
                end = start == null ? this.getContent().length : start;
            if (start == null)
                start = 0;        
            
            const editor = this.ace;
            const doc = editor.session.doc;
            const range = Range.fromPoints(doc.indexToPosition(start), doc.indexToPosition(end));
            editor.session.remove(range);
            
            range.end = range.start;
            
            value = this.$updateTabstops(value);
            snippetManager.insertSnippet(editor, value);
        }

        getContent() {
            return this.ace.getValue();
        }

        getSyntax() {
            if (this.$syntax)
                return this.$syntax;
            let syntax = this.ace.session.$modeId.split("/").pop();
            if (syntax == "html" || syntax == "php") {
                const cursor = this.ace.getCursorPosition();
                let state = this.ace.session.getState(cursor.row);
                if (typeof state != "string")
                    state = state[0];
                if (state) {
                    state = state.split("-");
                    if (state.length > 1)
                        syntax = state[0];
                    else if (syntax == "php")
                        syntax = "html";
                }
            }
            return syntax;
        }

        getProfileName() {
            switch (this.getSyntax()) {
              case "css": return "css";
              case "xml":
              case "xsl":
                return "xml";
              case "html":
                let profile = emmet.require("resources").getVariable("profile");
                if (!profile)
                    profile = this.ace.session.getLines(0,2).join("").search(/<!DOCTYPE[^>]+XHTML/i) != -1 ? "xhtml": "html";
                return profile;
              default:
                const mode = this.ace.session.$mode;
                return mode.emmetConfig && mode.emmetConfig.profile || "xhtml";
            }
        }

        prompt(title) {
            return prompt(title);
        }

        getSelection() {
            return this.ace.session.getTextRange();
        }

        getFilePath() {
            return "";
        }

        $updateTabstops(value) {
            const base = 1000;
            let zeroBase = 0;
            let lastZero = null;
            const range = emmet.require('range');
            const ts = emmet.require('tabStops');
            const settings = emmet.require('resources').getVocabulary("user");
            const tabstopOptions = {
                tabstop(data) {
                    let group = parseInt(data.group, 10);
                    const isZero = group === 0;
                    if (isZero)
                        group = ++zeroBase;
                    else
                        group += base;

                    let placeholder = data.placeholder;
                    if (placeholder) {
                        placeholder = ts.processText(placeholder, tabstopOptions);
                    }

                    const result = `${${group}${placeholder ? ':' + placeholder : ''}}`;

                    if (isZero) {
                        lastZero = range.create(data.start, result);
                    }

                    return result;
                },
                escape(ch) {
                    if (ch == '$') return '\\$';
                    if (ch == '\\') return '\\\\';
                    return ch;
                }
            };

            value = ts.processText(value, tabstopOptions);

            if (settings.variables['insert_final_tabstop'] && !/\$\{0\}$/.test(value)) {
                value += '${0}';
            } else if (lastZero) {
                value = emmet.require('utils').replaceSubstring(value, '${0}', lastZero);
            }
            
            return value;
        }
    }


    const keymap = {
        expand_abbreviation: {"mac": "ctrl+alt+e", "win": "alt+e"},
        match_pair_outward: {"mac": "ctrl+d", "win": "ctrl+,"},
        match_pair_inward: {"mac": "ctrl+j", "win": "ctrl+shift+0"},
        matching_pair: {"mac": "ctrl+alt+j", "win": "alt+j"},
        next_edit_point: "alt+right",
        prev_edit_point: "alt+left",
        toggle_comment: {"mac": "command+/", "win": "ctrl+/"},
        split_join_tag: {"mac": "shift+command+'", "win": "shift+ctrl+`"},
        remove_tag: {"mac": "command+'", "win": "shift+ctrl+;"},
        evaluate_math_expression: {"mac": "shift+command+y", "win": "shift+ctrl+y"},
        increment_number_by_1: "ctrl+up",
        decrement_number_by_1: "ctrl+down",
        increment_number_by_01: "alt+up",
        decrement_number_by_01: "alt+down",
        increment_number_by_10: {"mac": "alt+command+up", "win": "shift+alt+up"},
        decrement_number_by_10: {"mac": "alt+command+down", "win": "shift+alt+down"},
        select_next_item: {"mac": "shift+command+.", "win": "shift+ctrl+."},
        select_previous_item: {"mac": "shift+command+,", "win": "shift+ctrl+,"},
        reflect_css_value: {"mac": "shift+command+r", "win": "shift+ctrl+r"},

        encode_decode_data_url: {"mac": "shift+ctrl+d", "win": "ctrl+'"},
        expand_abbreviation_with_tab: "Tab",
        wrap_with_abbreviation: {"mac": "shift+ctrl+a", "win": "shift+ctrl+a"}
    };

    const editorProxy = new AceEmmetEditor();
    exports.commands = new HashHandler();
    exports.runEmmetCommand = function runEmmetCommand(editor) {
        try {
            editorProxy.setupContext(editor);
            const actions = emmet.require("actions");
        
            if (this.action == "expand_abbreviation_with_tab") {
                if (!editor.selection.isEmpty())
                    return false;
                const pos = editor.selection.lead;
                const token = editor.session.getTokenAt(pos.row, pos.column);
                if (token && /\btag\b/.test(token.type))
                    return false;
            }
            
            if (this.action == "wrap_with_abbreviation") {
                return setTimeout(() => {
                    actions.run("wrap_with_abbreviation", editorProxy);
                }, 0);
            }
            
            var result = actions.run(this.action, editorProxy);
        } catch(e) {
            if (!emmet) {
                load(runEmmetCommand.bind(this, editor));
                return true;
            }
            editor._signal("changeStatus", typeof e == "string" ? e : e.message);
            console.log(e);
            result = false;
        }
        return result;
    };

    for (const command in keymap) {
        exports.commands.addCommand({
            name: `emmet:${command}`,
            action: command,
            bindKey: keymap[command],
            exec: exports.runEmmetCommand,
            multiSelectAction: "forEach"
        });
    }

    exports.updateCommands = (editor, enabled) => {
        if (enabled) {
            editor.keyBinding.addKeyboardHandler(exports.commands);
        } else {
            editor.keyBinding.removeKeyboardHandler(exports.commands);
        }
    };

    exports.isSupportedMode = mode => {
        if (!mode) return false;
        if (mode.emmetConfig) return true;
        const id = mode.$id || mode;
        return /css|less|scss|sass|stylus|html|php|twig|ejs|handlebars/.test(id);
    };

    exports.isAvailable = (editor, command) => {
        if (/(evaluate_math_expression|expand_abbreviation)$/.test(command))
            return true;
        const mode = editor.session.$mode;
        let isSupported = exports.isSupportedMode(mode);
        if (isSupported && mode.$modes) {
            try {
                editorProxy.setupContext(editor);
                if (/js|php/.test(editorProxy.getSyntax()))
                    isSupported = false;
            } catch(e) {}
        }
        return isSupported;
    }

    const onChangeMode = (e, target) => {
        const editor = target;
        if (!editor)
            return;
        let enabled = exports.isSupportedMode(editor.session.$mode);
        if (e.enableEmmet === false)
            enabled = false;
        if (enabled)
            load();
        exports.updateCommands(editor, enabled);
    };

    var load = cb => {
        if (typeof emmetPath == "string") {
            require("ace/config").loadModule(emmetPath, () => {
                emmetPath = null;
                cb && cb();
            });
        }
    };

    exports.AceEmmetEditor = AceEmmetEditor;
    require("ace/config").defineOptions(Editor.prototype, "editor", {
        enableEmmet: {
            set(val) {
                this[val ? "on" : "removeListener"]("changeMode", onChangeMode);
                onChangeMode({enableEmmet: !!val}, this);
            },
            value: true
        }
    });

    exports.setCore = e => {
        if (typeof e == "string")
           emmetPath = e;
        else
           emmet = e;
    };
});
                ((() => {
                    ace.require(["ace/ext/emmet"], () => {});
                }))();
            