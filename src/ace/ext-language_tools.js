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

ace.define("ace/autocomplete/popup",["require","exports","module","ace/virtual_renderer","ace/editor","ace/range","ace/lib/event","ace/lib/lang","ace/lib/dom"], (require, exports, module) => {
    const Renderer = require("../virtual_renderer").VirtualRenderer;
    const Editor = require("../editor").Editor;
    const Range = require("../range").Range;
    const event = require("../lib/event");
    const lang = require("../lib/lang");
    const dom = require("../lib/dom");

    const $singleLineEditor = el => {
        const renderer = new Renderer(el);

        renderer.$maxLines = 4;

        const editor = new Editor(renderer);

        editor.setHighlightActiveLine(false);
        editor.setShowPrintMargin(false);
        editor.renderer.setShowGutter(false);
        editor.renderer.setHighlightGutterLine(false);

        editor.$mouseHandler.$focusWaitTimout = 0;
        editor.$highlightTagPending = true;

        return editor;
    };

    const AcePopup = parentNode => {
        const el = dom.createElement("div");
        const popup = new $singleLineEditor(el);

        if (parentNode)
            parentNode.appendChild(el);
        el.style.display = "none";
        popup.renderer.content.style.cursor = "default";
        popup.renderer.setStyle("ace_autocomplete");

        popup.setOption("displayIndentGuides", false);
        popup.setOption("dragDelay", 150);

        const noop = () => {};

        popup.focus = noop;
        popup.$isFocused = true;

        popup.renderer.$cursorLayer.restartTimer = noop;
        popup.renderer.$cursorLayer.element.style.opacity = 0;

        popup.renderer.$maxLines = 8;
        popup.renderer.$keepTextAreaAtCursor = false;

        popup.setHighlightActiveLine(false);
        popup.session.highlight("");
        popup.session.$searchHighlight.clazz = "ace_highlight-marker";

        popup.on("mousedown", e => {
            const pos = e.getDocumentPosition();
            popup.selection.moveToPosition(pos);
            selectionMarker.start.row = selectionMarker.end.row = pos.row;
            e.stop();
        });

        let lastMouseEvent;
        const hoverMarker = new Range(-1,0,-1,Infinity);
        var selectionMarker = new Range(-1,0,-1,Infinity);
        selectionMarker.id = popup.session.addMarker(selectionMarker, "ace_active-line", "fullLine");
        popup.setSelectOnHover = val => {
            if (!val) {
                hoverMarker.id = popup.session.addMarker(hoverMarker, "ace_line-hover", "fullLine");
            } else if (hoverMarker.id) {
                popup.session.removeMarker(hoverMarker.id);
                hoverMarker.id = null;
            }
        };
        popup.setSelectOnHover(false);
        popup.on("mousemove", e => {
            if (!lastMouseEvent) {
                lastMouseEvent = e;
                return;
            }
            if (lastMouseEvent.x == e.x && lastMouseEvent.y == e.y) {
                return;
            }
            lastMouseEvent = e;
            lastMouseEvent.scrollTop = popup.renderer.scrollTop;
            const row = lastMouseEvent.getDocumentPosition().row;
            if (hoverMarker.start.row != row) {
                if (!hoverMarker.id)
                    popup.setRow(row);
                setHoverMarker(row);
            }
        });
        popup.renderer.on("beforeRender", () => {
            if (lastMouseEvent && hoverMarker.start.row != -1) {
                lastMouseEvent.$pos = null;
                const row = lastMouseEvent.getDocumentPosition().row;
                if (!hoverMarker.id)
                    popup.setRow(row);
                setHoverMarker(row, true);
            }
        });
        popup.renderer.on("afterRender", () => {
            const row = popup.getRow();
            const t = popup.renderer.$textLayer;
            const selected = t.element.childNodes[row - t.config.firstRow];
            if (selected == t.selectedNode)
                return;
            if (t.selectedNode)
                dom.removeCssClass(t.selectedNode, "ace_selected");
            t.selectedNode = selected;
            if (selected)
                dom.addCssClass(selected, "ace_selected");
        });
        const hideHoverMarker = () => { setHoverMarker(-1) };
        var setHoverMarker = (row, suppressRedraw) => {
            if (row !== hoverMarker.start.row) {
                hoverMarker.start.row = hoverMarker.end.row = row;
                if (!suppressRedraw)
                    popup.session._emit("changeBackMarker");
                popup._emit("changeHoverMarker");
            }
        };
        popup.getHoveredRow = () => hoverMarker.start.row;

        event.addListener(popup.container, "mouseout", hideHoverMarker);
        popup.on("hide", hideHoverMarker);
        popup.on("changeSelection", hideHoverMarker);

        popup.session.doc.getLength = () => popup.data.length;
        popup.session.doc.getLine = i => {
            const data = popup.data[i];
            if (typeof data == "string")
                return data;
            return (data && data.value) || "";
        };

        const bgTokenizer = popup.session.bgTokenizer;
        bgTokenizer.$tokenizeRow = row => {
            let data = popup.data[row];
            const tokens = [];
            if (!data)
                return tokens;
            if (typeof data == "string")
                data = {value: data};
            if (!data.caption)
                data.caption = data.value || data.name;

            let last = -1;
            let flag;
            let c;
            for (let i = 0; i < data.caption.length; i++) {
                c = data.caption[i];
                flag = data.matchMask & (1 << i) ? 1 : 0;
                if (last !== flag) {
                    tokens.push({type: data.className || `${flag ? "completion-highlight" : ""}`, value: c});
                    last = flag;
                } else {
                    tokens[tokens.length - 1].value += c;
                }
            }

            if (data.meta) {
                const maxW = popup.renderer.$size.scrollerWidth / popup.renderer.layerConfig.characterWidth;
                let metaData = data.meta;
                if (metaData.length + data.caption.length > maxW - 2) {
                    metaData = `${metaData.substr(0, maxW - data.caption.length - 3)}\u2026`
                }
                tokens.push({type: "rightAlignedText", value: metaData});
            }
            return tokens;
        };
        bgTokenizer.$updateOnChange = noop;
        bgTokenizer.start = noop;

        popup.session.$computeWidth = function() {
            return this.screenWidth = 0;
        };

        popup.$blockScrolling = Infinity;
        popup.isOpen = false;
        popup.isTopdown = false;

        popup.data = [];
        popup.setData = list => {
            popup.setValue(lang.stringRepeat("\n", list.length), -1);
            popup.data = list || [];
            popup.setRow(0);
        };
        popup.getData = row => popup.data[row];

        popup.getRow = () => selectionMarker.start.row;
        popup.setRow = function(line) {
            line = Math.max(0, Math.min(this.data.length, line));
            if (selectionMarker.start.row != line) {
                popup.selection.clearSelection();
                selectionMarker.start.row = selectionMarker.end.row = line || 0;
                popup.session._emit("changeBackMarker");
                popup.moveCursorTo(line || 0, 0);
                if (popup.isOpen)
                    popup._signal("select");
            }
        };

        popup.on("changeSelection", () => {
            if (popup.isOpen)
                popup.setRow(popup.selection.lead.row);
            popup.renderer.scrollCursorIntoView();
        });

        popup.hide = function() {
            this.container.style.display = "none";
            this._signal("hide");
            popup.isOpen = false;
        };
        popup.show = function(pos, lineHeight, topdownOnly) {
            const el = this.container;
            const screenHeight = window.innerHeight;
            const screenWidth = window.innerWidth;
            const renderer = this.renderer;
            const maxH = renderer.$maxLines * lineHeight * 1.4;
            let top = pos.top + this.$borderSize;
            const allowTopdown = top > screenHeight / 2 && !topdownOnly;
            if (allowTopdown && top + lineHeight + maxH > screenHeight) {
                renderer.$maxPixelHeight = top - 2 * this.$borderSize;
                el.style.top = "";
                el.style.bottom = `${screenHeight - top}px`;
                popup.isTopdown = false;
            } else {
                top += lineHeight;
                renderer.$maxPixelHeight = screenHeight - top - 0.2 * lineHeight;
                el.style.top = `${top}px`;
                el.style.bottom = "";
                popup.isTopdown = true;
            }

            el.style.display = "";
            this.renderer.$textLayer.checkForSizeChanges();

            let left = pos.left;
            if (left + el.offsetWidth > screenWidth)
                left = screenWidth - el.offsetWidth;

            el.style.left = `${left}px`;

            this._signal("show");
            lastMouseEvent = null;
            popup.isOpen = true;
        };

        popup.getTextLeftOffset = function() {
            return this.$borderSize + this.renderer.$padding + this.$imageSize;
        };

        popup.$imageSize = 0;
        popup.$borderSize = 1;

        return popup;
    };

    dom.importCssString("\
    .ace_editor.ace_autocomplete .ace_marker-layer .ace_active-line {\
        background-color: #333;\
        border-left: 4px solid #F5B840;\
        z-index: 1;\
    }\
    .ace_editor.ace_autocomplete .ace_line-hover {\
        border: 1px solid #abbffe;\
        margin-top: -1px;\
        background: rgba(233,233,253,0.4);\
    }\
    .ace_editor.ace_autocomplete .ace_line-hover {\
        position: absolute;\
        z-index: 2;\
    }\
    .ace_editor.ace_autocomplete .ace_scroller {\
       background: none;\
       border: none;\
       box-shadow: none;\
    }\
    .ace_rightAlignedText {\
        color: #CBC9BF;\
        font-size: 12pt;\
        display: inline-block;\
        position: absolute;\
        right: 4px;\
        text-align: right;\
        z-index: -1;\
    }\
    .ace_editor.ace_autocomplete .ace_selected .ace_rightAlignedText {\
        color: #F5B840;\
    }\
    .ace_editor.ace_autocomplete .ace_selected .ace_completion-highlight{\
        color: #FFF;\
    }\
    .ace_editor.ace_autocomplete {\
        width: 280px;\
        font-family: 'Inconsolata';\
        font-size: 12pt; \
        z-index: 200000;\
        background: #17181a;\
        color: #CBC9BF;\
        padding: 13px; \
        border: 0.5px solid #232324;\
        position: fixed;\
        line-height: 1.4;\
    }\
    .ace_editor.ace_autocomplete .ace_selected {\
        color: #FFF; \
        padding-left: 8px; \
    }\
    ");

    exports.AcePopup = AcePopup;
});

ace.define("ace/autocomplete/util",["require","exports","module"], (require, exports, module) => {
    exports.parForEach = (array, fn, callback) => {
        let completed = 0;
        const arLength = array.length;
        if (arLength === 0)
            callback();
        for (let i = 0; i < arLength; i++) {
            fn(array[i], (result, err) => {
                completed++;
                if (completed === arLength)
                    callback(result, err);
            });
        }
    };

    const ID_REGEX = /[a-zA-Z_0-9\$\-\u00A2-\uFFFF]/;

    exports.retrievePrecedingIdentifier = (text, pos, regex) => {
        regex = regex || ID_REGEX;
        const buf = [];
        for (let i = pos-1; i >= 0; i--) {
            if (regex.test(text[i]))
                buf.push(text[i]);
            else
                break;
        }
        return buf.reverse().join("");
    };

    exports.retrieveFollowingIdentifier = (text, pos, regex) => {
        regex = regex || ID_REGEX;
        const buf = [];
        for (let i = pos; i < text.length; i++) {
            if (regex.test(text[i]))
                buf.push(text[i]);
            else
                break;
        }
        return buf;
    };

    exports.getCompletionPrefix = function (editor) {
        const pos = editor.getCursorPosition();
        const line = editor.session.getLine(pos.row);
        let prefix;
        editor.completers.forEach(completer => {
            if (completer.identifierRegexps) {
                completer.identifierRegexps.forEach(identifierRegex => {
                    if (!prefix && identifierRegex)
                        prefix = this.retrievePrecedingIdentifier(line, pos.column, identifierRegex);
                });
            }
        });
        return prefix || this.retrievePrecedingIdentifier(line, pos.column);
    };
});

ace.define("ace/autocomplete",["require","exports","module","ace/keyboard/hash_handler","ace/autocomplete/popup","ace/autocomplete/util","ace/lib/event","ace/lib/lang","ace/lib/dom","ace/snippets"], (require, exports, module) => {
    const HashHandler = require("./keyboard/hash_handler").HashHandler;
    const AcePopup = require("./autocomplete/popup").AcePopup;
    const util = require("./autocomplete/util");
    const event = require("./lib/event");
    const lang = require("./lib/lang");
    const dom = require("./lib/dom");
    const snippetManager = require("./snippets").snippetManager;

    const Autocomplete = function() {
        this.autoInsert = false;
        this.autoSelect = true;
        this.exactMatch = false;
        this.gatherCompletionsId = 0;
        this.keyboardHandler = new HashHandler();
        this.keyboardHandler.bindKeys(this.commands);

        this.blurListener = this.blurListener.bind(this);
        this.changeListener = this.changeListener.bind(this);
        this.mousedownListener = this.mousedownListener.bind(this);
        this.mousewheelListener = this.mousewheelListener.bind(this);

        this.changeTimer = lang.delayedCall(() => {
            this.updateCompletions(true);
        });

        this.tooltipTimer = lang.delayedCall(this.updateDocTooltip.bind(this), 50);
    };

    (function() {

        this.$init = function() {
            this.popup = new AcePopup(document.body || document.documentElement);
            this.popup.on("click", e => {
                this.insertMatch();
                e.stop();
            });
            this.popup.focus = this.editor.focus.bind(this.editor);
            this.popup.on("show", this.tooltipTimer.bind(null, null));
            this.popup.on("select", this.tooltipTimer.bind(null, null));
            this.popup.on("changeHoverMarker", this.tooltipTimer.bind(null, null));
            return this.popup;
        };

        this.getPopup = function() {
            return this.popup || this.$init();
        };

        this.openPopup = function(editor, prefix, keepPopupPosition) {
            if (!this.popup)
                this.$init();

            this.popup.setData(this.completions.filtered);

            editor.keyBinding.addKeyboardHandler(this.keyboardHandler);
            
            const renderer = editor.renderer;
            this.popup.setRow(this.autoSelect ? 0 : -1);
            if (!keepPopupPosition) {
                this.popup.setTheme(editor.getTheme());
                this.popup.setFontSize(editor.getFontSize());

                const lineHeight = renderer.layerConfig.lineHeight;

                const pos = renderer.$cursorLayer.getPixelPosition(this.base, true);
                pos.left -= this.popup.getTextLeftOffset();

                const rect = editor.container.getBoundingClientRect();
                pos.top += rect.top - renderer.layerConfig.offset;
                pos.left += rect.left - editor.renderer.scrollLeft;
                pos.left += renderer.gutterWidth;

                this.popup.show(pos, lineHeight);
            } else if (keepPopupPosition && !prefix) {
                this.detach();
            }
        };

        this.detach = function() {
            this.editor.keyBinding.removeKeyboardHandler(this.keyboardHandler);
            this.editor.off("changeSelection", this.changeListener);
            this.editor.off("blur", this.blurListener);
            this.editor.off("mousedown", this.mousedownListener);
            this.editor.off("mousewheel", this.mousewheelListener);
            this.changeTimer.cancel();
            this.hideDocTooltip();

            this.gatherCompletionsId += 1;
            if (this.popup && this.popup.isOpen)
                this.popup.hide();

            if (this.base)
                this.base.detach();
            this.activated = false;
            this.completions = this.base = null;
        };

        this.changeListener = function(e) {
            const cursor = this.editor.selection.lead;
            if (cursor.row != this.base.row || cursor.column < this.base.column) {
                this.detach();
            }
            if (this.activated)
                this.changeTimer.schedule();
            else
                this.detach();
        };

        this.blurListener = function(e) {
            const el = document.activeElement;
            const text = this.editor.textInput.getElement();
            const fromTooltip = e.relatedTarget && e.relatedTarget == this.tooltipNode;
            const container = this.popup && this.popup.container;
            if (el != text && el.parentNode != container && !fromTooltip
                && el != this.tooltipNode && e.relatedTarget != text
            ) {
                this.detach();
            }
        };

        this.mousedownListener = function(e) {
            this.detach();
        };

        this.mousewheelListener = function(e) {
            this.detach();
        };

        this.goTo = function(where) {
            let row = this.popup.getRow();
            const max = this.popup.session.getLength() - 1;

            switch(where) {
                case "up": row = row <= 0 ? max : row - 1; break;
                case "down": row = row >= max ? -1 : row + 1; break;
                case "start": row = 0; break;
                case "end": row = max; break;
            }

            this.popup.setRow(row);
        };

        this.insertMatch = function(data, options) {
            if (!data)
                data = this.popup.getData(this.popup.getRow());
            if (!data)
                return false;

            if (data.completer && data.completer.insertMatch) {
                data.completer.insertMatch(this.editor, data);
            } else {
                if (this.completions.filterText) {
                    const ranges = this.editor.selection.getAllRanges();
                    for (let i = 0, range; range = ranges[i]; i++) {
                        range.start.column -= this.completions.filterText.length;
                        this.editor.session.remove(range);
                    }
                }
                if (data.snippet)
                    snippetManager.insertSnippet(this.editor, data.snippet);
                else
                    this.editor.execCommand("insertstring", data.value || data);
            }
            this.detach();
        };


        this.commands = {
            "Up"(editor) { editor.completer.goTo("up"); },
            "Down"(editor) { editor.completer.goTo("down"); },
            "Ctrl-Up|Ctrl-Home"(editor) { editor.completer.goTo("start"); },
            "Ctrl-Down|Ctrl-End"(editor) { editor.completer.goTo("end"); },

            "Esc"(editor) { editor.completer.detach(); },
            "Return"(editor) { return editor.completer.insertMatch(); },
            "Shift-Return"(editor) { editor.completer.insertMatch(null, {deleteSuffix: true}); },
            "Tab"(editor) {
                const result = editor.completer.insertMatch();
                if (!result && !editor.tabstopManager)
                    editor.completer.goTo("down");
                else
                    return result;
            },

            "PageUp"(editor) { editor.completer.popup.gotoPageUp(); },
            "PageDown"(editor) { editor.completer.popup.gotoPageDown(); }
        };

        this.gatherCompletions = function(editor, callback) {
            const session = editor.getSession();
            const pos = editor.getCursorPosition();

            const line = session.getLine(pos.row);
            const prefix = util.getCompletionPrefix(editor);

            this.base = session.doc.createAnchor(pos.row, pos.column - prefix.length);
            this.base.$insertRight = true;

            let matches = [];
            let total = editor.completers.length;
            editor.completers.forEach((completer, i) => {
                completer.getCompletions(editor, session, pos, prefix, (err, results) => {
                    if (!err && results)
                        matches = matches.concat(results);
                    const pos = editor.getCursorPosition();
                    const line = session.getLine(pos.row);
                    callback(null, {
                        prefix,
                        matches,
                        finished: (--total === 0)
                    });
                });
            });
            return true;
        };

        this.showPopup = function(editor) {
            if (this.editor)
                this.detach();

            this.activated = true;

            this.editor = editor;
            if (editor.completer != this) {
                if (editor.completer)
                    editor.completer.detach();
                editor.completer = this;
            }

            editor.on("changeSelection", this.changeListener);
            editor.on("blur", this.blurListener);
            editor.on("mousedown", this.mousedownListener);
            editor.on("mousewheel", this.mousewheelListener);

            this.updateCompletions();
        };

        this.updateCompletions = function(keepPopupPosition) {
            if (keepPopupPosition && this.base && this.completions) {
                const pos = this.editor.getCursorPosition();
                const prefix = this.editor.session.getTextRange({start: this.base, end: pos});
                if (prefix == this.completions.filterText)
                    return;
                this.completions.setFilter(prefix);
                if (!this.completions.filtered.length)
                    return this.detach();
                if (this.completions.filtered.length == 1
                && this.completions.filtered[0].value == prefix
                && !this.completions.filtered[0].snippet)
                    return this.detach();
                this.openPopup(this.editor, prefix, keepPopupPosition);
                return;
            }
            const _id = this.gatherCompletionsId;
            this.gatherCompletions(this.editor, (err, results) => {
                const detachIfFinished = () => {
                    if (!results.finished) return;
                    return this.detach();
                };

                const prefix = results.prefix;
                const matches = results && results.matches;

                if (!matches || !matches.length)
                    return detachIfFinished();
                if (prefix.indexOf(results.prefix) !== 0 || _id != this.gatherCompletionsId)
                    return;

                this.completions = new FilteredList(matches);

                if (this.exactMatch)
                    this.completions.exactMatch = true;

                this.completions.setFilter(prefix);
                const filtered = this.completions.filtered;
                if (!filtered.length)
                    return detachIfFinished();
                if (filtered.length == 1 && filtered[0].value == prefix && !filtered[0].snippet)
                    return detachIfFinished();
                if (this.autoInsert && filtered.length == 1 && results.finished)
                    return this.insertMatch(filtered[0]);

                this.openPopup(this.editor, prefix, keepPopupPosition);
            });
        };

        this.cancelContextMenu = function() {
            this.editor.$mouseHandler.cancelContextMenu();
        };

        this.updateDocTooltip = function() {
            const popup = this.popup;
            const all = popup.data;
            const selected = all && (all[popup.getHoveredRow()] || all[popup.getRow()]);
            let doc = null;
            if (!selected || !this.editor || !this.popup.isOpen)
                return this.hideDocTooltip();
            this.editor.completers.some(completer => {
                if (completer.getDocTooltip)
                    doc = completer.getDocTooltip(selected);
                return doc;
            });
            if (!doc)
                doc = selected;

            if (typeof doc == "string")
                doc = {docText: doc};
            if (!doc || !(doc.docHTML || doc.docText))
                return this.hideDocTooltip();
            this.showDocTooltip(doc);
        };

        this.showDocTooltip = function(item) {
            if (!this.tooltipNode) {
                this.tooltipNode = dom.createElement("div");
                this.tooltipNode.className = "ace_tooltip ace_doc-tooltip";
                this.tooltipNode.style.margin = 0;
                this.tooltipNode.style.pointerEvents = "auto";
                this.tooltipNode.tabIndex = -1;
                this.tooltipNode.onblur = this.blurListener.bind(this);
            }

            const tooltipNode = this.tooltipNode;
            if (item.docHTML) {
                tooltipNode.innerHTML = item.docHTML;
            } else if (item.docText) {
                tooltipNode.textContent = item.docText;
            }

            if (!tooltipNode.parentNode)
                document.body.appendChild(tooltipNode);
            const popup = this.popup;
            const rect = popup.container.getBoundingClientRect();
            tooltipNode.style.top = popup.container.style.top;
            tooltipNode.style.bottom = popup.container.style.bottom;

            if (window.innerWidth - rect.right < 320) {
                tooltipNode.style.right = `${window.innerWidth - rect.left}px`;
                tooltipNode.style.left = "";
            } else {
                tooltipNode.style.left = `${rect.right + 1}px`;
                tooltipNode.style.right = "";
            }
            tooltipNode.style.display = "block";
        };

        this.hideDocTooltip = function() {
            this.tooltipTimer.cancel();
            if (!this.tooltipNode) return;
            const el = this.tooltipNode;
            if (!this.editor.isFocused() && document.activeElement == el)
                this.editor.focus();
            this.tooltipNode = null;
            if (el.parentNode)
                el.parentNode.removeChild(el);
        };

    }).call(Autocomplete.prototype);

    Autocomplete.startCommand = {
        name: "startAutocomplete",
        exec(editor) {
            if (!editor.completer)
                editor.completer = new Autocomplete();
            editor.completer.autoInsert = false;
            editor.completer.autoSelect = true;
            editor.completer.showPopup(editor);
            editor.completer.cancelContextMenu();
        },
        bindKey: "Ctrl-Space|Ctrl-Shift-Space|Alt-Space"
    };

    var FilteredList = function(array, filterText) {
        this.all = array;
        this.filtered = array;
        this.filterText = filterText || "";
        this.exactMatch = false;
    };
    (function(){
        this.setFilter = function(str) {
            if (str.length > this.filterText && str.lastIndexOf(this.filterText, 0) === 0)
                var matches = this.filtered;
            else
                var matches = this.all;

            this.filterText = str;
            matches = this.filterCompletions(matches, this.filterText);
            matches = matches.sort((a, b) => b.exactMatch - a.exactMatch || b.score - a.score);
            let prev = null;
            matches = matches.filter(item => {
                const caption = item.snippet || item.caption || item.value;
                if (caption === prev) return false;
                prev = caption;
                return true;
            });

            this.filtered = matches;
        };
        this.filterCompletions = function(items, needle) {
            const results = [];
            const upper = needle.toUpperCase();
            const lower = needle.toLowerCase();
            loop: for (let i = 0, item; item = items[i]; i++) {
                const caption = item.value || item.caption || item.snippet;
                if (!caption) continue;
                let lastIndex = -1;
                let matchMask = 0;
                let penalty = 0;
                let index;
                let distance;

                if (this.exactMatch) {
                    if (needle !== caption.substr(0, needle.length))
                        continue loop;
                }else{
                    for (let j = 0; j < needle.length; j++) {
                        const i1 = caption.indexOf(lower[j], lastIndex + 1);
                        const i2 = caption.indexOf(upper[j], lastIndex + 1);
                        index = (i1 >= 0) ? ((i2 < 0 || i1 < i2) ? i1 : i2) : i2;
                        if (index < 0)
                            continue loop;
                        distance = index - lastIndex - 1;
                        if (distance > 0) {
                            if (lastIndex === -1)
                                penalty += 10;
                            penalty += distance;
                        }
                        matchMask = matchMask | (1 << index);
                        lastIndex = index;
                    }
                }
                item.matchMask = matchMask;
                item.exactMatch = penalty ? 0 : 1;
                item.score = (item.score || 0) - penalty;
                results.push(item);
            }
            return results;
        };
    }).call(FilteredList.prototype);

    exports.Autocomplete = Autocomplete;
    exports.FilteredList = FilteredList;
});

ace.define("ace/autocomplete/text_completer",["require","exports","module","ace/range"], (require, exports, module) => {
    const Range = require("../range").Range;
    
    const splitRegex = /[^a-zA-Z_0-9\$\-\u00C0-\u1FFF\u2C00-\uD7FF\w]+/;

    function getWordIndex(doc, pos) {
        const textBefore = doc.getTextRange(Range.fromPoints({row: 0, column:0}, pos));
        return textBefore.split(splitRegex).length - 1;
    }
    function wordDistance(doc, pos) {
        const prefixPos = getWordIndex(doc, pos);
        const words = doc.getValue().split(splitRegex);
        const wordScores = Object.create(null);
        
        const currentWord = words[prefixPos];

        words.forEach((word, idx) => {
            if (!word || word === currentWord) return;

            const distance = Math.abs(prefixPos - idx);
            const score = words.length - distance;
            if (wordScores[word]) {
                wordScores[word] = Math.max(score, wordScores[word]);
            } else {
                wordScores[word] = score;
            }
        });
        return wordScores;
    }

    exports.getCompletions = (editor, session, pos, prefix, callback) => {
        const wordScore = wordDistance(session, pos, prefix);
        const wordList = Object.keys(wordScore);
        callback(null, wordList.map(word => ({
            caption: word,
            value: word,
            score: wordScore[word],
            meta: "local"
        })));
    };
});

ace.define("ace/ext/language_tools",["require","exports","module","ace/snippets","ace/autocomplete","ace/config","ace/lib/lang","ace/autocomplete/util","ace/autocomplete/text_completer","ace/editor","ace/config"], (require, exports, module) => {
    const snippetManager = require("../snippets").snippetManager;
    const Autocomplete = require("../autocomplete").Autocomplete;
    const config = require("../config");
    const lang = require("../lib/lang");
    const util = require("../autocomplete/util");

    const textCompleter = require("../autocomplete/text_completer");
    const keyWordCompleter = {
        getCompletions(editor, session, pos, prefix, callback) {
            if (session.$mode.completer) {
                return session.$mode.completer.getCompletions(editor, session, pos, prefix, callback);
            }
            const state = editor.session.getState(pos.row);
            const completions = session.$mode.getCompletions(state, session, pos, prefix);
            callback(null, completions);
        }
    };

    const snippetCompleter = {
        getCompletions(editor, session, pos, prefix, callback) {
            const snippetMap = snippetManager.snippetMap;
            const completions = [];
            snippetManager.getActiveScopes(editor).forEach(scope => {
                const snippets = snippetMap[scope] || [];
                for (let i = snippets.length; i--;) {
                    const s = snippets[i];
                    const caption = s.name || s.tabTrigger;
                    if (!caption)
                        continue;
                    completions.push({
                        caption,
                        snippet: s.content,
                        meta: s.tabTrigger && !s.name ? `${s.tabTrigger}\u21E5 ` : "snippet",
                        type: "snippet"
                    });
                }
            }, this);
            callback(null, completions);
        },
        getDocTooltip(item) {
            if (item.type == "snippet" && !item.docHTML) {
                item.docHTML = [
                    "<b>", lang.escapeHTML(item.caption), "</b>", "<hr></hr>",
                    lang.escapeHTML(item.snippet)
                ].join("");
            }
        }
    };

    const completers = [snippetCompleter, textCompleter, keyWordCompleter];
    exports.setCompleters = val => {
        completers.length = 0;
        if (val) completers.push(...val);
    };
    exports.addCompleter = completer => {
        completers.push(completer);
    };
    exports.textCompleter = textCompleter;
    exports.keyWordCompleter = keyWordCompleter;
    exports.snippetCompleter = snippetCompleter;

    const expandSnippet = {
        name: "expandSnippet",
        exec(editor) {
            return snippetManager.expandWithTab(editor);
        },
        bindKey: "Tab"
    };

    const onChangeMode = (e, editor) => {
        loadSnippetsForMode(editor.session.$mode);
    };

    var loadSnippetsForMode = mode => {
        const id = mode.$id;
        if (!snippetManager.files)
            snippetManager.files = {};
        loadSnippetFile(id);
        if (mode.modes)
            mode.modes.forEach(loadSnippetsForMode);
    };

    var loadSnippetFile = id => {
        if (!id || snippetManager.files[id])
            return;
        const snippetFilePath = id.replace("mode", "snippets");
        snippetManager.files[id] = {};
        config.loadModule(snippetFilePath, m => {
            if (m) {
                snippetManager.files[id] = m;
                if (!m.snippets && m.snippetText)
                    m.snippets = snippetManager.parseSnippetFile(m.snippetText);
                snippetManager.register(m.snippets || [], m.scope);
                if (m.includeScopes) {
                    snippetManager.snippetMap[m.scope].includeScopes = m.includeScopes;
                    m.includeScopes.forEach(x => {
                        loadSnippetFile(`ace/mode/${x}`);
                    });
                }
            }
        });
    };

    const doLiveAutocomplete = e => {
        const editor = e.editor;
        const hasCompleter = editor.completer && editor.completer.activated;
        if (e.command.name === "backspace") {
            if (hasCompleter && !util.getCompletionPrefix(editor))
                editor.completer.detach();
        }
        else if (e.command.name === "insertstring") {
            const prefix = util.getCompletionPrefix(editor);
            if (prefix && !hasCompleter) {
                if (!editor.completer) {
                    editor.completer = new Autocomplete();
                }
                editor.completer.autoInsert = false;
                editor.completer.showPopup(editor);
            }
        }
    };

    const Editor = require("../editor").Editor;
    require("../config").defineOptions(Editor.prototype, "editor", {
        enableBasicAutocompletion: {
            set(val) {
                if (val) {
                    if (!this.completers)
                        this.completers = Array.isArray(val)? val: completers;
                    this.commands.addCommand(Autocomplete.startCommand);
                } else {
                    this.commands.removeCommand(Autocomplete.startCommand);
                }
            },
            value: false
        },
        enableLiveAutocompletion: {
            set(val) {
                if (val) {
                    if (!this.completers)
                        this.completers = Array.isArray(val)? val: completers;
                    this.commands.on('afterExec', doLiveAutocomplete);
                } else {
                    this.commands.removeListener('afterExec', doLiveAutocomplete);
                }
            },
            value: false
        },
        enableSnippets: {
            set(val) {
                if (val) {
                    this.commands.addCommand(expandSnippet);
                    this.on("changeMode", onChangeMode);
                    onChangeMode(null, this);
                } else {
                    this.commands.removeCommand(expandSnippet);
                    this.off("changeMode", onChangeMode);
                }
            },
            value: false
        }
    });
});
                ((() => {
                    ace.require(["ace/ext/language_tools"], () => {});
                }))();
            