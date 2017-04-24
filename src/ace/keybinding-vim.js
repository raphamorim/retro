ace.define("ace/keyboard/vim",["require","exports","module","ace/range","ace/lib/event_emitter","ace/lib/dom","ace/lib/oop","ace/lib/keys","ace/lib/event","ace/search","ace/lib/useragent","ace/search_highlight","ace/commands/multi_select_commands","ace/mode/text","ace/multi_select"], (require, exports, module) => {
  function log() {
    let d = "";
    function format(p) {
      if (typeof p != "object")
        return `${p}`;
      if ("line" in p) {
        return `${p.line}:${p.ch}`;
      }
      if ("anchor" in p) {
        return `${format(p.anchor)}->${format(p.head)}`;
      }
      if (Array.isArray(p))
        return `[${p.map(x => format(x))}]`;
      return JSON.stringify(p);
    }

    for (const p of arguments) {
      const f = format(p);
      d += `${f}  `;
    }

    console.log(d);
  }
  const Range = require("../range").Range;
  const EventEmitter = require("../lib/event_emitter").EventEmitter;
  const dom = require("../lib/dom");
  const oop = require("../lib/oop");
  const KEYS = require("../lib/keys");
  const event = require("../lib/event");
  const Search = require("../search").Search;
  const useragent = require("../lib/useragent");
  const SearchHighlight = require("../search_highlight").SearchHighlight;
  const multiSelectCommands = require("../commands/multi_select_commands");
  const TextModeTokenRe = require("../mode/text").Mode.prototype.tokenRe;
  require("../multi_select");

  class CodeMirror {
    constructor(ace) {
      this.ace = ace;
      this.state = {};
      this.marks = {};
      this.$uid = 0;
      this.onChange = this.onChange.bind(this);
      this.onSelectionChange = this.onSelectionChange.bind(this);
      this.onBeforeEndOperation = this.onBeforeEndOperation.bind(this);
      this.ace.on('change', this.onChange);
      this.ace.on('changeSelection', this.onSelectionChange);
      this.ace.on('beforeEndOperation', this.onBeforeEndOperation);
    }

    static Pos(line, ch) {
      if (!(this instanceof Pos)) return new Pos(line, ch);
      this.line = line; this.ch = ch;
    }

    static defineOption(name, val, setter) {}

    static keyName(e) {
      if (e.key) return e.key;
      let key = (KEYS[e.keyCode] || "");
      if (key.length == 1) key = key.toUpperCase();
      key = event.getModifierString(e).replace(/(^|-)\w/g, m => m.toUpperCase()) + key;
      return key;
    }

    static lookupKey(key, map, handle) {
      if (typeof map == "string")
        map = CodeMirror.keyMap[map];
      const found = typeof map == "function" ? map(key) : map[key];
      if (found === false) return "nothing";
      if (found === "...") return "multi";
      if (found != null && handle(found)) return "handled";

      if (map.fallthrough) {
        if (!Array.isArray(map.fallthrough))
          return lookupKey(key, map.fallthrough, handle);
        for (let i = 0; i < map.fallthrough.length; i++) {
          const result = lookupKey(key, map.fallthrough[i], handle);
          if (result) return result;
        }
      }
    }

    static signal(o, name, e) { return o._signal(name, e) }

    static isWordChar(ch) {
      if (ch < "\x7f") return /^\w$/.test(ch);
      TextModeTokenRe.lastIndex = 0;
      return TextModeTokenRe.test(ch);
    }

    static defineExtension(name, fn) {
      CodeMirror.prototype[name] = fn;
    }
  }

  CodeMirror.commands = {
    redo(cm) { cm.ace.redo(); },
    undo(cm) { cm.ace.undo(); },
    newlineAndIndent(cm) { cm.ace.insert("\n"); }
  };
  CodeMirror.keyMap = {};
  CodeMirror.addClass = CodeMirror.rmClass =
  CodeMirror.e_stop = () => {};
  CodeMirror.keyMap['default'] = key => cm => {
    const cmd = cm.ace.commands.commandKeyBinding[key.toLowerCase()];
    return cmd && cm.ace.execCommand(cmd) !== false;
  };
  CodeMirror.on = event.addListener;
  CodeMirror.off = event.removeListener;

  (function() {
    oop.implement(CodeMirror.prototype, EventEmitter);

    this.destroy = function() {
      this.ace.off('change', this.onChange);
      this.ace.off('changeSelection', this.onSelectionChange);
      this.ace.off('beforeEndOperation', this.onBeforeEndOperation);
      this.removeOverlay();
    };
    this.virtualSelectionMode = function() {
      return this.ace.inVirtualSelectionMode && this.ace.selection.index;
    };
    this.onChange = function(delta) {
      const change = { text: delta.action[0] == 'i' ? delta.lines : [] };
      const curOp = this.curOp = this.curOp || {};
      if (!curOp.changeHandlers)
        curOp.changeHandlers = this._eventRegistry["change"] && this._eventRegistry["change"].slice();
      if (this.virtualSelectionMode()) return;
      if (!curOp.lastChange) {
        curOp.lastChange = curOp.change = change;
      } else {
        curOp.lastChange.next = curOp.lastChange = change;
      }
      this.$updateMarkers(delta);
    };
    this.onSelectionChange = function() {
      const curOp = this.curOp = this.curOp || {};
      if (!curOp.cursorActivityHandlers)
        curOp.cursorActivityHandlers = this._eventRegistry["cursorActivity"] && this._eventRegistry["cursorActivity"].slice();
      this.curOp.cursorActivity = true;
      if (this.ace.inMultiSelectMode) {
        this.ace.keyBinding.removeKeyboardHandler(multiSelectCommands.keyboardHandler);
      }
    };
    this.operation = function(fn, force) {
      if (!force && this.curOp || force && this.curOp && this.curOp.force) {
        return fn();
      }
      if (force || !this.ace.curOp) {
        if (this.curOp)
          this.onBeforeEndOperation();
      }
      if (!this.ace.curOp) {
        var prevOp = this.ace.prevOp;
        this.ace.startOperation({
          command: { name: "vim",  scrollIntoView: "cursor" }
        });
      }
      const curOp = this.curOp = this.curOp || {};
      this.curOp.force = force;
      const result = fn();
      if (this.ace.curOp && this.ace.curOp.command.name == "vim") {
        this.ace.endOperation();
        if (!curOp.cursorActivity && !curOp.lastChange && prevOp)
          this.ace.prevOp = prevOp;
      }
      if (force || !this.ace.curOp) {
        if (this.curOp)
          this.onBeforeEndOperation();
      }
      return result;
    };
    this.onBeforeEndOperation = function() {
      const op = this.curOp;
      if (op) {
        if (op.change) { this.signal("change", op.change, op); }
        if (op && op.cursorActivity) { this.signal("cursorActivity", null, op); }
        this.curOp = null;
      }
    };

    this.signal = function(eventName, e, handlers) {
      let listeners = handlers ? handlers[`${eventName}Handlers`]
          : (this._eventRegistry || {})[eventName];
      if (!listeners)
          return;
      listeners = listeners.slice();
      for (let i=0; i<listeners.length; i++)
          listeners[i](this, e);
    };
    this.firstLine = () => 0;
    this.lastLine = function() { return this.ace.session.getLength() - 1; };
    this.lineCount = function() { return this.ace.session.getLength(); };
    this.setCursor = function(line, ch) {
      if (typeof line === 'object') {
        ch = line.ch;
        line = line.line;
      }
      if (!this.ace.inVirtualSelectionMode)
        this.ace.exitMultiSelectMode();
      this.ace.session.unfold({row: line, column: ch});
      this.ace.selection.moveTo(line, ch);
    };
    this.getCursor = function(p) {
      const sel = this.ace.selection;
      const pos = p == 'anchor' ? (sel.isEmpty() ? sel.lead : sel.anchor) :
          p == 'head' || !p ? sel.lead : sel.getRange()[p];
      return toCmPos(pos);
    };
    this.listSelections = function(p) {
      const ranges = this.ace.multiSelect.rangeList.ranges;
      if (!ranges.length || this.ace.inVirtualSelectionMode)
        return [{anchor: this.getCursor('anchor'), head: this.getCursor('head')}];
      return ranges.map(function(r) {
        return {
          anchor: this.clipPos(toCmPos(r.cursor == r.end ? r.start : r.end)),
          head: this.clipPos(toCmPos(r.cursor))
        };
      }, this);
    };
    this.setSelections = function(p, primIndex) {
      const sel = this.ace.multiSelect;
      let ranges = p.map(x => {
        const anchor = toAcePos(x.anchor);
        const head = toAcePos(x.head);
        const r = Range.comparePoints(anchor, head) < 0
          ? new Range.fromPoints(anchor, head)
          : new Range.fromPoints(head, anchor);
        r.cursor = Range.comparePoints(r.start, head) ? r.end : r.start;
        return r;
      });

      if (this.ace.inVirtualSelectionMode) {
        this.ace.selection.fromOrientedRange(ranges[0]);
        return;
      }
      if (!primIndex) {
          ranges = ranges.reverse();
      } else if (ranges[primIndex]) {
         ranges.push(ranges.splice(primIndex, 1)[0]);
      }
      sel.toSingleRange(ranges[0].clone());
      const session = this.ace.session;
      for (let i = 0; i < ranges.length; i++) {
        const range = session.$clipRangeToDocument(ranges[i]); // todo why ace doesn't do this?
        sel.addRange(range);
      }
    };
    this.setSelection = function(a, h, options) {
      const sel = this.ace.selection;
      sel.moveTo(a.line, a.ch);
      sel.selectTo(h.line, h.ch);
      if (options && options.origin == '*mouse') {
        this.onBeforeEndOperation();
      }
    };
    this.somethingSelected = function(p) {
      return !this.ace.selection.isEmpty();
    };
    this.clipPos = function(p) {
      const pos = this.ace.session.$clipPositionToDocument(p.line, p.ch);
      return toCmPos(pos);
    };
    this.markText = cursor => ({
      clear() {},
      find() {}
    });
    this.$updateMarkers = function(delta) {
      const isInsert = delta.action == "insert";
      const start = delta.start;
      let end = delta.end;
      const rowShift = (end.row - start.row) * (isInsert ? 1 : -1);
      const colShift = (end.column - start.column) * (isInsert ? 1 : -1);
      if (isInsert) end = start;

      for (const i in this.marks) {
        const point = this.marks[i];
        let cmp = Range.comparePoints(point, start);
        if (cmp < 0) {
          continue; // delta starts after the range
        }
        if (cmp === 0) {
          if (isInsert) {
            if (point.bias == 1) {
              cmp = 1;
            } else {
              point.bias == -1;
              continue;
            }
          }
        }
        const cmp2 = isInsert ? cmp : Range.comparePoints(point, end);
        if (cmp2 > 0) {
          point.row += rowShift;
          point.column += point.row == end.row ? colShift : 0;
          continue;
        }
        if (!isInsert && cmp2 <= 0) {
          point.row = start.row;
          point.column = start.column;
          if (cmp2 === 0)
            point.bias = 1;
        }
      }
    };

    class Marker {
      constructor(cm, id, row, column) {
        this.cm = cm;
        this.id = id;
        this.row = row;
        this.column = column;
        cm.marks[this.id] = this;
      }

      clear() { delete this.cm.marks[this.id] }
      find() { return toCmPos(this) }
    }

    this.setBookmark = function(cursor, options) {
      const bm = new Marker(this, this.$uid++, cursor.line, cursor.ch);
      if (!options || !options.insertLeft)
        bm.$insertRight = true;
      this.marks[bm.id] = bm;
      return bm;
    };
    this.moveH = function(increment, unit) {
      if (unit == 'char') {
        const sel = this.ace.selection;
        sel.clearSelection();
        sel.moveCursorBy(0, increment);
      }
    };
    this.findPosV = function(start, amount, unit, goalColumn) {
      if (unit == 'page') {
        const renderer = this.ace.renderer;
        const config = renderer.layerConfig;
        amount = amount * Math.floor(config.height / config.lineHeight);
        unit = 'line';
      }
      if (unit == 'line') {
        const screenPos = this.ace.session.documentToScreenPosition(start.line, start.ch);
        if (goalColumn != null)
          screenPos.column = goalColumn;
        screenPos.row += amount;
        screenPos.row = Math.min(Math.max(0, screenPos.row), this.ace.session.getScreenLength() - 1);
        const pos = this.ace.session.screenToDocumentPosition(screenPos.row, screenPos.column);
        return toCmPos(pos);
      } else {
        debugger;
      }
    };
    this.charCoords = function(pos, mode) {
      if (mode == 'div' || !mode) {
        var sc = this.ace.session.documentToScreenPosition(pos.line, pos.ch);
        return {left: sc.column, top: sc.row};
      }if (mode == 'local') {
        const renderer = this.ace.renderer;
        var sc = this.ace.session.documentToScreenPosition(pos.line, pos.ch);
        const lh = renderer.layerConfig.lineHeight;
        const cw = renderer.layerConfig.characterWidth;
        const top = lh * sc.row;
        return {left: sc.column * cw, top, bottom: top + lh};
      }
    };
    this.coordsChar = function(pos, mode) {
      const renderer = this.ace.renderer;
      if (mode == 'local') {
        const row = Math.max(0, Math.floor(pos.top / renderer.lineHeight));
        const col = Math.max(0, Math.floor(pos.left / renderer.characterWidth));
        const ch = renderer.session.screenToDocumentPosition(row, col);
        return toCmPos(ch);
      } else if (mode == 'div') {
        throw "not implemented";
      }
    };
    this.getSearchCursor = function(query, pos, caseFold) {
      let caseSensitive = false;
      let isRegexp = false;
      if (query instanceof RegExp && !query.global) {
        caseSensitive = !query.ignoreCase;
        query = query.source;
        isRegexp = true;
      }
      const search = new Search();
      if (pos.ch == undefined) pos.ch = Number.MAX_VALUE;
      const acePos = {row: pos.line, column: pos.ch};
      const cm = this;
      let last = null;
      return {
        findNext() { return this.find(false) },
        findPrevious() {return this.find(true) },
        find(back) {
          search.setOptions({
            needle: query,
            caseSensitive,
            wrap: false,
            backwards: back,
            regExp: isRegexp,
            start: last || acePos
          });
          let range = search.find(cm.ace.session);
          if (range && range.isEmpty()) {
            if (cm.getLine(range.start.row).length == range.start.column) {
              search.$options.start = range;
              range = search.find(cm.ace.session);
            }
          }
          last = range;
          return last;
        },
        from() { return last && toCmPos(last.start) },
        to() { return last && toCmPos(last.end) },
        replace(text) {
          if (last) {
            last.end = cm.ace.session.doc.replace(last, text);
          }
        }
      };
    };
    this.scrollTo = function(x, y) {
      const renderer = this.ace.renderer;
      const config = renderer.layerConfig;
      let maxHeight = config.maxHeight;
      maxHeight -= (renderer.$size.scrollerHeight - renderer.lineHeight) * renderer.$scrollPastEnd;
      if (y != null) this.ace.session.setScrollTop(Math.max(0, Math.min(y, maxHeight)));
      if (x != null) this.ace.session.setScrollLeft(Math.max(0, Math.min(x, config.width)));
    };
    this.scrollInfo = () => 0;
    this.scrollIntoView = function(pos, margin) {
      if (pos) {
        const renderer = this.ace.renderer;
        const viewMargin = { "top": 0, "bottom": margin };
        renderer.scrollCursorIntoView(toAcePos(pos),
          (renderer.lineHeight * 2) / renderer.$size.scrollerHeight, viewMargin);
      }
    };
    this.getLine = function(row) { return this.ace.session.getLine(row) };
    this.getRange = function(s, e) {
      return this.ace.session.getTextRange(new Range(s.line, s.ch, e.line, e.ch));
    };
    this.replaceRange = function(text, s, e) {
      if (!e) e = s;
      return this.ace.session.replace(new Range(s.line, s.ch, e.line, e.ch), text);
    };
    this.replaceSelections = function(p) {
      const sel = this.ace.selection;
      if (this.ace.inVirtualSelectionMode) {
        this.ace.session.replace(sel.getRange(), p[0] || "");
        return;
      }
      sel.inVirtualSelectionMode = true;
      let ranges = sel.rangeList.ranges;
      if (!ranges.length) ranges = [this.ace.multiSelect.getRange()];
      for (let i = ranges.length; i--;)
         this.ace.session.replace(ranges[i], p[i] || "");
      sel.inVirtualSelectionMode = false;
    };
    this.getSelection = function() {
      return this.ace.getSelectedText();
    };
    this.getSelections = function() {
      return this.listSelections().map(function(x) {
        return this.getRange(x.anchor, x.head);
      }, this);
    };
    this.getInputField = function() {
      return this.ace.textInput.getElement();
    };
    this.getWrapperElement = function() {
      return this.ace.containter;
    };
    const optMap = {
      indentWithTabs: "useSoftTabs",
      indentUnit: "tabSize",
      tabSize: "tabSize",
      firstLineNumber: "firstLineNumber",
      readOnly: "readOnly"
    };
    this.setOption = function(name, val) {
      this.state[name] = val;
      switch (name) {
        case 'indentWithTabs':
          name = optMap[name];
          val = !val;
        break;
        default:
          name = optMap[name];
      }
      if (name)
        this.ace.setOption(name, val);
    };
    this.getOption = function(name, val) {
      const aceOpt = optMap[name];
      if (aceOpt)
        val = this.ace.getOption(aceOpt);
      switch (name) {
        case 'indentWithTabs':
          name = optMap[name];
          return !val;
      }
      return aceOpt ? val : this.state[name];
    };
    this.toggleOverwrite = function(on) {
      this.state.overwrite = on;
      return this.ace.setOverwrite(on);
    };
    this.addOverlay = function(o) {
      if (!this.$searchHighlight || !this.$searchHighlight.session) {
        var highlight = new SearchHighlight(null, "ace_highlight-marker", "text");
        const marker = this.ace.session.addDynamicMarker(highlight);
        highlight.id = marker.id;
        highlight.session = this.ace.session;
        highlight.destroy = o => {
          highlight.session.off("change", highlight.updateOnChange);
          highlight.session.off("changeEditor", highlight.destroy);
          highlight.session.removeMarker(highlight.id);
          highlight.session = null;
        };
        highlight.updateOnChange = delta => {
          const row = delta.start.row;
          if (row == delta.end.row) highlight.cache[row] = undefined;
          else highlight.cache.splice(row, highlight.cache.length);
        };
        highlight.session.on("changeEditor", highlight.destroy);
        highlight.session.on("change", highlight.updateOnChange);
      }
      const re = new RegExp(o.query.source, "gmi");
      this.$searchHighlight = o.highlight = highlight;
      this.$searchHighlight.setRegexp(re);
      this.ace.renderer.updateBackMarkers();
    };
    this.removeOverlay = function(o) {
      if (this.$searchHighlight && this.$searchHighlight.session) {
        this.$searchHighlight.destroy();
      }
    };
    this.getScrollInfo = function() {
      const renderer = this.ace.renderer;
      const config = renderer.layerConfig;
      return {
        left: renderer.scrollLeft,
        top: renderer.scrollTop,
        height: config.maxHeight,
        width: config.width,
        clientHeight: config.height,
        clientWidth: config.width
      };
    };
    this.getValue = function() {
      return this.ace.getValue();
    };
    this.setValue = function(v) {
      return this.ace.setValue(v);
    };
    this.getTokenTypeAt = function(pos) {
      const token = this.ace.session.getTokenAt(pos.line, pos.ch);
      return token && /comment|string/.test(token.type) ? "string" : "";
    };
    this.findMatchingBracket = function(pos) {
      const m = this.ace.session.findMatchingBracket(toAcePos(pos));
      return {to: m && toCmPos(m)};
    };
    this.indentLine = function(line, method) {
      if (method === true)
          this.ace.session.indentRows(line, line, "\t");
      else if (method === false)
          this.ace.session.outdentRows(new Range(line, 0, line, 0));
    };
    this.indexFromPos = function(pos) {
      return this.ace.session.doc.positionToIndex(toAcePos(pos));
    };
    this.posFromIndex = function(index) {
      return toCmPos(this.ace.session.doc.indexToPosition(index));
    };
    this.focus = function(index) {
      return this.ace.focus();
    };
    this.blur = function(index) {
      return this.ace.blur();
    };
    this.defaultTextHeight = function(index) {
      return this.ace.renderer.layerConfig.lineHeight;
    };
    this.scanForBracket = function(pos, dir, _, options) {
      const re = options.bracketRegex.source;
      if (dir == 1) {
        var m = this.ace.session.$findClosingBracket(re.slice(1, 2), toAcePos(pos), /paren|text/);
      } else {
        var m = this.ace.session.$findOpeningBracket(re.slice(-2, -1), {row: pos.line, column: pos.ch + 1}, /paren|text/);
      }
      return m && {pos: toCmPos(m)};
    };
    this.refresh = function() {
      return this.ace.resize(true);
    };
    this.getMode = function() {
      return { name : this.getOption("mode") };
    }
  }).call(CodeMirror.prototype);
  function toAcePos(cmPos) {
    return {row: cmPos.line, column: cmPos.ch};
  }
  function toCmPos(acePos) {
    return new Pos(acePos.row, acePos.column);
  }

  const StringStream = CodeMirror.StringStream = function(string, tabSize) {
    this.pos = this.start = 0;
    this.string = string;
    this.tabSize = tabSize || 8;
    this.lastColumnPos = this.lastColumnValue = 0;
    this.lineStart = 0;
  };

  StringStream.prototype = {
    eol() {return this.pos >= this.string.length;},
    sol() {return this.pos == this.lineStart;},
    peek() {return this.string.charAt(this.pos) || undefined;},
    next() {
      if (this.pos < this.string.length)
        return this.string.charAt(this.pos++);
    },
    eat(match) {
      const ch = this.string.charAt(this.pos);
      if (typeof match == "string") var ok = ch == match;
      else var ok = ch && (match.test ? match.test(ch) : match(ch));
      if (ok) {++this.pos; return ch;}
    },
    eatWhile(match) {
      const start = this.pos;
      while (this.eat(match)){}
      return this.pos > start;
    },
    eatSpace() {
      const start = this.pos;
      while (/[\s\u00a0]/.test(this.string.charAt(this.pos))) ++this.pos;
      return this.pos > start;
    },
    skipToEnd() {this.pos = this.string.length;},
    skipTo(ch) {
      const found = this.string.indexOf(ch, this.pos);
      if (found > -1) {this.pos = found; return true;}
    },
    backUp(n) {this.pos -= n;},
    column() {
      throw "not implemented";
    },
    indentation() {
      throw "not implemented";
    },
    match(pattern, consume, caseInsensitive) {
      if (typeof pattern == "string") {
        const cased = str => caseInsensitive ? str.toLowerCase() : str;
        const substr = this.string.substr(this.pos, pattern.length);
        if (cased(substr) == cased(pattern)) {
          if (consume !== false) this.pos += pattern.length;
          return true;
        }
      } else {
        const match = this.string.slice(this.pos).match(pattern);
        if (match && match.index > 0) return null;
        if (match && consume !== false) this.pos += match[0].length;
        return match;
      }
    },
    current() {return this.string.slice(this.start, this.pos);},
    hideFirstChars(n, inner) {
      this.lineStart += n;
      try { return inner(); }
      finally { this.lineStart -= n; }
    }
  };
  dom.importCssString(`
  .normal-mode .ace_hidden-cursors .ace_cursor{
    background-color: transparent;
  }
  .ace_dialog {
    position: absolute;
    left: 0; right: 0;
    background: #14191f;
    z-index: 15;
    padding: .1em .8em;
    overflow: hidden;
    color: #24C6E0;
  }
  .ace_dialog-top {
    border-bottom: 3px solid #24C6E0;
    top: 0;
  }
  .ace_dialog-bottom {
    border-top: 3px solid #24C6E0;
    bottom: 0;
  }
  .ace_dialog input, .ace_dialog-confirm {
    border: none;
    outline: none;
    background: transparent;
    width: 80%;
    padding: 15px 10px 10px 10px;
    margin-left: 4pt;
    color: inherit;
    font-weight: 300;
    letter-spacing: 0.05em;
    font-family: 'inconsolata';
    font-size: 20pt;
  }
  .ace_dialog-confirm {
    font-size: 15pt;
    padding: 0px;
    color: #f57157;
  }`, "vimMode");
  ((() => {
    function dialogDiv(cm, template, bottom) {
      const wrap = cm.ace.container;
      let dialog;
      dialog = wrap.appendChild(document.createElement("div"));
      if (bottom)
        dialog.className = "ace_dialog ace_dialog-bottom";
      else
        dialog.className = "ace_dialog ace_dialog-top";

      if (typeof template == "string") {
        dialog.innerHTML = template;
      } else { // Assuming it's a detached DOM element.
        dialog.appendChild(template);
      }
      return dialog;
    }

    function closeNotification(cm, newVal) {
      if (cm.state.currentNotificationClose)
        cm.state.currentNotificationClose();
      cm.state.currentNotificationClose = newVal;
    }

    CodeMirror.defineExtension("openDialog", function(template, callback, options) {
      if (this.virtualSelectionMode()) return;
      if (!options) options = {};

      closeNotification(this, null);

      const dialog = dialogDiv(this, template, options.bottom);
      let closed = false;
      const me = this;
      function close(newVal) {
        if (typeof newVal == 'string') {
          inp.value = newVal;
        } else {
          if (closed) return;
          closed = true;
          dialog.parentNode.removeChild(dialog);
          me.focus();

          if (options.onClose) options.onClose(dialog);
        }
      }

      var inp = dialog.getElementsByTagName("input")[0];
      let button;
      if (inp) {
        if (options.value) {
          inp.value = options.value;
          if (options.select !== false) inp.select();
        }

        if (options.onInput)
          CodeMirror.on(inp, "input", e => { options.onInput(e, inp.value, close);});
        if (options.onKeyUp)
          CodeMirror.on(inp, "keyup", e => {options.onKeyUp(e, inp.value, close);});

        CodeMirror.on(inp, "keydown", e => {
          if (options && options.onKeyDown && options.onKeyDown(e, inp.value, close)) { return; }
          if (e.keyCode == 27 || (options.closeOnEnter !== false && e.keyCode == 13)) {
            inp.blur();
            CodeMirror.e_stop(e);
            close();
          }
          if (e.keyCode == 13) callback(inp.value);
        });

        if (options.closeOnBlur !== false) CodeMirror.on(inp, "blur", close);

        inp.focus();
      } else if (button = dialog.getElementsByTagName("button")[0]) {
        CodeMirror.on(button, "click", () => {
          close();
          me.focus();
        });

        if (options.closeOnBlur !== false) CodeMirror.on(button, "blur", close);

        button.focus();
      }
      return close;
    });

    CodeMirror.defineExtension("openNotification", function(template, options) {
      if (this.virtualSelectionMode()) return;
      closeNotification(this, close);
      const dialog = dialogDiv(this, template, options && options.bottom);
      let closed = false;
      let doneTimer;
      const duration = options && typeof options.duration !== "undefined" ? options.duration : 5000;

      function close() {
        if (closed) return;
        closed = true;
        clearTimeout(doneTimer);
        dialog.parentNode.removeChild(dialog);
      }

      CodeMirror.on(dialog, 'click', e => {
        CodeMirror.e_preventDefault(e);
        close();
      });

      if (duration)
        doneTimer = setTimeout(close, duration);

      return close;
    });
  }))();


  const defaultKeymap = [
    { keys: '<Left>', type: 'keyToKey', toKeys: 'h' },
    { keys: '<Right>', type: 'keyToKey', toKeys: 'l' },
    { keys: '<Up>', type: 'keyToKey', toKeys: 'k' },
    { keys: '<Down>', type: 'keyToKey', toKeys: 'j' },
    { keys: '<Space>', type: 'keyToKey', toKeys: 'l' },
    { keys: '<BS>', type: 'keyToKey', toKeys: 'h', context: 'normal'},
    { keys: '<C-Space>', type: 'keyToKey', toKeys: 'W' },
    { keys: '<C-BS>', type: 'keyToKey', toKeys: 'B', context: 'normal' },
    { keys: '<S-Space>', type: 'keyToKey', toKeys: 'w' },
    { keys: '<S-BS>', type: 'keyToKey', toKeys: 'b', context: 'normal' },
    { keys: '<C-n>', type: 'keyToKey', toKeys: 'j' },
    { keys: '<C-p>', type: 'keyToKey', toKeys: 'k' },
    { keys: '<C-[>', type: 'keyToKey', toKeys: '<Esc>' },
    { keys: '<C-c>', type: 'keyToKey', toKeys: '<Esc>' },
    { keys: '<C-[>', type: 'keyToKey', toKeys: '<Esc>', context: 'insert' },
    { keys: '<C-c>', type: 'keyToKey', toKeys: '<Esc>', context: 'insert' },
    { keys: 's', type: 'keyToKey', toKeys: 'cl', context: 'normal' },
    { keys: 's', type: 'keyToKey', toKeys: 'c', context: 'visual'},
    { keys: 'S', type: 'keyToKey', toKeys: 'cc', context: 'normal' },
    { keys: 'S', type: 'keyToKey', toKeys: 'VdO', context: 'visual' },
    { keys: '<Home>', type: 'keyToKey', toKeys: '0' },
    { keys: '<End>', type: 'keyToKey', toKeys: '$' },
    { keys: '<PageUp>', type: 'keyToKey', toKeys: '<C-b>' },
    { keys: '<PageDown>', type: 'keyToKey', toKeys: '<C-f>' },
    { keys: '<CR>', type: 'keyToKey', toKeys: 'j^', context: 'normal' },
    { keys: 'H', type: 'motion', motion: 'moveToTopLine', motionArgs: { linewise: true, toJumplist: true }},
    { keys: 'M', type: 'motion', motion: 'moveToMiddleLine', motionArgs: { linewise: true, toJumplist: true }},
    { keys: 'L', type: 'motion', motion: 'moveToBottomLine', motionArgs: { linewise: true, toJumplist: true }},
    { keys: 'h', type: 'motion', motion: 'moveByCharacters', motionArgs: { forward: false }},
    { keys: 'l', type: 'motion', motion: 'moveByCharacters', motionArgs: { forward: true }},
    { keys: 'j', type: 'motion', motion: 'moveByLines', motionArgs: { forward: true, linewise: true }},
    { keys: 'k', type: 'motion', motion: 'moveByLines', motionArgs: { forward: false, linewise: true }},
    { keys: 'gj', type: 'motion', motion: 'moveByDisplayLines', motionArgs: { forward: true }},
    { keys: 'gk', type: 'motion', motion: 'moveByDisplayLines', motionArgs: { forward: false }},
    { keys: 'w', type: 'motion', motion: 'moveByWords', motionArgs: { forward: true, wordEnd: false }},
    { keys: 'W', type: 'motion', motion: 'moveByWords', motionArgs: { forward: true, wordEnd: false, bigWord: true }},
    { keys: 'e', type: 'motion', motion: 'moveByWords', motionArgs: { forward: true, wordEnd: true, inclusive: true }},
    { keys: 'E', type: 'motion', motion: 'moveByWords', motionArgs: { forward: true, wordEnd: true, bigWord: true, inclusive: true }},
    { keys: 'b', type: 'motion', motion: 'moveByWords', motionArgs: { forward: false, wordEnd: false }},
    { keys: 'B', type: 'motion', motion: 'moveByWords', motionArgs: { forward: false, wordEnd: false, bigWord: true }},
    { keys: 'ge', type: 'motion', motion: 'moveByWords', motionArgs: { forward: false, wordEnd: true, inclusive: true }},
    { keys: 'gE', type: 'motion', motion: 'moveByWords', motionArgs: { forward: false, wordEnd: true, bigWord: true, inclusive: true }},
    { keys: '{', type: 'motion', motion: 'moveByParagraph', motionArgs: { forward: false, toJumplist: true }},
    { keys: '}', type: 'motion', motion: 'moveByParagraph', motionArgs: { forward: true, toJumplist: true }},
    { keys: '<C-f>', type: 'motion', motion: 'moveByPage', motionArgs: { forward: true }},
    { keys: '<C-b>', type: 'motion', motion: 'moveByPage', motionArgs: { forward: false }},
    { keys: '<C-d>', type: 'motion', motion: 'moveByScroll', motionArgs: { forward: true, explicitRepeat: true }},
    { keys: '<C-u>', type: 'motion', motion: 'moveByScroll', motionArgs: { forward: false, explicitRepeat: true }},
    { keys: 'gg', type: 'motion', motion: 'moveToLineOrEdgeOfDocument', motionArgs: { forward: false, explicitRepeat: true, linewise: true, toJumplist: true }},
    { keys: 'G', type: 'motion', motion: 'moveToLineOrEdgeOfDocument', motionArgs: { forward: true, explicitRepeat: true, linewise: true, toJumplist: true }},
    { keys: '0', type: 'motion', motion: 'moveToStartOfLine' },
    { keys: '^', type: 'motion', motion: 'moveToFirstNonWhiteSpaceCharacter' },
    { keys: '+', type: 'motion', motion: 'moveByLines', motionArgs: { forward: true, toFirstChar:true }},
    { keys: '-', type: 'motion', motion: 'moveByLines', motionArgs: { forward: false, toFirstChar:true }},
    { keys: '_', type: 'motion', motion: 'moveByLines', motionArgs: { forward: true, toFirstChar:true, repeatOffset:-1 }},
    { keys: '$', type: 'motion', motion: 'moveToEol', motionArgs: { inclusive: true }},
    { keys: '%', type: 'motion', motion: 'moveToMatchedSymbol', motionArgs: { inclusive: true, toJumplist: true }},
    { keys: 'f<character>', type: 'motion', motion: 'moveToCharacter', motionArgs: { forward: true , inclusive: true }},
    { keys: 'F<character>', type: 'motion', motion: 'moveToCharacter', motionArgs: { forward: false }},
    { keys: 't<character>', type: 'motion', motion: 'moveTillCharacter', motionArgs: { forward: true, inclusive: true }},
    { keys: 'T<character>', type: 'motion', motion: 'moveTillCharacter', motionArgs: { forward: false }},
    { keys: ';', type: 'motion', motion: 'repeatLastCharacterSearch', motionArgs: { forward: true }},
    { keys: ',', type: 'motion', motion: 'repeatLastCharacterSearch', motionArgs: { forward: false }},
    { keys: '\'<character>', type: 'motion', motion: 'goToMark', motionArgs: {toJumplist: true, linewise: true}},
    { keys: '`<character>', type: 'motion', motion: 'goToMark', motionArgs: {toJumplist: true}},
    { keys: ']`', type: 'motion', motion: 'jumpToMark', motionArgs: { forward: true } },
    { keys: '[`', type: 'motion', motion: 'jumpToMark', motionArgs: { forward: false } },
    { keys: ']\'', type: 'motion', motion: 'jumpToMark', motionArgs: { forward: true, linewise: true } },
    { keys: '[\'', type: 'motion', motion: 'jumpToMark', motionArgs: { forward: false, linewise: true } },
    { keys: ']p', type: 'action', action: 'paste', isEdit: true, actionArgs: { after: true, isEdit: true, matchIndent: true}},
    { keys: '[p', type: 'action', action: 'paste', isEdit: true, actionArgs: { after: false, isEdit: true, matchIndent: true}},
    { keys: ']<character>', type: 'motion', motion: 'moveToSymbol', motionArgs: { forward: true, toJumplist: true}},
    { keys: '[<character>', type: 'motion', motion: 'moveToSymbol', motionArgs: { forward: false, toJumplist: true}},
    { keys: '|', type: 'motion', motion: 'moveToColumn'},
    { keys: 'o', type: 'motion', motion: 'moveToOtherHighlightedEnd', context:'visual'},
    { keys: 'O', type: 'motion', motion: 'moveToOtherHighlightedEnd', motionArgs: {sameLine: true}, context:'visual'},
    { keys: 'd', type: 'operator', operator: 'delete' },
    { keys: 'y', type: 'operator', operator: 'yank' },
    { keys: 'c', type: 'operator', operator: 'change' },
    { keys: '>', type: 'operator', operator: 'indent', operatorArgs: { indentRight: true }},
    { keys: '<', type: 'operator', operator: 'indent', operatorArgs: { indentRight: false }},
    { keys: 'g~', type: 'operator', operator: 'changeCase' },
    { keys: 'gu', type: 'operator', operator: 'changeCase', operatorArgs: {toLower: true}, isEdit: true },
    { keys: 'gU', type: 'operator', operator: 'changeCase', operatorArgs: {toLower: false}, isEdit: true },
    { keys: 'n', type: 'motion', motion: 'findNext', motionArgs: { forward: true, toJumplist: true }},
    { keys: 'N', type: 'motion', motion: 'findNext', motionArgs: { forward: false, toJumplist: true }},
    { keys: 'x', type: 'operatorMotion', operator: 'delete', motion: 'moveByCharacters', motionArgs: { forward: true }, operatorMotionArgs: { visualLine: false }},
    { keys: 'X', type: 'operatorMotion', operator: 'delete', motion: 'moveByCharacters', motionArgs: { forward: false }, operatorMotionArgs: { visualLine: true }},
    { keys: 'D', type: 'operatorMotion', operator: 'delete', motion: 'moveToEol', motionArgs: { inclusive: true }, context: 'normal'},
    { keys: 'D', type: 'operator', operator: 'delete', operatorArgs: { linewise: true }, context: 'visual'},
    { keys: 'Y', type: 'operatorMotion', operator: 'yank', motion: 'moveToEol', motionArgs: { inclusive: true }, context: 'normal'},
    { keys: 'Y', type: 'operator', operator: 'yank', operatorArgs: { linewise: true }, context: 'visual'},
    { keys: 'C', type: 'operatorMotion', operator: 'change', motion: 'moveToEol', motionArgs: { inclusive: true }, context: 'normal'},
    { keys: 'C', type: 'operator', operator: 'change', operatorArgs: { linewise: true }, context: 'visual'},
    { keys: '~', type: 'operatorMotion', operator: 'changeCase', motion: 'moveByCharacters', motionArgs: { forward: true }, operatorArgs: { shouldMoveCursor: true }, context: 'normal'},
    { keys: '~', type: 'operator', operator: 'changeCase', context: 'visual'},
    { keys: '<C-w>', type: 'operatorMotion', operator: 'delete', motion: 'moveByWords', motionArgs: { forward: false, wordEnd: false }, context: 'insert' },
    { keys: '<C-i>', type: 'action', action: 'jumpListWalk', actionArgs: { forward: true }},
    { keys: '<C-o>', type: 'action', action: 'jumpListWalk', actionArgs: { forward: false }},
    { keys: '<C-e>', type: 'action', action: 'scroll', actionArgs: { forward: true, linewise: true }},
    { keys: '<C-y>', type: 'action', action: 'scroll', actionArgs: { forward: false, linewise: true }},
    { keys: 'a', type: 'action', action: 'enterInsertMode', isEdit: true, actionArgs: { insertAt: 'charAfter' }, context: 'normal' },
    { keys: 'A', type: 'action', action: 'enterInsertMode', isEdit: true, actionArgs: { insertAt: 'eol' }, context: 'normal' },
    { keys: 'A', type: 'action', action: 'enterInsertMode', isEdit: true, actionArgs: { insertAt: 'endOfSelectedArea' }, context: 'visual' },
    { keys: 'i', type: 'action', action: 'enterInsertMode', isEdit: true, actionArgs: { insertAt: 'inplace' }, context: 'normal' },
    { keys: 'I', type: 'action', action: 'enterInsertMode', isEdit: true, actionArgs: { insertAt: 'firstNonBlank'}, context: 'normal' },
    { keys: 'I', type: 'action', action: 'enterInsertMode', isEdit: true, actionArgs: { insertAt: 'startOfSelectedArea' }, context: 'visual' },
    { keys: 'o', type: 'action', action: 'newLineAndEnterInsertMode', isEdit: true, interlaceInsertRepeat: true, actionArgs: { after: true }, context: 'normal' },
    { keys: 'O', type: 'action', action: 'newLineAndEnterInsertMode', isEdit: true, interlaceInsertRepeat: true, actionArgs: { after: false }, context: 'normal' },
    { keys: 'v', type: 'action', action: 'toggleVisualMode' },
    { keys: 'V', type: 'action', action: 'toggleVisualMode', actionArgs: { linewise: true }},
    { keys: '<C-v>', type: 'action', action: 'toggleVisualMode', actionArgs: { blockwise: true }},
    { keys: '<C-q>', type: 'action', action: 'toggleVisualMode', actionArgs: { blockwise: true }},
    { keys: 'gv', type: 'action', action: 'reselectLastSelection' },
    { keys: 'J', type: 'action', action: 'joinLines', isEdit: true },
    { keys: 'p', type: 'action', action: 'paste', isEdit: true, actionArgs: { after: true, isEdit: true }},
    { keys: 'P', type: 'action', action: 'paste', isEdit: true, actionArgs: { after: false, isEdit: true }},
    { keys: 'r<character>', type: 'action', action: 'replace', isEdit: true },
    { keys: '@<character>', type: 'action', action: 'replayMacro' },
    { keys: 'q<character>', type: 'action', action: 'enterMacroRecordMode' },
    { keys: 'R', type: 'action', action: 'enterInsertMode', isEdit: true, actionArgs: { replace: true }},
    { keys: 'u', type: 'action', action: 'undo', context: 'normal' },
    { keys: 'u', type: 'operator', operator: 'changeCase', operatorArgs: {toLower: true}, context: 'visual', isEdit: true },
    { keys: 'U', type: 'operator', operator: 'changeCase', operatorArgs: {toLower: false}, context: 'visual', isEdit: true },
    { keys: '<C-r>', type: 'action', action: 'redo' },
    { keys: 'm<character>', type: 'action', action: 'setMark' },
    { keys: '"<character>', type: 'action', action: 'setRegister' },
    { keys: 'zz', type: 'action', action: 'scrollToCursor', actionArgs: { position: 'center' }},
    { keys: 'z.', type: 'action', action: 'scrollToCursor', actionArgs: { position: 'center' }, motion: 'moveToFirstNonWhiteSpaceCharacter' },
    { keys: 'zt', type: 'action', action: 'scrollToCursor', actionArgs: { position: 'top' }},
    { keys: 'z<CR>', type: 'action', action: 'scrollToCursor', actionArgs: { position: 'top' }, motion: 'moveToFirstNonWhiteSpaceCharacter' },
    { keys: 'z-', type: 'action', action: 'scrollToCursor', actionArgs: { position: 'bottom' }},
    { keys: 'zb', type: 'action', action: 'scrollToCursor', actionArgs: { position: 'bottom' }, motion: 'moveToFirstNonWhiteSpaceCharacter' },
    { keys: '.', type: 'action', action: 'repeatLastEdit' },
    { keys: '<C-a>', type: 'action', action: 'incrementNumberToken', isEdit: true, actionArgs: {increase: true, backtrack: false}},
    { keys: '<C-x>', type: 'action', action: 'incrementNumberToken', isEdit: true, actionArgs: {increase: false, backtrack: false}},
    { keys: 'a<character>', type: 'motion', motion: 'textObjectManipulation' },
    { keys: 'i<character>', type: 'motion', motion: 'textObjectManipulation', motionArgs: { textObjectInner: true }},
    { keys: '/', type: 'search', searchArgs: { forward: true, querySrc: 'prompt', toJumplist: true }},
    { keys: '?', type: 'search', searchArgs: { forward: false, querySrc: 'prompt', toJumplist: true }},
    { keys: '*', type: 'search', searchArgs: { forward: true, querySrc: 'wordUnderCursor', wholeWordOnly: true, toJumplist: true }},
    { keys: '#', type: 'search', searchArgs: { forward: false, querySrc: 'wordUnderCursor', wholeWordOnly: true, toJumplist: true }},
    { keys: 'g*', type: 'search', searchArgs: { forward: true, querySrc: 'wordUnderCursor', toJumplist: true }},
    { keys: 'g#', type: 'search', searchArgs: { forward: false, querySrc: 'wordUnderCursor', toJumplist: true }},
    { keys: ':', type: 'ex' }
  ];
  const defaultExCommandMap = [
    { name: 'colorscheme', shortName: 'colo' },
    { name: 'map' },
    { name: 'imap', shortName: 'im' },
    { name: 'nmap', shortName: 'nm' },
    { name: 'vmap', shortName: 'vm' },
    { name: 'unmap' },
    { name: 'write', shortName: 'w' },
    { name: '!', shortName: '!' },
    { name: 'WRITE', shortName: 'W' },
    { name: 'undo', shortName: 'u' },
    { name: 'redo', shortName: 'red' },
    { name: 'set', shortName: 'se' },
    { name: 'set', shortName: 'se' },
    { name: 'setlocal', shortName: 'setl' },
    { name: 'setglobal', shortName: 'setg' },
    { name: 'sort', shortName: 'sor' },
    { name: 'substitute', shortName: 's', possiblyAsync: true },
    { name: 'nohlsearch', shortName: 'noh' },
    { name: 'delmarks', shortName: 'delm' },
    { name: 'registers', shortName: 'reg', excludeFromCommandHistory: true },
    { name: 'global', shortName: 'g' }
  ];

  var Pos = CodeMirror.Pos;

  class Vim {
    constructor() { return vimApi; }

    static handleKey(cm, key, origin) {
      return cm.operation(() => handleKey(cm, key, origin), true);
    }
  } //{

  function enterVimMode(cm) {
    cm.setOption('disableInput', true);
    cm.setOption('showCursorWhenSelecting', true);
    CodeMirror.signal(cm, "vim-mode-change", {mode: "normal"});
    cm.on('cursorActivity', onCursorActivity);
    maybeInitVimState(cm);
    CodeMirror.on(cm.getInputField(), 'paste', getOnPasteFn(cm));
  }

  function leaveVimMode(cm) {
    cm.setOption('disableInput', false);
    cm.off('cursorActivity', onCursorActivity);
    CodeMirror.off(cm.getInputField(), 'paste', getOnPasteFn(cm));
    cm.state.vim = null;
  }

  function detachVimMap(cm, next) {
    if (this == CodeMirror.keyMap.vim)
      CodeMirror.rmClass(cm.getWrapperElement(), "cm-fat-cursor");

    if (!next || next.attach != attachVimMap)
      leaveVimMode(cm, false);
  }
  function attachVimMap(cm, prev) {
    if (this == CodeMirror.keyMap.vim)
      CodeMirror.addClass(cm.getWrapperElement(), "cm-fat-cursor");

    if (!prev || prev.attach != attachVimMap)
      enterVimMode(cm);
  }
  CodeMirror.defineOption('vimMode', false, (cm, val, prev) => {
    if (val && cm.getOption("keyMap") != "vim")
      cm.setOption("keyMap", "vim");
    else if (!val && prev != CodeMirror.Init && /^vim/.test(cm.getOption("keyMap")))
      cm.setOption("keyMap", "default");
  });

  function cmKey(key, cm) {
    if (!cm) { return undefined; }
    const vimKey = cmKeyToVimKey(key);
    if (!vimKey) {
      return false;
    }
    const cmd = CodeMirror.Vim.findKey(cm, vimKey);
    if (typeof cmd == 'function') {
      CodeMirror.signal(cm, 'vim-keypress', vimKey);
    }
    return cmd;
  }

  const modifiers = {'Shift': 'S', 'Ctrl': 'C', 'Alt': 'A', 'Cmd': 'D', 'Mod': 'A'};
  const specialKeys = {Enter:'CR',Backspace:'BS',Delete:'Del'};
  function cmKeyToVimKey(key) {
    if (key.charAt(0) == '\'') {
      return key.charAt(1);
    }
    const pieces = key.split(/-(?!$)/);
    const lastPiece = pieces[pieces.length - 1];
    if (pieces.length == 1 && pieces[0].length == 1) {
      return false;
    } else if (pieces.length == 2 && pieces[0] == 'Shift' && lastPiece.length == 1) {
      return false;
    }
    let hasCharacter = false;

    for (const piece of pieces) {
      if (piece in modifiers) { pieces[i] = modifiers[piece]; }
      else { hasCharacter = true; }
      if (piece in specialKeys) { pieces[i] = specialKeys[piece]; }
    }

    if (!hasCharacter) {
      return false;
    }
    if (isUpperCase(lastPiece)) {
      pieces[pieces.length - 1] = lastPiece.toLowerCase();
    }
    return `<${pieces.join('-')}>`;
  }

  function getOnPasteFn(cm) {
    const vim = cm.state.vim;
    if (!vim.onPasteFn) {
      vim.onPasteFn = () => {
        if (!vim.insertMode) {
          cm.setCursor(offsetCursor(cm.getCursor(), 0, 1));
          actions.enterInsertMode(cm, {}, vim);
        }
      };
    }
    return vim.onPasteFn;
  }

  const numberRegex = /[\d]/;
  const wordCharTest = [CodeMirror.isWordChar, ch => ch && !CodeMirror.isWordChar(ch) && !/\s/.test(ch)];
  const bigWordCharTest = [ch => /\S/.test(ch)];
  function makeKeyRange(start, size) {
    const keys = [];
    for (let i = start; i < start + size; i++) {
      keys.push(String.fromCharCode(i));
    }
    return keys;
  }
  const upperCaseAlphabet = makeKeyRange(65, 26);
  const lowerCaseAlphabet = makeKeyRange(97, 26);
  const numbers = makeKeyRange(48, 10);
  const validMarks = [].concat(upperCaseAlphabet, lowerCaseAlphabet, numbers, ['<', '>']);
  const validRegisters = [].concat(upperCaseAlphabet, lowerCaseAlphabet, numbers, ['-', '"', '.', ':', '/']);

  function isLine(cm, line) {
    return line >= cm.firstLine() && line <= cm.lastLine();
  }
  function isLowerCase(k) {
    return (/^[a-z]$/).test(k);
  }
  function isMatchableSymbol(k) {
    return '()[]{}'.includes(k);
  }
  function isNumber(k) {
    return numberRegex.test(k);
  }
  function isUpperCase(k) {
    return (/^[A-Z]$/).test(k);
  }
  function isWhiteSpaceString(k) {
    return (/^\s*$/).test(k);
  }
  function inArray(val, arr) {
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] == val) {
        return true;
      }
    }
    return false;
  }

  const options = {};
  function defineOption(name, defaultValue, type, aliases, callback) {
    if (defaultValue === undefined && !callback) {
      throw Error('defaultValue is required unless callback is provided');
    }
    if (!type) { type = 'string'; }
    options[name] = {
      type,
      defaultValue,
      callback
    };
    if (aliases) {
      for (let i = 0; i < aliases.length; i++) {
        options[aliases[i]] = options[name];
      }
    }
    if (defaultValue) {
      setOption(name, defaultValue);
    }
  }

  function setOption(name, value, cm, cfg) {
    const option = options[name];
    cfg = cfg || {};
    const scope = cfg.scope;
    if (!option) {
      throw Error(`Unknown option: ${name}`);
    }
    if (option.type == 'boolean') {
      if (value && value !== true) {
        throw Error(`Invalid argument: ${name}=${value}`);
      } else if (value !== false) {
        value = true;
      }
    }
    if (option.callback) {
      if (scope !== 'local') {
        option.callback(value, undefined);
      }
      if (scope !== 'global' && cm) {
        option.callback(value, cm);
      }
    } else {
      if (scope !== 'local') {
        option.value = option.type == 'boolean' ? !!value : value;
      }
      if (scope !== 'global' && cm) {
        cm.state.vim.options[name] = {value};
      }
    }
  }

  function getOption(name, cm, cfg) {
    const option = options[name];
    cfg = cfg || {};
    const scope = cfg.scope;
    if (!option) {
      throw Error(`Unknown option: ${name}`);
    }
    if (option.callback) {
      var local = cm && option.callback(undefined, cm);
      if (scope !== 'global' && local !== undefined) {
        return local;
      }
      if (scope !== 'local') {
        return option.callback();
      }
      return;
    } else {
      var local = (scope !== 'global') && (cm && cm.state.vim.options[name]);
      return (local || (scope !== 'local') && option || {}).value;
    }
  }

  defineOption('filetype', undefined, 'string', ['ft'], (name, cm) => {
    if (cm === undefined) {
      return;
    }
    if (name === undefined) {
      var mode = cm.getOption('mode');
      return mode == 'null' ? '' : mode;
    } else {
      var mode = name == '' ? 'null' : name;
      cm.setOption('mode', mode);
    }
  });

  const createCircularJumpList = () => {
    const size = 100;
    let pointer = -1;
    let head = 0;
    let tail = 0;
    const buffer = new Array(size);
    function add(cm, oldCur, newCur) {
      const current = pointer % size;
      const curMark = buffer[current];
      function useNextSlot(cursor) {
        const next = ++pointer % size;
        const trashMark = buffer[next];
        if (trashMark) {
          trashMark.clear();
        }
        buffer[next] = cm.setBookmark(cursor);
      }
      if (curMark) {
        const markPos = curMark.find();
        if (markPos && !cursorEqual(markPos, oldCur)) {
          useNextSlot(oldCur);
        }
      } else {
        useNextSlot(oldCur);
      }
      useNextSlot(newCur);
      head = pointer;
      tail = pointer - size + 1;
      if (tail < 0) {
        tail = 0;
      }
    }
    function move(cm, offset) {
      pointer += offset;
      if (pointer > head) {
        pointer = head;
      } else if (pointer < tail) {
        pointer = tail;
      }
      let mark = buffer[(size + pointer) % size];
      if (mark && !mark.find()) {
        const inc = offset > 0 ? 1 : -1;
        let newCur;
        const oldCur = cm.getCursor();
        do {
          pointer += inc;
          mark = buffer[(size + pointer) % size];
          if (mark &&
              (newCur = mark.find()) &&
              !cursorEqual(oldCur, newCur)) {
            break;
          }
        } while (pointer < head && pointer > tail);
      }
      return mark;
    }
    return {
      cachedCursor: undefined, //used for # and * jumps
      add,
      move
    };
  };
  const createInsertModeChanges = c => {
    if (c) {
      return {
        changes: c.changes,
        expectCursorActivityForChange: c.expectCursorActivityForChange
      };
    }
    return {
      changes: [],
      expectCursorActivityForChange: false
    };
  };

  class MacroModeState {
    constructor() {
      this.latestRegister = undefined;
      this.isPlaying = false;
      this.isRecording = false;
      this.replaySearchQueries = [];
      this.onRecordingDone = undefined;
      this.lastInsertModeChanges = createInsertModeChanges();
    }

    exitMacroRecordMode() {
      const macroModeState = vimGlobalState.macroModeState;
      if (macroModeState.onRecordingDone) {
        macroModeState.onRecordingDone(); // close dialog
      }
      macroModeState.onRecordingDone = undefined;
      macroModeState.isRecording = false;
    }

    enterMacroRecordMode(cm, registerName) {
      const register =
          vimGlobalState.registerController.getRegister(registerName);
      if (register) {
        register.clear();
        this.latestRegister = registerName;
        if (cm.openDialog) {
          this.onRecordingDone = cm.openDialog(
              `(recording)[${registerName}]`, null, {bottom:true});
        }
        this.isRecording = true;
      }
    }
  }

  function maybeInitVimState(cm) {
    if (!cm.state.vim) {
      cm.state.vim = {
        inputState: new InputState(),
        lastEditInputState: undefined,
        lastEditActionCommand: undefined,
        lastHPos: -1,
        lastHSPos: -1,
        lastMotion: null,
        marks: {},
        fakeCursor: null,
        insertMode: false,
        insertModeRepeat: undefined,
        visualMode: false,
        visualLine: false,
        visualBlock: false,
        lastSelection: null,
        lastPastedText: null,
        sel: {},
        options: {}
      };
    }
    return cm.state.vim;
  }
  var vimGlobalState;
  function resetVimGlobalState() {
    vimGlobalState = {
      searchQuery: null,
      searchIsReversed: false,
      lastSubstituteReplacePart: undefined,
      jumpList: createCircularJumpList(),
      macroModeState: new MacroModeState,
      lastChararacterSearch: {increment:0, forward:true, selectedCharacter:''},
      registerController: new RegisterController({}),
      searchHistoryController: new HistoryController({}),
      exCommandHistoryController : new HistoryController({})
    };
    for (const optionName in options) {
      const option = options[optionName];
      option.value = option.defaultValue;
    }
  }

  let lastInsertModeKeyTimer;
  var vimApi= {
    buildKeyMap() {
    },
    getRegisterController() {
      return vimGlobalState.registerController;
    },
    resetVimGlobalState_: resetVimGlobalState,
    getVimGlobalState_() {
      return vimGlobalState;
    },
    maybeInitVimState_: maybeInitVimState,

    suppressErrorLogging: false,

    InsertModeKey,
    map(lhs, rhs, ctx) {
      exCommandDispatcher.map(lhs, rhs, ctx);
    },
    unmap(lhs, ctx) {
      exCommandDispatcher.unmap(lhs, ctx);
    },
    setOption,
    getOption,
    defineOption,
    defineEx(name, prefix, func) {
      if (!prefix) {
        prefix = name;
      } else if (name.indexOf(prefix) !== 0) {
        throw new Error(`(Vim.defineEx) "${prefix}" is not a prefix of "${name}", command not registered`);
      }
      exCommands[name]=func;
      exCommandDispatcher.commandMap_[prefix]={name, shortName:prefix, type:'api'};
    },
    handleKey(cm, key, origin) {
      const command = this.findKey(cm, key, origin);
      if (typeof command === 'function') {
        return command();
      }
    },
    findKey(cm, key, origin) {
      const vim = maybeInitVimState(cm);
      function handleMacroRecording() {
        const macroModeState = vimGlobalState.macroModeState;
        if (macroModeState.isRecording) {
          if (key == 'q') {
            macroModeState.exitMacroRecordMode();
            clearInputState(cm);
            return true;
          }
          if (origin != 'mapping') {
            logKey(macroModeState, key);
          }
        }
      }
      function handleEsc() {
        if (key == '<Esc>') {
          clearInputState(cm);
          if (vim.visualMode) {
            exitVisualMode(cm);
          } else if (vim.insertMode) {
            exitInsertMode(cm);
          }
          return true;
        }
      }
      function doKeyToKey(keys) {
        let match;
        while (keys) {
          match = (/<\w+-.+?>|<\w+>|./).exec(keys);
          key = match[0];
          keys = keys.substring(match.index + key.length);
          CodeMirror.Vim.handleKey(cm, key, 'mapping');
        }
      }

      function handleKeyInsertMode() {
        if (handleEsc()) { return true; }
        var keys = vim.inputState.keyBuffer = vim.inputState.keyBuffer + key;
        const keysAreChars = key.length == 1;
        let match = commandDispatcher.matchCommand(keys, defaultKeymap, vim.inputState, 'insert');
        while (keys.length > 1 && match.type != 'full') {
          var keys = vim.inputState.keyBuffer = keys.slice(1);
          const thisMatch = commandDispatcher.matchCommand(keys, defaultKeymap, vim.inputState, 'insert');
          if (thisMatch.type != 'none') { match = thisMatch; }
        }
        if (match.type == 'none') { clearInputState(cm); return false; }
        else if (match.type == 'partial') {
          if (lastInsertModeKeyTimer) { window.clearTimeout(lastInsertModeKeyTimer); }
          lastInsertModeKeyTimer = window.setTimeout(
            () => { if (vim.insertMode && vim.inputState.keyBuffer) { clearInputState(cm); } },
            getOption('insertModeEscKeysTimeout'));
          return !keysAreChars;
        }

        if (lastInsertModeKeyTimer) { window.clearTimeout(lastInsertModeKeyTimer); }
        if (keysAreChars) {
          const here = cm.getCursor();
          cm.replaceRange('', offsetCursor(here, 0, -(keys.length - 1)), here, '+input');
        }
        clearInputState(cm);
        return match.command;
      }

      function handleKeyNonInsertMode() {
        if (handleMacroRecording() || handleEsc()) { return true; }

        const keys = vim.inputState.keyBuffer = vim.inputState.keyBuffer + key;
        if (/^[1-9]\d*$/.test(keys)) { return true; }

        var keysMatcher = /^(\d*)(.*)$/.exec(keys);
        if (!keysMatcher) { clearInputState(cm); return false; }
        const context = vim.visualMode ? 'visual' :
                                       'normal';
        const match = commandDispatcher.matchCommand(keysMatcher[2] || keysMatcher[1], defaultKeymap, vim.inputState, context);
        if (match.type == 'none') { clearInputState(cm); return false; }
        else if (match.type == 'partial') { return true; }

        vim.inputState.keyBuffer = '';
        var keysMatcher = /^(\d*)(.*)$/.exec(keys);
        if (keysMatcher[1] && keysMatcher[1] != '0') {
          vim.inputState.pushRepeatDigit(keysMatcher[1]);
        }
        return match.command;
      }

      let command;
      if (vim.insertMode) { command = handleKeyInsertMode(); }
      else { command = handleKeyNonInsertMode(); }
      if (command === false) {
        return undefined;
      } else if (command === true) {
        return () => true;
      } else {
        return () => {
          if ((command.operator || command.isEdit) && cm.getOption('readOnly'))
            return; // ace_patch
          return cm.operation(() => {
            cm.curOp.isVimOp = true;
            try {
              if (command.type == 'keyToKey') {
                doKeyToKey(command.toKeys);
              } else {
                commandDispatcher.processCommand(cm, vim, command);
              }
            } catch (e) {
              cm.state.vim = undefined;
              maybeInitVimState(cm);
              if (!CodeMirror.Vim.suppressErrorLogging) {
                console['log'](e);
              }
              throw e;
            }
            return true;
          });
        };
      }
    },
    handleEx(cm, input) {
      exCommandDispatcher.processCommand(cm, input);
    },

    defineMotion,
    defineAction,
    defineOperator,
    mapCommand,
    _mapCommand,

    defineRegister,

    exitVisualMode,
    exitInsertMode
  };

  class InputState {
    constructor() {
      this.prefixRepeat = [];
      this.motionRepeat = [];

      this.operator = null;
      this.operatorArgs = null;
      this.motion = null;
      this.motionArgs = null;
      this.keyBuffer = []; // For matching multi-key commands.
      this.registerName = null; // Defaults to the unnamed register.
    }

    pushRepeatDigit(n) {
      if (!this.operator) {
        this.prefixRepeat = this.prefixRepeat.concat(n);
      } else {
        this.motionRepeat = this.motionRepeat.concat(n);
      }
    }

    getRepeat() {
      let repeat = 0;
      if (this.prefixRepeat.length > 0 || this.motionRepeat.length > 0) {
        repeat = 1;
        if (this.prefixRepeat.length > 0) {
          repeat *= parseInt(this.prefixRepeat.join(''), 10);
        }
        if (this.motionRepeat.length > 0) {
          repeat *= parseInt(this.motionRepeat.join(''), 10);
        }
      }
      return repeat;
    }
  }

  function clearInputState(cm, reason) {
    cm.state.vim.inputState = new InputState();
    CodeMirror.signal(cm, 'vim-command-done', reason);
  }

  class Register {
    constructor(text, linewise, blockwise) {
      this.clear();
      this.keyBuffer = [text || ''];
      this.insertModeChanges = [];
      this.searchQueries = [];
      this.linewise = !!linewise;
      this.blockwise = !!blockwise;
    }

    setText(text, linewise, blockwise) {
      this.keyBuffer = [text || ''];
      this.linewise = !!linewise;
      this.blockwise = !!blockwise;
    }

    pushText(text, linewise) {
      if (linewise) {
        if (!this.linewise) {
          this.keyBuffer.push('\n');
        }
        this.linewise = true;
      }
      this.keyBuffer.push(text);
    }

    pushInsertModeChanges(changes) {
      this.insertModeChanges.push(createInsertModeChanges(changes));
    }

    pushSearchQuery(query) {
      this.searchQueries.push(query);
    }

    clear() {
      this.keyBuffer = [];
      this.insertModeChanges = [];
      this.searchQueries = [];
      this.linewise = false;
    }

    toString() {
      return this.keyBuffer.join('');
    }
  }

  function defineRegister(name, register) {
    const registers = vimGlobalState.registerController.registers[name];
    if (!name || name.length != 1) {
      throw Error('Register name must be 1 character');
    }
    registers[name] = register;
    validRegisters.push(name);
  }

  class RegisterController {
    constructor(registers) {
      this.registers = registers;
      this.unnamedRegister = registers['"'] = new Register();
      registers['.'] = new Register();
      registers[':'] = new Register();
      registers['/'] = new Register();
    }

    pushText(registerName, operator, text, linewise, blockwise) {
      if (linewise && text.charAt(0) == '\n') {
        text = `${text.slice(1)}\n`;
      }
      if (linewise && text.charAt(text.length - 1) !== '\n'){
        text += '\n';
      }
      const register = this.isValidRegister(registerName) ?
          this.getRegister(registerName) : null;
      if (!register) {
        switch (operator) {
          case 'yank':
            this.registers['0'] = new Register(text, linewise, blockwise);
            break;
          case 'delete':
          case 'change':
            if (!text.includes('\n')) {
              this.registers['-'] = new Register(text, linewise);
            } else {
              this.shiftNumericRegisters_();
              this.registers['1'] = new Register(text, linewise);
            }
            break;
        }
        this.unnamedRegister.setText(text, linewise, blockwise);
        return;
      }
      const append = isUpperCase(registerName);
      if (append) {
        register.pushText(text, linewise);
      } else {
        register.setText(text, linewise, blockwise);
      }
      this.unnamedRegister.setText(register.toString(), linewise);
    }

    getRegister(name) {
      if (!this.isValidRegister(name)) {
        return this.unnamedRegister;
      }
      name = name.toLowerCase();
      if (!this.registers[name]) {
        this.registers[name] = new Register();
      }
      return this.registers[name];
    }

    isValidRegister(name) {
      return name && inArray(name, validRegisters);
    }

    shiftNumericRegisters_() {
      for (let i = 9; i >= 2; i--) {
        this.registers[i] = this.getRegister(`${i - 1}`);
      }
    }
  }

  class HistoryController {
    constructor() {
        this.historyBuffer = [];
        this.iterator;
        this.initialPrefix = null;
    }

    nextMatch(input, up) {
      const historyBuffer = this.historyBuffer;
      const dir = up ? -1 : 1;
      if (this.initialPrefix === null) this.initialPrefix = input;
      for (var i = this.iterator + dir; up ? i >= 0 : i < historyBuffer.length; i+= dir) {
        const element = historyBuffer[i];
        for (let j = 0; j <= element.length; j++) {
          if (this.initialPrefix == element.substring(0, j)) {
            this.iterator = i;
            return element;
          }
        }
      }
      if (i >= historyBuffer.length) {
        this.iterator = historyBuffer.length;
        return this.initialPrefix;
      }
      if (i < 0 ) return input;
    }

    pushInput(input) {
      const index = this.historyBuffer.indexOf(input);
      if (index > -1) this.historyBuffer.splice(index, 1);
      if (input.length) this.historyBuffer.push(input);
    }

    reset() {
      this.initialPrefix = null;
      this.iterator = this.historyBuffer.length;
    }
  }

  var commandDispatcher = {
    matchCommand(keys, keyMap, inputState, context) {
      const matches = commandMatches(keys, keyMap, context, inputState);
      if (!matches.full && !matches.partial) {
        return {type: 'none'};
      } else if (!matches.full && matches.partial) {
        return {type: 'partial'};
      }

      let bestMatch;

      for (const match of matches.full) {
        if (!bestMatch) {
          bestMatch = match;
        }
      }

      if (bestMatch.keys.slice(-11) == '<character>') {
        inputState.selectedCharacter = lastChar(keys);
      }
      return {type: 'full', command: bestMatch};
    },
    processCommand(cm, vim, command) {
      vim.inputState.repeatOverride = command.repeatOverride;
      switch (command.type) {
        case 'motion':
          this.processMotion(cm, vim, command);
          break;
        case 'operator':
          this.processOperator(cm, vim, command);
          break;
        case 'operatorMotion':
          this.processOperatorMotion(cm, vim, command);
          break;
        case 'action':
          this.processAction(cm, vim, command);
          break;
        case 'search':
          this.processSearch(cm, vim, command);
          break;
        case 'ex':
        case 'keyToEx':
          this.processEx(cm, vim, command);
          break;
        default:
          break;
      }
    },
    processMotion(cm, vim, command) {
      vim.inputState.motion = command.motion;
      vim.inputState.motionArgs = copyArgs(command.motionArgs);
      this.evalInput(cm, vim);
    },
    processOperator(cm, vim, command) {
      const inputState = vim.inputState;
      if (inputState.operator) {
        if (inputState.operator == command.operator) {
          inputState.motion = 'expandToLine';
          inputState.motionArgs = { linewise: true };
          this.evalInput(cm, vim);
          return;
        } else {
          clearInputState(cm);
        }
      }
      inputState.operator = command.operator;
      inputState.operatorArgs = copyArgs(command.operatorArgs);
      if (vim.visualMode) {
        this.evalInput(cm, vim);
      }
    },
    processOperatorMotion(cm, vim, command) {
      const visualMode = vim.visualMode;
      const operatorMotionArgs = copyArgs(command.operatorMotionArgs);
      if (operatorMotionArgs) {
        if (visualMode && operatorMotionArgs.visualLine) {
          vim.visualLine = true;
        }
      }
      this.processOperator(cm, vim, command);
      if (!visualMode) {
        this.processMotion(cm, vim, command);
      }
    },
    processAction(cm, vim, command) {
      const inputState = vim.inputState;
      const repeat = inputState.getRepeat();
      const repeatIsExplicit = !!repeat;
      const actionArgs = copyArgs(command.actionArgs) || {};
      if (inputState.selectedCharacter) {
        actionArgs.selectedCharacter = inputState.selectedCharacter;
      }
      if (command.operator) {
        this.processOperator(cm, vim, command);
      }
      if (command.motion) {
        this.processMotion(cm, vim, command);
      }
      if (command.motion || command.operator) {
        this.evalInput(cm, vim);
      }
      actionArgs.repeat = repeat || 1;
      actionArgs.repeatIsExplicit = repeatIsExplicit;
      actionArgs.registerName = inputState.registerName;
      clearInputState(cm);
      vim.lastMotion = null;
      if (command.isEdit) {
        this.recordLastEdit(vim, inputState, command);
      }
      actions[command.action](cm, actionArgs, vim);
    },
    processSearch(cm, vim, command) {
      if (!cm.getSearchCursor) {
        return;
      }
      const forward = command.searchArgs.forward;
      const wholeWordOnly = command.searchArgs.wholeWordOnly;
      getSearchState(cm).setReversed(!forward);
      const promptPrefix = (forward) ? '/' : '?';
      const originalQuery = getSearchState(cm).getQuery();
      const originalScrollPos = cm.getScrollInfo();
      function handleQuery(query, ignoreCase, smartCase) {
        vimGlobalState.searchHistoryController.pushInput(query);
        vimGlobalState.searchHistoryController.reset();
        try {
          updateSearchQuery(cm, query, ignoreCase, smartCase);
        } catch (e) {
          showConfirm(cm, `Invalid regex: ${query}`);
          clearInputState(cm);
          return;
        }
        commandDispatcher.processMotion(cm, vim, {
          type: 'motion',
          motion: 'findNext',
          motionArgs: { forward: true, toJumplist: command.searchArgs.toJumplist }
        });
      }
      function onPromptClose(query) {
        cm.scrollTo(originalScrollPos.left, originalScrollPos.top);
        handleQuery(query, true /** ignoreCase */, true /** smartCase */);
        const macroModeState = vimGlobalState.macroModeState;
        if (macroModeState.isRecording) {
          logSearchQuery(macroModeState, query);
        }
      }
      function onPromptKeyUp(e, query, close) {
        const keyName = CodeMirror.keyName(e);
        let up;
        if (keyName == 'Up' || keyName == 'Down') {
          up = keyName == 'Up' ? true : false;
          query = vimGlobalState.searchHistoryController.nextMatch(query, up) || '';
          close(query);
        } else {
          if ( keyName != 'Left' && keyName != 'Right' && keyName != 'Ctrl' && keyName != 'Alt' && keyName != 'Shift')
            vimGlobalState.searchHistoryController.reset();
        }
        let parsedQuery;
        try {
          parsedQuery = updateSearchQuery(cm, query,
              true /** ignoreCase */, true /** smartCase */);
        } catch (e) {
        }
        if (parsedQuery) {
          cm.scrollIntoView(findNext(cm, !forward, parsedQuery), 30);
        } else {
          clearSearchHighlight(cm);
          cm.scrollTo(originalScrollPos.left, originalScrollPos.top);
        }
      }
      function onPromptKeyDown(e, query, close) {
        const keyName = CodeMirror.keyName(e);
        if (keyName == 'Esc' || keyName == 'Ctrl-C' || keyName == 'Ctrl-[' ||
            (keyName == 'Backspace' && query == '')) {
          vimGlobalState.searchHistoryController.pushInput(query);
          vimGlobalState.searchHistoryController.reset();
          updateSearchQuery(cm, originalQuery);
          clearSearchHighlight(cm);
          cm.scrollTo(originalScrollPos.left, originalScrollPos.top);
          CodeMirror.e_stop(e);
          clearInputState(cm);
          close();
          cm.focus();
        } else if (keyName == 'Ctrl-U') {
          CodeMirror.e_stop(e);
          close('');
        }
      }
      switch (command.searchArgs.querySrc) {
        case 'prompt':
          const macroModeState = vimGlobalState.macroModeState;
          if (macroModeState.isPlaying) {
            var query = macroModeState.replaySearchQueries.shift();
            handleQuery(query, true /** ignoreCase */, false /** smartCase */);
          } else {
            showPrompt(cm, {
                onClose: onPromptClose,
                prefix: promptPrefix,
                desc: searchPromptDesc,
                onKeyUp: onPromptKeyUp,
                onKeyDown: onPromptKeyDown
            });
          }
          break;
        case 'wordUnderCursor':
          let word = expandWordUnderCursor(cm, false /** inclusive */,
              true /** forward */, false /** bigWord */,
              true /** noSymbol */);
          let isKeyword = true;
          if (!word) {
            word = expandWordUnderCursor(cm, false /** inclusive */,
                true /** forward */, false /** bigWord */,
                false /** noSymbol */);
            isKeyword = false;
          }
          if (!word) {
            return;
          }
          var query = cm.getLine(word.start.line).substring(word.start.ch,
              word.end.ch);
          if (isKeyword && wholeWordOnly) {
              query = `\\b${query}\\b`;
          } else {
            query = escapeRegex(query);
          }
          vimGlobalState.jumpList.cachedCursor = cm.getCursor();
          cm.setCursor(word.start);

          handleQuery(query, true /** ignoreCase */, false /** smartCase */);
          break;
      }
    },
    processEx(cm, vim, command) {
      function onPromptClose(input) {
        vimGlobalState.exCommandHistoryController.pushInput(input);
        vimGlobalState.exCommandHistoryController.reset();
        exCommandDispatcher.processCommand(cm, input);
      }
      function onPromptKeyDown(e, input, close) {
        const keyName = CodeMirror.keyName(e);
        let up;
        if (keyName == 'Esc' || keyName == 'Ctrl-C' || keyName == 'Ctrl-[' ||
            (keyName == 'Backspace' && input == '')) {
          vimGlobalState.exCommandHistoryController.pushInput(input);
          vimGlobalState.exCommandHistoryController.reset();
          CodeMirror.e_stop(e);
          clearInputState(cm);
          close();
          cm.focus();
        }
        if (keyName == 'Up' || keyName == 'Down') {
          up = keyName == 'Up' ? true : false;
          input = vimGlobalState.exCommandHistoryController.nextMatch(input, up) || '';
          close(input);
        } else if (keyName == 'Ctrl-U') {
          CodeMirror.e_stop(e);
          close('');
        } else {
          if ( keyName != 'Left' && keyName != 'Right' && keyName != 'Ctrl' && keyName != 'Alt' && keyName != 'Shift')
            vimGlobalState.exCommandHistoryController.reset();
        }
      }
      if (command.type == 'keyToEx') {
        exCommandDispatcher.processCommand(cm, command.exArgs.input);
      } else {
        if (vim.visualMode) {
          showPrompt(cm, { onClose: onPromptClose, prefix: ':', value: '\'<,\'>',
              onKeyDown: onPromptKeyDown});
        } else {
          showPrompt(cm, { onClose: onPromptClose, prefix: ':',
              onKeyDown: onPromptKeyDown});
        }
      }
    },
    evalInput(cm, vim) {
      const inputState = vim.inputState;
      const motion = inputState.motion;
      const motionArgs = inputState.motionArgs || {};
      const operator = inputState.operator;
      const operatorArgs = inputState.operatorArgs || {};
      const registerName = inputState.registerName;
      let sel = vim.sel;
      const origHead = copyCursor(vim.visualMode ? clipCursorToContent(cm, sel.head): cm.getCursor('head'));
      const origAnchor = copyCursor(vim.visualMode ? clipCursorToContent(cm, sel.anchor) : cm.getCursor('anchor'));
      const oldHead = copyCursor(origHead);
      const oldAnchor = copyCursor(origAnchor);
      let newHead;
      let newAnchor;
      let repeat;
      if (operator) {
        this.recordLastEdit(vim, inputState);
      }
      if (inputState.repeatOverride !== undefined) {
        repeat = inputState.repeatOverride;
      } else {
        repeat = inputState.getRepeat();
      }
      if (repeat > 0 && motionArgs.explicitRepeat) {
        motionArgs.repeatIsExplicit = true;
      } else if (motionArgs.noRepeat ||
          (!motionArgs.explicitRepeat && repeat === 0)) {
        repeat = 1;
        motionArgs.repeatIsExplicit = false;
      }
      if (inputState.selectedCharacter) {
        motionArgs.selectedCharacter = operatorArgs.selectedCharacter =
            inputState.selectedCharacter;
      }
      motionArgs.repeat = repeat;
      clearInputState(cm);
      if (motion) {
        const motionResult = motions[motion](cm, origHead, motionArgs, vim);
        vim.lastMotion = motions[motion];
        if (!motionResult) {
          return;
        }
        if (motionArgs.toJumplist) {
          if (!operator && cm.ace.curOp != null)
            cm.ace.curOp.command.scrollIntoView = "center-animate"; // ace_patch
          const jumpList = vimGlobalState.jumpList;
          const cachedCursor = jumpList.cachedCursor;
          if (cachedCursor) {
            recordJumpPosition(cm, cachedCursor, motionResult);
            delete jumpList.cachedCursor;
          } else {
            recordJumpPosition(cm, origHead, motionResult);
          }
        }
        if (motionResult instanceof Array) {
          newAnchor = motionResult[0];
          newHead = motionResult[1];
        } else {
          newHead = motionResult;
        }
        if (!newHead) {
          newHead = copyCursor(origHead);
        }
        if (vim.visualMode) {
          if (!(vim.visualBlock && newHead.ch === Infinity)) {
            newHead = clipCursorToContent(cm, newHead, vim.visualBlock);
          }
          if (newAnchor) {
            newAnchor = clipCursorToContent(cm, newAnchor, true);
          }
          newAnchor = newAnchor || oldAnchor;
          sel.anchor = newAnchor;
          sel.head = newHead;
          updateCmSelection(cm);
          updateMark(cm, vim, '<',
              cursorIsBefore(newAnchor, newHead) ? newAnchor
                  : newHead);
          updateMark(cm, vim, '>',
              cursorIsBefore(newAnchor, newHead) ? newHead
                  : newAnchor);
        } else if (!operator) {
          newHead = clipCursorToContent(cm, newHead);
          cm.setCursor(newHead.line, newHead.ch);
        }
      }
      if (operator) {
        if (operatorArgs.lastSel) {
          newAnchor = oldAnchor;
          const lastSel = operatorArgs.lastSel;
          const lineOffset = Math.abs(lastSel.head.line - lastSel.anchor.line);
          const chOffset = Math.abs(lastSel.head.ch - lastSel.anchor.ch);
          if (lastSel.visualLine) {
            newHead = Pos(oldAnchor.line + lineOffset, oldAnchor.ch);
          } else if (lastSel.visualBlock) {
            newHead = Pos(oldAnchor.line + lineOffset, oldAnchor.ch + chOffset);
          } else if (lastSel.head.line == lastSel.anchor.line) {
            newHead = Pos(oldAnchor.line, oldAnchor.ch + chOffset);
          } else {
            newHead = Pos(oldAnchor.line + lineOffset, oldAnchor.ch);
          }
          vim.visualMode = true;
          vim.visualLine = lastSel.visualLine;
          vim.visualBlock = lastSel.visualBlock;
          sel = vim.sel = {
            anchor: newAnchor,
            head: newHead
          };
          updateCmSelection(cm);
        } else if (vim.visualMode) {
          operatorArgs.lastSel = {
            anchor: copyCursor(sel.anchor),
            head: copyCursor(sel.head),
            visualBlock: vim.visualBlock,
            visualLine: vim.visualLine
          };
        }
        let curStart;
        let curEnd;
        let linewise;
        let mode;
        let cmSel;
        if (vim.visualMode) {
          curStart = cursorMin(sel.head, sel.anchor);
          curEnd = cursorMax(sel.head, sel.anchor);
          linewise = vim.visualLine || operatorArgs.linewise;
          mode = vim.visualBlock ? 'block' :
                 linewise ? 'line' :
                 'char';
          cmSel = makeCmSelection(cm, {
            anchor: curStart,
            head: curEnd
          }, mode);
          if (linewise) {
            const ranges = cmSel.ranges;
            if (mode == 'block') {
              for (let i = 0; i < ranges.length; i++) {
                ranges[i].head.ch = lineLength(cm, ranges[i].head.line);
              }
            } else if (mode == 'line') {
              ranges[0].head = Pos(ranges[0].head.line + 1, 0);
            }
          }
        } else {
          curStart = copyCursor(newAnchor || oldAnchor);
          curEnd = copyCursor(newHead || oldHead);
          if (cursorIsBefore(curEnd, curStart)) {
            const tmp = curStart;
            curStart = curEnd;
            curEnd = tmp;
          }
          linewise = motionArgs.linewise || operatorArgs.linewise;
          if (linewise) {
            expandSelectionToLine(cm, curStart, curEnd);
          } else if (motionArgs.forward) {
            clipToLine(cm, curStart, curEnd);
          }
          mode = 'char';
          const exclusive = !motionArgs.inclusive || linewise;
          cmSel = makeCmSelection(cm, {
            anchor: curStart,
            head: curEnd
          }, mode, exclusive);
        }
        cm.setSelections(cmSel.ranges, cmSel.primary);
        vim.lastMotion = null;
        operatorArgs.repeat = repeat; // For indent in visual mode.
        operatorArgs.registerName = registerName;
        operatorArgs.linewise = linewise;
        const operatorMoveTo = operators[operator](
          cm, operatorArgs, cmSel.ranges, oldAnchor, newHead);
        if (vim.visualMode) {
          exitVisualMode(cm, operatorMoveTo != null);
        }
        if (operatorMoveTo) {
          cm.setCursor(operatorMoveTo);
        }
      }
    },
    recordLastEdit(vim, inputState, actionCommand) {
      const macroModeState = vimGlobalState.macroModeState;
      if (macroModeState.isPlaying) { return; }
      vim.lastEditInputState = inputState;
      vim.lastEditActionCommand = actionCommand;
      macroModeState.lastInsertModeChanges.changes = [];
      macroModeState.lastInsertModeChanges.expectCursorActivityForChange = false;
    }
  };
  var motions = {
    moveToTopLine(cm, _head, motionArgs) {
      const line = getUserVisibleLines(cm).top + motionArgs.repeat -1;
      return Pos(line, findFirstNonWhiteSpaceCharacter(cm.getLine(line)));
    },
    moveToMiddleLine(cm) {
      const range = getUserVisibleLines(cm);
      const line = Math.floor((range.top + range.bottom) * 0.5);
      return Pos(line, findFirstNonWhiteSpaceCharacter(cm.getLine(line)));
    },
    moveToBottomLine(cm, _head, motionArgs) {
      const line = getUserVisibleLines(cm).bottom - motionArgs.repeat +1;
      return Pos(line, findFirstNonWhiteSpaceCharacter(cm.getLine(line)));
    },
    expandToLine(_cm, head, motionArgs) {
      const cur = head;
      return Pos(cur.line + motionArgs.repeat - 1, Infinity);
    },
    findNext(cm, _head, motionArgs) {
      const state = getSearchState(cm);
      const query = state.getQuery();
      if (!query) {
        return;
      }
      let prev = !motionArgs.forward;
      prev = (state.isReversed()) ? !prev : prev;
      highlightSearchMatches(cm, query);
      return findNext(cm, prev/** prev */, query, motionArgs.repeat);
    },
    goToMark(cm, _head, motionArgs, vim) {
      const mark = vim.marks[motionArgs.selectedCharacter];
      if (mark) {
        const pos = mark.find();
        return motionArgs.linewise ? { line: pos.line, ch: findFirstNonWhiteSpaceCharacter(cm.getLine(pos.line)) } : pos;
      }
      return null;
    },
    moveToOtherHighlightedEnd(cm, _head, motionArgs, vim) {
      if (vim.visualBlock && motionArgs.sameLine) {
        const sel = vim.sel;
        return [
          clipCursorToContent(cm, Pos(sel.anchor.line, sel.head.ch)),
          clipCursorToContent(cm, Pos(sel.head.line, sel.anchor.ch))
        ];
      } else {
        return ([vim.sel.head, vim.sel.anchor]);
      }
    },
    jumpToMark(cm, head, motionArgs, vim) {
      let best = head;
      for (let i = 0; i < motionArgs.repeat; i++) {
        const cursor = best;
        for (const key in vim.marks) {
          if (!isLowerCase(key)) {
            continue;
          }
          const mark = vim.marks[key].find();
          const isWrongDirection = (motionArgs.forward) ?
            cursorIsBefore(mark, cursor) : cursorIsBefore(cursor, mark);

          if (isWrongDirection) {
            continue;
          }
          if (motionArgs.linewise && (mark.line == cursor.line)) {
            continue;
          }

          const equal = cursorEqual(cursor, best);
          const between = (motionArgs.forward) ?
            cursorIsBetween(cursor, mark, best) :
            cursorIsBetween(best, mark, cursor);

          if (equal || between) {
            best = mark;
          }
        }
      }

      if (motionArgs.linewise) {
        best = Pos(best.line, findFirstNonWhiteSpaceCharacter(cm.getLine(best.line)));
      }
      return best;
    },
    moveByCharacters(_cm, head, motionArgs) {
      const cur = head;
      const repeat = motionArgs.repeat;
      const ch = motionArgs.forward ? cur.ch + repeat : cur.ch - repeat;
      return Pos(cur.line, ch);
    },
    moveByLines(cm, head, motionArgs, vim) {
      const cur = head;
      let endCh = cur.ch;
      switch (vim.lastMotion) {
        case this.moveByLines:
        case this.moveByDisplayLines:
        case this.moveByScroll:
        case this.moveToColumn:
        case this.moveToEol:
          endCh = vim.lastHPos;
          break;
        default:
          vim.lastHPos = endCh;
      }
      const repeat = motionArgs.repeat+(motionArgs.repeatOffset||0);
      let line = motionArgs.forward ? cur.line + repeat : cur.line - repeat;
      const first = cm.firstLine();
      const last = cm.lastLine();
      if ((line < first && cur.line == first) ||
          (line > last && cur.line == last)) {
        return;
      }
      const fold = cm.ace.session.getFoldLine(line);
      if (fold) {
        if (motionArgs.forward) {
          if (line > fold.start.row)
            line = fold.end.row + 1;
        } else {
          line = fold.start.row;
        }
      }
      if (motionArgs.toFirstChar){
        endCh=findFirstNonWhiteSpaceCharacter(cm.getLine(line));
        vim.lastHPos = endCh;
      }
      vim.lastHSPos = cm.charCoords(Pos(line, endCh),'div').left;
      return Pos(line, endCh);
    },
    moveByDisplayLines(cm, head, motionArgs, vim) {
      const cur = head;
      switch (vim.lastMotion) {
        case this.moveByDisplayLines:
        case this.moveByScroll:
        case this.moveByLines:
        case this.moveToColumn:
        case this.moveToEol:
          break;
        default:
          vim.lastHSPos = cm.charCoords(cur,'div').left;
      }
      const repeat = motionArgs.repeat;
      var res=cm.findPosV(cur,(motionArgs.forward ? repeat : -repeat),'line',vim.lastHSPos);
      if (res.hitSide) {
        if (motionArgs.forward) {
          const lastCharCoords = cm.charCoords(res, 'div');
          const goalCoords = { top: lastCharCoords.top + 8, left: vim.lastHSPos };
          var res = cm.coordsChar(goalCoords, 'div');
        } else {
          const resCoords = cm.charCoords(Pos(cm.firstLine(), 0), 'div');
          resCoords.left = vim.lastHSPos;
          res = cm.coordsChar(resCoords, 'div');
        }
      }
      vim.lastHPos = res.ch;
      return res;
    },
    moveByPage(cm, head, motionArgs) {
      const curStart = head;
      const repeat = motionArgs.repeat;
      return cm.findPosV(curStart, (motionArgs.forward ? repeat : -repeat), 'page');
    },
    moveByParagraph(cm, head, motionArgs) {
      const dir = motionArgs.forward ? 1 : -1;
      return findParagraph(cm, head, motionArgs.repeat, dir);
    },
    moveByScroll(cm, head, motionArgs, vim) {
      const scrollbox = cm.getScrollInfo();
      var curEnd = null;
      let repeat = motionArgs.repeat;
      if (!repeat) {
        repeat = scrollbox.clientHeight / (2 * cm.defaultTextHeight());
      }
      const orig = cm.charCoords(head, 'local');
      motionArgs.repeat = repeat;
      var curEnd = motions.moveByDisplayLines(cm, head, motionArgs, vim);
      if (!curEnd) {
        return null;
      }
      const dest = cm.charCoords(curEnd, 'local');
      cm.scrollTo(null, scrollbox.top + dest.top - orig.top);
      return curEnd;
    },
    moveByWords(cm, head, motionArgs) {
      return moveToWord(cm, head, motionArgs.repeat, !!motionArgs.forward,
          !!motionArgs.wordEnd, !!motionArgs.bigWord);
    },
    moveTillCharacter(cm, _head, motionArgs) {
      const repeat = motionArgs.repeat;
      const curEnd = moveToCharacter(cm, repeat, motionArgs.forward,
          motionArgs.selectedCharacter);
      const increment = motionArgs.forward ? -1 : 1;
      recordLastCharacterSearch(increment, motionArgs);
      if (!curEnd) return null;
      curEnd.ch += increment;
      return curEnd;
    },
    moveToCharacter(cm, head, motionArgs) {
      const repeat = motionArgs.repeat;
      recordLastCharacterSearch(0, motionArgs);
      return moveToCharacter(cm, repeat, motionArgs.forward,
          motionArgs.selectedCharacter) || head;
    },
    moveToSymbol(cm, head, motionArgs) {
      const repeat = motionArgs.repeat;
      return findSymbol(cm, repeat, motionArgs.forward,
          motionArgs.selectedCharacter) || head;
    },
    moveToColumn(cm, head, motionArgs, vim) {
      const repeat = motionArgs.repeat;
      vim.lastHPos = repeat - 1;
      vim.lastHSPos = cm.charCoords(head,'div').left;
      return moveToColumn(cm, repeat);
    },
    moveToEol(cm, head, motionArgs, vim) {
      const cur = head;
      vim.lastHPos = Infinity;
      const retval= Pos(cur.line + motionArgs.repeat - 1, Infinity);
      const end=cm.clipPos(retval);
      end.ch--;
      vim.lastHSPos = cm.charCoords(end,'div').left;
      return retval;
    },
    moveToFirstNonWhiteSpaceCharacter(cm, head) {
      const cursor = head;
      return Pos(cursor.line,
                 findFirstNonWhiteSpaceCharacter(cm.getLine(cursor.line)));
    },
    moveToMatchedSymbol(cm, head) {
      const cursor = head;
      const line = cursor.line;
      let ch = cursor.ch;
      const lineText = cm.getLine(line);
      let symbol;
      do {
        symbol = lineText.charAt(ch++);
        if (symbol && isMatchableSymbol(symbol)) {
          const style = cm.getTokenTypeAt(Pos(line, ch));
          if (style !== "string" && style !== "comment") {
            break;
          }
        }
      } while (symbol);
      if (symbol) {
        const matched = cm.findMatchingBracket(Pos(line, ch));
        return matched.to;
      } else {
        return cursor;
      }
    },
    moveToStartOfLine(_cm, head) {
      return Pos(head.line, 0);
    },
    moveToLineOrEdgeOfDocument(cm, _head, motionArgs) {
      let lineNum = motionArgs.forward ? cm.lastLine() : cm.firstLine();
      if (motionArgs.repeatIsExplicit) {
        lineNum = motionArgs.repeat - cm.getOption('firstLineNumber');
      }
      return Pos(lineNum,
                 findFirstNonWhiteSpaceCharacter(cm.getLine(lineNum)));
    },
    textObjectManipulation(cm, head, motionArgs, vim) {
      const mirroredPairs = {'(': ')', ')': '(',
                           '{': '}', '}': '{',
                           '[': ']', ']': '['};
      const selfPaired = {'\'': true, '"': true};

      let character = motionArgs.selectedCharacter;
      if (character == 'b') {
        character = '(';
      } else if (character == 'B') {
        character = '{';
      }
      const inclusive = !motionArgs.textObjectInner;

      let tmp;
      if (mirroredPairs[character]) {
        tmp = selectCompanionObject(cm, head, character, inclusive);
      } else if (selfPaired[character]) {
        tmp = findBeginningAndEnd(cm, head, character, inclusive);
      } else if (character === 'W') {
        tmp = expandWordUnderCursor(cm, inclusive, true /** forward */,
                                                   true /** bigWord */);
      } else if (character === 'w') {
        tmp = expandWordUnderCursor(cm, inclusive, true /** forward */,
                                                   false /** bigWord */);
      } else if (character === 'p') {
        tmp = findParagraph(cm, head, motionArgs.repeat, 0, inclusive);
        motionArgs.linewise = true;
        if (vim.visualMode) {
          if (!vim.visualLine) { vim.visualLine = true; }
        } else {
          const operatorArgs = vim.inputState.operatorArgs;
          if (operatorArgs) { operatorArgs.linewise = true; }
          tmp.end.line--;
        }
      } else {
        return null;
      }

      if (!cm.state.vim.visualMode) {
        return [tmp.start, tmp.end];
      } else {
        return expandSelection(cm, tmp.start, tmp.end);
      }
    },

    repeatLastCharacterSearch(cm, head, motionArgs) {
      const lastSearch = vimGlobalState.lastChararacterSearch;
      const repeat = motionArgs.repeat;
      const forward = motionArgs.forward === lastSearch.forward;
      const increment = (lastSearch.increment ? 1 : 0) * (forward ? -1 : 1);
      cm.moveH(-increment, 'char');
      motionArgs.inclusive = forward ? true : false;
      const curEnd = moveToCharacter(cm, repeat, forward, lastSearch.selectedCharacter);
      if (!curEnd) {
        cm.moveH(increment, 'char');
        return head;
      }
      curEnd.ch += increment;
      return curEnd;
    }
  };

  function defineMotion(name, fn) {
    motions[name] = fn;
  }

  function fillArray(val, times) {
    const arr = [];
    for (let i = 0; i < times; i++) {
      arr.push(val);
    }
    return arr;
  }
  var operators = {
    change(cm, args, ranges) {
      let finalHead;
      let text;
      const vim = cm.state.vim;
      vimGlobalState.macroModeState.lastInsertModeChanges.inVisualBlock = vim.visualBlock;
      if (!vim.visualMode) {
        const anchor = ranges[0].anchor;
        let head = ranges[0].head;
        text = cm.getRange(anchor, head);
        const lastState = vim.lastEditInputState || {};
        if (lastState.motion == "moveByWords" && !isWhiteSpaceString(text)) {
          const match = (/\s+$/).exec(text);
          if (match && lastState.motionArgs && lastState.motionArgs.forward) {
            head = offsetCursor(head, 0, - match[0].length);
            text = text.slice(0, - match[0].length);
          }
        }
        const prevLineEnd = new Pos(anchor.line - 1, Number.MAX_VALUE);
        const wasLastLine = cm.firstLine() == cm.lastLine();
        if (head.line > cm.lastLine() && args.linewise && !wasLastLine) {
          cm.replaceRange('', prevLineEnd, head);
        } else {
          cm.replaceRange('', anchor, head);
        }
        if (args.linewise) {
          if (!wasLastLine) {
            cm.setCursor(prevLineEnd);
            CodeMirror.commands.newlineAndIndent(cm);
          }
          anchor.ch = Number.MAX_VALUE;
        }
        finalHead = anchor;
      } else {
        text = cm.getSelection();
        const replacement = fillArray('', ranges.length);
        cm.replaceSelections(replacement);
        finalHead = cursorMin(ranges[0].head, ranges[0].anchor);
      }
      vimGlobalState.registerController.pushText(
          args.registerName, 'change', text,
          args.linewise, ranges.length > 1);
      actions.enterInsertMode(cm, {head: finalHead}, cm.state.vim);
    },
    'delete'(cm, args, ranges) {
      let finalHead;
      let text;
      const vim = cm.state.vim;
      if (!vim.visualBlock) {
        let anchor = ranges[0].anchor;
        const head = ranges[0].head;
        if (args.linewise &&
            head.line != cm.firstLine() &&
            anchor.line == cm.lastLine() &&
            anchor.line == head.line - 1) {
          if (anchor.line == cm.firstLine()) {
            anchor.ch = 0;
          } else {
            anchor = Pos(anchor.line - 1, lineLength(cm, anchor.line - 1));
          }
        }
        text = cm.getRange(anchor, head);
        cm.replaceRange('', anchor, head);
        finalHead = anchor;
        if (args.linewise) {
          finalHead = motions.moveToFirstNonWhiteSpaceCharacter(cm, anchor);
        }
      } else {
        text = cm.getSelection();
        const replacement = fillArray('', ranges.length);
        cm.replaceSelections(replacement);
        finalHead = ranges[0].anchor;
      }
      vimGlobalState.registerController.pushText(
          args.registerName, 'delete', text,
          args.linewise, vim.visualBlock);
      return clipCursorToContent(cm, finalHead);
    },
    indent(cm, args, ranges) {
      const vim = cm.state.vim;
      const startLine = ranges[0].anchor.line;
      let endLine = vim.visualBlock ?
        ranges[ranges.length - 1].anchor.line :
        ranges[0].head.line;
      const repeat = (vim.visualMode) ? args.repeat : 1;
      if (args.linewise) {
        endLine--;
      }
      for (let i = startLine; i <= endLine; i++) {
        for (let j = 0; j < repeat; j++) {
          cm.indentLine(i, args.indentRight);
        }
      }
      return motions.moveToFirstNonWhiteSpaceCharacter(cm, ranges[0].anchor);
    },
    changeCase(cm, args, ranges, oldAnchor, newHead) {
      const selections = cm.getSelections();
      const swapped = [];
      const toLower = args.toLower;

      for (const toSwap of selections) {
        let text = '';
        if (toLower === true) {
          text = toSwap.toLowerCase();
        } else if (toLower === false) {
          text = toSwap.toUpperCase();
        } else {
          for (let i = 0; i < toSwap.length; i++) {
            const character = toSwap.charAt(i);
            text += isUpperCase(character) ? character.toLowerCase() :
                character.toUpperCase();
          }
        }
        swapped.push(text);
      }

      cm.replaceSelections(swapped);
      if (args.shouldMoveCursor){
        return newHead;
      } else if (!cm.state.vim.visualMode && args.linewise && ranges[0].anchor.line + 1 == ranges[0].head.line) {
        return motions.moveToFirstNonWhiteSpaceCharacter(cm, oldAnchor);
      } else if (args.linewise){
        return oldAnchor;
      } else {
        return cursorMin(ranges[0].anchor, ranges[0].head);
      }
    },
    yank(cm, args, ranges, oldAnchor) {
      const vim = cm.state.vim;
      const text = cm.getSelection();
      const endPos = vim.visualMode
        ? cursorMin(vim.sel.anchor, vim.sel.head, ranges[0].head, ranges[0].anchor)
        : oldAnchor;
      vimGlobalState.registerController.pushText(
          args.registerName, 'yank',
          text, args.linewise, vim.visualBlock);
      return endPos;
    }
  };

  function defineOperator(name, fn) {
    operators[name] = fn;
  }

  var actions = {
    jumpListWalk(cm, actionArgs, vim) {
      if (vim.visualMode) {
        return;
      }
      const repeat = actionArgs.repeat;
      const forward = actionArgs.forward;
      const jumpList = vimGlobalState.jumpList;

      const mark = jumpList.move(cm, forward ? repeat : -repeat);
      let markPos = mark ? mark.find() : undefined;
      markPos = markPos ? markPos : cm.getCursor();
      cm.setCursor(markPos);
      cm.ace.curOp.command.scrollIntoView = "center-animate"; // ace_patch
    },
    scroll(cm, actionArgs, vim) {
      if (vim.visualMode) {
        return;
      }
      const repeat = actionArgs.repeat || 1;
      const lineHeight = cm.defaultTextHeight();
      const top = cm.getScrollInfo().top;
      const delta = lineHeight * repeat;
      const newPos = actionArgs.forward ? top + delta : top - delta;
      const cursor = copyCursor(cm.getCursor());
      let cursorCoords = cm.charCoords(cursor, 'local');
      if (actionArgs.forward) {
        if (newPos > cursorCoords.top) {
           cursor.line += (newPos - cursorCoords.top) / lineHeight;
           cursor.line = Math.ceil(cursor.line);
           cm.setCursor(cursor);
           cursorCoords = cm.charCoords(cursor, 'local');
           cm.scrollTo(null, cursorCoords.top);
        } else {
           cm.scrollTo(null, newPos);
        }
      } else {
        const newBottom = newPos + cm.getScrollInfo().clientHeight;
        if (newBottom < cursorCoords.bottom) {
           cursor.line -= (cursorCoords.bottom - newBottom) / lineHeight;
           cursor.line = Math.floor(cursor.line);
           cm.setCursor(cursor);
           cursorCoords = cm.charCoords(cursor, 'local');
           cm.scrollTo(
               null, cursorCoords.bottom - cm.getScrollInfo().clientHeight);
        } else {
           cm.scrollTo(null, newPos);
        }
      }
    },
    scrollToCursor(cm, actionArgs) {
      const lineNum = cm.getCursor().line;
      const charCoords = cm.charCoords(Pos(lineNum, 0), 'local');
      const height = cm.getScrollInfo().clientHeight;
      let y = charCoords.top;
      const lineHeight = charCoords.bottom - y;
      switch (actionArgs.position) {
        case 'center': y = y - (height / 2) + lineHeight;
          break;
        case 'bottom': y = y - height + lineHeight*1.4;
          break;
        case 'top': y = y + lineHeight*0.4;
          break;
      }
      cm.scrollTo(null, y);
    },
    replayMacro(cm, actionArgs, vim) {
      let registerName = actionArgs.selectedCharacter;
      let repeat = actionArgs.repeat;
      const macroModeState = vimGlobalState.macroModeState;
      if (registerName == '@') {
        registerName = macroModeState.latestRegister;
      }
      while(repeat--){
        executeMacroRegister(cm, vim, macroModeState, registerName);
      }
    },
    enterMacroRecordMode(cm, actionArgs) {
      const macroModeState = vimGlobalState.macroModeState;
      const registerName = actionArgs.selectedCharacter;
      macroModeState.enterMacroRecordMode(cm, registerName);
    },
    enterInsertMode(cm, actionArgs, vim) {
      if (cm.getOption('readOnly')) { return; }
      vim.insertMode = true;
      vim.insertModeRepeat = actionArgs && actionArgs.repeat || 1;
      const insertAt = (actionArgs) ? actionArgs.insertAt : null;
      const sel = vim.sel;
      let head = actionArgs.head || cm.getCursor('head');
      let height = cm.listSelections().length;
      if (insertAt == 'eol') {
        head = Pos(head.line, lineLength(cm, head.line));
      } else if (insertAt == 'charAfter') {
        head = offsetCursor(head, 0, 1);
      } else if (insertAt == 'firstNonBlank') {
        head = motions.moveToFirstNonWhiteSpaceCharacter(cm, head);
      } else if (insertAt == 'startOfSelectedArea') {
        if (!vim.visualBlock) {
          if (sel.head.line < sel.anchor.line) {
            head = sel.head;
          } else {
            head = Pos(sel.anchor.line, 0);
          }
        } else {
          head = Pos(
              Math.min(sel.head.line, sel.anchor.line),
              Math.min(sel.head.ch, sel.anchor.ch));
          height = Math.abs(sel.head.line - sel.anchor.line) + 1;
        }
      } else if (insertAt == 'endOfSelectedArea') {
        if (!vim.visualBlock) {
          if (sel.head.line >= sel.anchor.line) {
            head = offsetCursor(sel.head, 0, 1);
          } else {
            head = Pos(sel.anchor.line, 0);
          }
        } else {
          head = Pos(
              Math.min(sel.head.line, sel.anchor.line),
              Math.max(sel.head.ch + 1, sel.anchor.ch));
          height = Math.abs(sel.head.line - sel.anchor.line) + 1;
        }
      } else if (insertAt == 'inplace') {
        if (vim.visualMode){
          return;
        }
      }
      cm.setOption('keyMap', 'vim-insert');
      cm.setOption('disableInput', false);
      if (actionArgs && actionArgs.replace) {
        cm.toggleOverwrite(true);
        cm.setOption('keyMap', 'vim-replace');
        CodeMirror.signal(cm, "vim-mode-change", {mode: "replace"});
      } else {
        cm.setOption('keyMap', 'vim-insert');
        CodeMirror.signal(cm, "vim-mode-change", {mode: "insert"});
      }
      if (!vimGlobalState.macroModeState.isPlaying) {
        cm.on('change', onChange);
        CodeMirror.on(cm.getInputField(), 'keydown', onKeyEventTargetKeyDown);
      }
      if (vim.visualMode) {
        exitVisualMode(cm);
      }
      selectForInsert(cm, head, height);
    },
    toggleVisualMode(cm, actionArgs, vim) {
      const repeat = actionArgs.repeat;
      const anchor = cm.getCursor();
      let head;
      if (!vim.visualMode) {
        vim.visualMode = true;
        vim.visualLine = !!actionArgs.linewise;
        vim.visualBlock = !!actionArgs.blockwise;
        head = clipCursorToContent(
            cm, Pos(anchor.line, anchor.ch + repeat - 1),
            true /** includeLineBreak */);
        vim.sel = {
          anchor,
          head
        };
        CodeMirror.signal(cm, "vim-mode-change", {mode: "visual", subMode: vim.visualLine ? "linewise" : vim.visualBlock ? "blockwise" : ""});
        updateCmSelection(cm);
        updateMark(cm, vim, '<', cursorMin(anchor, head));
        updateMark(cm, vim, '>', cursorMax(anchor, head));
      } else if (vim.visualLine ^ actionArgs.linewise ||
          vim.visualBlock ^ actionArgs.blockwise) {
        vim.visualLine = !!actionArgs.linewise;
        vim.visualBlock = !!actionArgs.blockwise;
        CodeMirror.signal(cm, "vim-mode-change", {mode: "visual", subMode: vim.visualLine ? "linewise" : vim.visualBlock ? "blockwise" : ""});
        updateCmSelection(cm);
      } else {
        exitVisualMode(cm);
      }
    },
    reselectLastSelection(cm, _actionArgs, vim) {
      const lastSelection = vim.lastSelection;
      if (vim.visualMode) {
        updateLastSelection(cm, vim);
      }
      if (lastSelection) {
        const anchor = lastSelection.anchorMark.find();
        const head = lastSelection.headMark.find();
        if (!anchor || !head) {
          return;
        }
        vim.sel = {
          anchor,
          head
        };
        vim.visualMode = true;
        vim.visualLine = lastSelection.visualLine;
        vim.visualBlock = lastSelection.visualBlock;
        updateCmSelection(cm);
        updateMark(cm, vim, '<', cursorMin(anchor, head));
        updateMark(cm, vim, '>', cursorMax(anchor, head));
        CodeMirror.signal(cm, 'vim-mode-change', {
          mode: 'visual',
          subMode: vim.visualLine ? 'linewise' :
                   vim.visualBlock ? 'blockwise' : ''});
      }
    },
    joinLines(cm, actionArgs, vim) {
      let curStart;
      let curEnd;
      if (vim.visualMode) {
        curStart = cm.getCursor('anchor');
        curEnd = cm.getCursor('head');
        if (cursorIsBefore(curEnd, curStart)) {
          var tmp = curEnd;
          curEnd = curStart;
          curStart = tmp;
        }
        curEnd.ch = lineLength(cm, curEnd.line) - 1;
      } else {
        const repeat = Math.max(actionArgs.repeat, 2);
        curStart = cm.getCursor();
        curEnd = clipCursorToContent(cm, Pos(curStart.line + repeat - 1,
                                             Infinity));
      }
      let finalCh = 0;
      for (let i = curStart.line; i < curEnd.line; i++) {
        finalCh = lineLength(cm, curStart.line);
        var tmp = Pos(curStart.line + 1,
                      lineLength(cm, curStart.line + 1));
        let text = cm.getRange(curStart, tmp);
        text = text.replace(/\n\s*/g, ' ');
        cm.replaceRange(text, curStart, tmp);
      }
      const curFinalPos = Pos(curStart.line, finalCh);
      if (vim.visualMode) {
        exitVisualMode(cm, false);
      }
      cm.setCursor(curFinalPos);
    },
    newLineAndEnterInsertMode(cm, actionArgs, vim) {
      vim.insertMode = true;
      const insertAt = copyCursor(cm.getCursor());
      if (insertAt.line === cm.firstLine() && !actionArgs.after) {
        cm.replaceRange('\n', Pos(cm.firstLine(), 0));
        cm.setCursor(cm.firstLine(), 0);
      } else {
        insertAt.line = (actionArgs.after) ? insertAt.line :
            insertAt.line - 1;
        insertAt.ch = lineLength(cm, insertAt.line);
        cm.setCursor(insertAt);
        const newlineFn = CodeMirror.commands.newlineAndIndentContinueComment ||
            CodeMirror.commands.newlineAndIndent;
        newlineFn(cm);
      }
      this.enterInsertMode(cm, { repeat: actionArgs.repeat }, vim);
    },
    paste(cm, actionArgs, vim) {
      const cur = copyCursor(cm.getCursor());
      const register = vimGlobalState.registerController.getRegister(
          actionArgs.registerName);
      var text = register.toString();
      if (!text) {
        return;
      }
      if (actionArgs.matchIndent) {
        const tabSize = cm.getOption("tabSize");
        const whitespaceLength = str => {
          const tabs = (str.split("\t").length - 1);
          const spaces = (str.split(" ").length - 1);
          return tabs * tabSize + spaces * 1;
        };
        const currentLine = cm.getLine(cm.getCursor().line);
        const indent = whitespaceLength(currentLine.match(/^\s*/)[0]);
        const chompedText = text.replace(/\n$/, '');
        const wasChomped = text !== chompedText;
        const firstIndent = whitespaceLength(text.match(/^\s*/)[0]);
        var text = chompedText.replace(/^\s*/gm, wspace => {
          const newIndent = indent + (whitespaceLength(wspace) - firstIndent);
          if (newIndent < 0) {
            return "";
          }
          else if (cm.getOption("indentWithTabs")) {
            const quotient = Math.floor(newIndent / tabSize);
            return Array(quotient + 1).join('\t');
          }
          else {
            return Array(newIndent + 1).join(' ');
          }
        });
        text += wasChomped ? "\n" : "";
      }
      if (actionArgs.repeat > 1) {
        var text = Array(actionArgs.repeat + 1).join(text);
      }
      const linewise = register.linewise;
      const blockwise = register.blockwise;
      if (linewise && !blockwise) {
        if(vim.visualMode) {
          text = vim.visualLine ? text.slice(0, -1) : `\n${text.slice(0, text.length - 1)}\n`;
        } else if (actionArgs.after) {
          text = `\n${text.slice(0, text.length - 1)}`;
          cur.ch = lineLength(cm, cur.line);
        } else {
          cur.ch = 0;
        }
      } else {
        if (blockwise) {
          text = text.split('\n');
          for (var i = 0; i < text.length; i++) {
            text[i] = (text[i] == '') ? ' ' : text[i];
          }
        }
        cur.ch += actionArgs.after ? 1 : 0;
      }
      let curPosFinal;
      let idx;
      if (vim.visualMode) {
        vim.lastPastedText = text;
        let lastSelectionCurEnd;
        const selectedArea = getSelectedAreaRange(cm, vim);
        const selectionStart = selectedArea[0];
        let selectionEnd = selectedArea[1];
        const selectedText = cm.getSelection();
        const selections = cm.listSelections();
        const emptyStrings = new Array(selections.length).join('1').split('1');
        if (vim.lastSelection) {
          lastSelectionCurEnd = vim.lastSelection.headMark.find();
        }
        vimGlobalState.registerController.unnamedRegister.setText(selectedText);
        if (blockwise) {
          cm.replaceSelections(emptyStrings);
          selectionEnd = Pos(selectionStart.line + text.length-1, selectionStart.ch);
          cm.setCursor(selectionStart);
          selectBlock(cm, selectionEnd);
          cm.replaceSelections(text);
          curPosFinal = selectionStart;
        } else if (vim.visualBlock) {
          cm.replaceSelections(emptyStrings);
          cm.setCursor(selectionStart);
          cm.replaceRange(text, selectionStart, selectionStart);
          curPosFinal = selectionStart;
        } else {
          cm.replaceRange(text, selectionStart, selectionEnd);
          curPosFinal = cm.posFromIndex(cm.indexFromPos(selectionStart) + text.length - 1);
        }
        if(lastSelectionCurEnd) {
          vim.lastSelection.headMark = cm.setBookmark(lastSelectionCurEnd);
        }
        if (linewise) {
          curPosFinal.ch=0;
        }
      } else {
        if (blockwise) {
          cm.setCursor(cur);
          for (var i = 0; i < text.length; i++) {
            const line = cur.line+i;
            if (line > cm.lastLine()) {
              cm.replaceRange('\n',  Pos(line, 0));
            }
            const lastCh = lineLength(cm, line);
            if (lastCh < cur.ch) {
              extendLineToColumn(cm, line, cur.ch);
            }
          }
          cm.setCursor(cur);
          selectBlock(cm, Pos(cur.line + text.length-1, cur.ch));
          cm.replaceSelections(text);
          curPosFinal = cur;
        } else {
          cm.replaceRange(text, cur);
          if (linewise && actionArgs.after) {
            curPosFinal = Pos(
            cur.line + 1,
            findFirstNonWhiteSpaceCharacter(cm.getLine(cur.line + 1)));
          } else if (linewise && !actionArgs.after) {
            curPosFinal = Pos(
              cur.line,
              findFirstNonWhiteSpaceCharacter(cm.getLine(cur.line)));
          } else if (!linewise && actionArgs.after) {
            idx = cm.indexFromPos(cur);
            curPosFinal = cm.posFromIndex(idx + text.length - 1);
          } else {
            idx = cm.indexFromPos(cur);
            curPosFinal = cm.posFromIndex(idx + text.length);
          }
        }
      }
      if (vim.visualMode) {
        exitVisualMode(cm, false);
      }
      cm.setCursor(curPosFinal);
    },
    undo(cm, actionArgs) {
      cm.operation(() => {
        repeatFn(cm, CodeMirror.commands.undo, actionArgs.repeat)();
        cm.setCursor(cm.getCursor('anchor'));
      });
    },
    redo(cm, actionArgs) {
      repeatFn(cm, CodeMirror.commands.redo, actionArgs.repeat)();
    },
    setRegister(_cm, actionArgs, vim) {
      vim.inputState.registerName = actionArgs.selectedCharacter;
    },
    setMark(cm, actionArgs, vim) {
      const markName = actionArgs.selectedCharacter;
      updateMark(cm, vim, markName, cm.getCursor());
    },
    replace(cm, actionArgs, vim) {
      const replaceWith = actionArgs.selectedCharacter;
      let curStart = cm.getCursor();
      let replaceTo;
      let curEnd;
      const selections = cm.listSelections();
      if (vim.visualMode) {
        curStart = cm.getCursor('start');
        curEnd = cm.getCursor('end');
      } else {
        const line = cm.getLine(curStart.line);
        replaceTo = curStart.ch + actionArgs.repeat;
        if (replaceTo > line.length) {
          replaceTo=line.length;
        }
        curEnd = Pos(curStart.line, replaceTo);
      }
      if (replaceWith=='\n') {
        if (!vim.visualMode) cm.replaceRange('', curStart, curEnd);
        (CodeMirror.commands.newlineAndIndentContinueComment || CodeMirror.commands.newlineAndIndent)(cm);
      } else {
        let replaceWithStr = cm.getRange(curStart, curEnd);
        replaceWithStr = replaceWithStr.replace(/[^\n]/g, replaceWith);
        if (vim.visualBlock) {
          const spaces = new Array(cm.getOption("tabSize")+1).join(' ');
          replaceWithStr = cm.getSelection();
          replaceWithStr = replaceWithStr.replace(/\t/g, spaces).replace(/[^\n]/g, replaceWith).split('\n');
          cm.replaceSelections(replaceWithStr);
        } else {
          cm.replaceRange(replaceWithStr, curStart, curEnd);
        }
        if (vim.visualMode) {
          curStart = cursorIsBefore(selections[0].anchor, selections[0].head) ?
                       selections[0].anchor : selections[0].head;
          cm.setCursor(curStart);
          exitVisualMode(cm, false);
        } else {
          cm.setCursor(offsetCursor(curEnd, 0, -1));
        }
      }
    },
    incrementNumberToken(cm, actionArgs) {
      const cur = cm.getCursor();
      const lineStr = cm.getLine(cur.line);
      const re = /-?\d+/g;
      let match;
      let start;
      let end;
      let numberStr;
      let token;
      while ((match = re.exec(lineStr)) !== null) {
        token = match[0];
        start = match.index;
        end = start + token.length;
        if (cur.ch < end)break;
      }
      if (!actionArgs.backtrack && (end <= cur.ch))return;
      if (token) {
        const increment = actionArgs.increase ? 1 : -1;
        const number = parseInt(token) + (increment * actionArgs.repeat);
        const from = Pos(cur.line, start);
        const to = Pos(cur.line, end);
        numberStr = number.toString();
        cm.replaceRange(numberStr, from, to);
      } else {
        return;
      }
      cm.setCursor(Pos(cur.line, start + numberStr.length - 1));
    },
    repeatLastEdit(cm, actionArgs, vim) {
      const lastEditInputState = vim.lastEditInputState;
      if (!lastEditInputState) { return; }
      let repeat = actionArgs.repeat;
      if (repeat && actionArgs.repeatIsExplicit) {
        vim.lastEditInputState.repeatOverride = repeat;
      } else {
        repeat = vim.lastEditInputState.repeatOverride || repeat;
      }
      repeatLastEdit(cm, vim, repeat, false /** repeatForInsert */);
    },
    exitInsertMode
  };

  function defineAction(name, fn) {
    actions[name] = fn;
  }
  function clipCursorToContent(cm, cur, includeLineBreak) {
    const line = Math.min(Math.max(cm.firstLine(), cur.line), cm.lastLine() );
    let maxCh = lineLength(cm, line) - 1;
    maxCh = (includeLineBreak) ? maxCh + 1 : maxCh;
    const ch = Math.min(Math.max(0, cur.ch), maxCh);
    return Pos(line, ch);
  }
  function copyArgs(args) {
    const ret = {};
    for (const prop in args) {
      if (args.hasOwnProperty(prop)) {
        ret[prop] = args[prop];
      }
    }
    return ret;
  }
  function offsetCursor(cur, offsetLine, offsetCh) {
    if (typeof offsetLine === 'object') {
      offsetCh = offsetLine.ch;
      offsetLine = offsetLine.line;
    }
    return Pos(cur.line + offsetLine, cur.ch + offsetCh);
  }
  function getOffset(anchor, head) {
    return {
      line: head.line - anchor.line,
      ch: head.line - anchor.line
    };
  }
  function commandMatches(keys, keyMap, context, inputState) {
    let match;
    const partial = [];
    const full = [];

    for (const command of keyMap) {
      if (context == 'insert' && command.context != 'insert' ||
          command.context && command.context != context ||
          inputState.operator && command.type == 'action' ||
          !(match = commandMatch(keys, command.keys))) { continue; }
      if (match == 'partial') { partial.push(command); }
      if (match == 'full') { full.push(command); }
    }

    return {
      partial: partial.length && partial,
      full: full.length && full
    };
  }
  function commandMatch(pressed, mapped) {
    if (mapped.slice(-11) == '<character>') {
      const prefixLen = mapped.length - 11;
      const pressedPrefix = pressed.slice(0, prefixLen);
      const mappedPrefix = mapped.slice(0, prefixLen);
      return pressedPrefix == mappedPrefix && pressed.length > prefixLen ? 'full' :
             mappedPrefix.indexOf(pressedPrefix) == 0 ? 'partial' : false;
    } else {
      return pressed == mapped ? 'full' :
             mapped.indexOf(pressed) == 0 ? 'partial' : false;
    }
  }
  function lastChar(keys) {
    const match = /^.*(<[\w\-]+>)$/.exec(keys);
    let selectedCharacter = match ? match[1] : keys.slice(-1);
    if (selectedCharacter.length > 1){
      switch(selectedCharacter){
        case '<CR>':
          selectedCharacter='\n';
          break;
        case '<Space>':
          selectedCharacter=' ';
          break;
        default:
          break;
      }
    }
    return selectedCharacter;
  }
  function repeatFn(cm, fn, repeat) {
    return () => {
      for (let i = 0; i < repeat; i++) {
        fn(cm);
      }
    };
  }
  function copyCursor(cur) {
    return Pos(cur.line, cur.ch);
  }
  function cursorEqual(cur1, cur2) {
    return cur1.ch == cur2.ch && cur1.line == cur2.line;
  }
  function cursorIsBefore(cur1, cur2) {
    if (cur1.line < cur2.line) {
      return true;
    }
    if (cur1.line == cur2.line && cur1.ch < cur2.ch) {
      return true;
    }
    return false;
  }
  function cursorMin(cur1, cur2) {
    if (arguments.length > 2) {
      cur2 = cursorMin(...Array.prototype.slice.call(arguments, 1));
    }
    return cursorIsBefore(cur1, cur2) ? cur1 : cur2;
  }
  function cursorMax(cur1, cur2) {
    if (arguments.length > 2) {
      cur2 = cursorMax(...Array.prototype.slice.call(arguments, 1));
    }
    return cursorIsBefore(cur1, cur2) ? cur2 : cur1;
  }
  function cursorIsBetween(cur1, cur2, cur3) {
    const cur1before2 = cursorIsBefore(cur1, cur2);
    const cur2before3 = cursorIsBefore(cur2, cur3);
    return cur1before2 && cur2before3;
  }
  function lineLength(cm, lineNum) {
    return cm.getLine(lineNum).length;
  }
  function trim(s) {
    if (s.trim) {
      return s.trim();
    }
    return s.replace(/^\s+|\s+$/g, '');
  }
  function escapeRegex(s) {
    return s.replace(/([.?*+$\[\]\/\\(){}|\-])/g, '\\$1');
  }
  function extendLineToColumn(cm, lineNum, column) {
    const endCh = lineLength(cm, lineNum);
    const spaces = new Array(column-endCh+1).join(' ');
    cm.setCursor(Pos(lineNum, endCh));
    cm.replaceRange(spaces, cm.getCursor());
  }
  function selectBlock(cm, selectionEnd) {
    const selections = [];
    const ranges = cm.listSelections();
    const head = copyCursor(cm.clipPos(selectionEnd));
    const isClipped = !cursorEqual(selectionEnd, head);
    const curHead = cm.getCursor('head');
    let primIndex = getIndex(ranges, curHead);
    const wasClipped = cursorEqual(ranges[primIndex].head, ranges[primIndex].anchor);
    const max = ranges.length - 1;
    const index = max - primIndex > primIndex ? max : 0;
    const base = ranges[index].anchor;

    const firstLine = Math.min(base.line, head.line);
    const lastLine = Math.max(base.line, head.line);
    let baseCh = base.ch;
    let headCh = head.ch;

    const dir = ranges[index].head.ch - baseCh;
    const newDir = headCh - baseCh;
    if (dir > 0 && newDir <= 0) {
      baseCh++;
      if (!isClipped) { headCh--; }
    } else if (dir < 0 && newDir >= 0) {
      baseCh--;
      if (!wasClipped) { headCh++; }
    } else if (dir < 0 && newDir == -1) {
      baseCh--;
      headCh++;
    }
    for (let line = firstLine; line <= lastLine; line++) {
      const range = {anchor: new Pos(line, baseCh), head: new Pos(line, headCh)};
      selections.push(range);
    }
    primIndex = head.line == lastLine ? selections.length - 1 : 0;
    cm.setSelections(selections);
    selectionEnd.ch = headCh;
    base.ch = baseCh;
    return base;
  }
  function selectForInsert(cm, head, height) {
    const sel = [];
    for (let i = 0; i < height; i++) {
      const lineHead = offsetCursor(head, i, 0);
      sel.push({anchor: lineHead, head: lineHead});
    }
    cm.setSelections(sel, 0);
  }
  function getIndex(ranges, cursor, end) {
    for (let i = 0; i < ranges.length; i++) {
      const atAnchor = end != 'head' && cursorEqual(ranges[i].anchor, cursor);
      const atHead = end != 'anchor' && cursorEqual(ranges[i].head, cursor);
      if (atAnchor || atHead) {
        return i;
      }
    }
    return -1;
  }
  function getSelectedAreaRange(cm, vim) {
    const lastSelection = vim.lastSelection;
    const getCurrentSelectedAreaRange = () => {
      const selections = cm.listSelections();
      const start =  selections[0];
      const end = selections[selections.length-1];
      const selectionStart = cursorIsBefore(start.anchor, start.head) ? start.anchor : start.head;
      const selectionEnd = cursorIsBefore(end.anchor, end.head) ? end.head : end.anchor;
      return [selectionStart, selectionEnd];
    };
    const getLastSelectedAreaRange = () => {
      let selectionStart = cm.getCursor();
      let selectionEnd = cm.getCursor();
      const block = lastSelection.visualBlock;
      if (block) {
        const width = block.width;
        const height = block.height;
        selectionEnd = Pos(selectionStart.line + height, selectionStart.ch + width);
        const selections = [];
        for (let i = selectionStart.line; i < selectionEnd.line; i++) {
          const anchor = Pos(i, selectionStart.ch);
          const head = Pos(i, selectionEnd.ch);
          const range = {anchor, head};
          selections.push(range);
        }
        cm.setSelections(selections);
      } else {
        const start = lastSelection.anchorMark.find();
        const end = lastSelection.headMark.find();
        const line = end.line - start.line;
        const ch = end.ch - start.ch;
        selectionEnd = {line: selectionEnd.line + line, ch: line ? selectionEnd.ch : ch + selectionEnd.ch};
        if (lastSelection.visualLine) {
          selectionStart = Pos(selectionStart.line, 0);
          selectionEnd = Pos(selectionEnd.line, lineLength(cm, selectionEnd.line));
        }
        cm.setSelection(selectionStart, selectionEnd);
      }
      return [selectionStart, selectionEnd];
    };
    if (!vim.visualMode) {
      return getLastSelectedAreaRange();
    } else {
      return getCurrentSelectedAreaRange();
    }
  }
  function updateLastSelection(cm, vim) {
    const anchor = vim.sel.anchor;
    let head = vim.sel.head;
    if (vim.lastPastedText) {
      head = cm.posFromIndex(cm.indexFromPos(anchor) + vim.lastPastedText.length);
      vim.lastPastedText = null;
    }
    vim.lastSelection = {'anchorMark': cm.setBookmark(anchor),
                         'headMark': cm.setBookmark(head),
                         'anchor': copyCursor(anchor),
                         'head': copyCursor(head),
                         'visualMode': vim.visualMode,
                         'visualLine': vim.visualLine,
                         'visualBlock': vim.visualBlock};
  }
  function expandSelection(cm, start, end) {
    const sel = cm.state.vim.sel;
    let head = sel.head;
    let anchor = sel.anchor;
    let tmp;
    if (cursorIsBefore(end, start)) {
      tmp = end;
      end = start;
      start = tmp;
    }
    if (cursorIsBefore(head, anchor)) {
      head = cursorMin(start, head);
      anchor = cursorMax(anchor, end);
    } else {
      anchor = cursorMin(start, anchor);
      head = cursorMax(head, end);
      head = offsetCursor(head, 0, -1);
      if (head.ch == -1 && head.line != cm.firstLine()) {
        head = Pos(head.line - 1, lineLength(cm, head.line - 1));
      }
    }
    return [anchor, head];
  }
  function updateCmSelection(cm, sel, mode) {
    const vim = cm.state.vim;
    sel = sel || vim.sel;
    var mode = mode ||
      vim.visualLine ? 'line' : vim.visualBlock ? 'block' : 'char';
    const cmSel = makeCmSelection(cm, sel, mode);
    cm.setSelections(cmSel.ranges, cmSel.primary);
    updateFakeCursor(cm);
  }
  function makeCmSelection(cm, sel, mode, exclusive) {
    let head = copyCursor(sel.head);
    let anchor = copyCursor(sel.anchor);
    if (mode == 'char') {
      const headOffset = !exclusive && !cursorIsBefore(sel.head, sel.anchor) ? 1 : 0;
      const anchorOffset = cursorIsBefore(sel.head, sel.anchor) ? 1 : 0;
      head = offsetCursor(sel.head, 0, headOffset);
      anchor = offsetCursor(sel.anchor, 0, anchorOffset);
      return {
        ranges: [{anchor, head}],
        primary: 0
      };
    } else if (mode == 'line') {
      if (!cursorIsBefore(sel.head, sel.anchor)) {
        anchor.ch = 0;

        const lastLine = cm.lastLine();
        if (head.line > lastLine) {
          head.line = lastLine;
        }
        head.ch = lineLength(cm, head.line);
      } else {
        head.ch = 0;
        anchor.ch = lineLength(cm, anchor.line);
      }
      return {
        ranges: [{anchor, head}],
        primary: 0
      };
    } else if (mode == 'block') {
      const top = Math.min(anchor.line, head.line);
      const left = Math.min(anchor.ch, head.ch);
      const bottom = Math.max(anchor.line, head.line);
      const right = Math.max(anchor.ch, head.ch) + 1;
      const height = bottom - top + 1;
      const primary = head.line == top ? 0 : height - 1;
      const ranges = [];
      for (let i = 0; i < height; i++) {
        ranges.push({
          anchor: Pos(top + i, left),
          head: Pos(top + i, right)
        });
      }
      return {
        ranges,
        primary
      };
    }
  }
  function getHead(cm) {
    let cur = cm.getCursor('head');
    if (cm.getSelection().length == 1) {
      cur = cursorMin(cur, cm.getCursor('anchor'));
    }
    return cur;
  }
  function exitVisualMode(cm, moveHead) {
    const vim = cm.state.vim;
    if (moveHead !== false) {
      cm.setCursor(clipCursorToContent(cm, vim.sel.head));
    }
    updateLastSelection(cm, vim);
    vim.visualMode = false;
    vim.visualLine = false;
    vim.visualBlock = false;
    CodeMirror.signal(cm, "vim-mode-change", {mode: "normal"});
    if (vim.fakeCursor) {
      vim.fakeCursor.clear();
    }
  }
  function clipToLine(cm, curStart, curEnd) {
    const selection = cm.getRange(curStart, curEnd);
    if (/\n\s*$/.test(selection)) {
      const lines = selection.split('\n');
      lines.pop();
      var line;
      for (var line = lines.pop(); lines.length > 0 && line && isWhiteSpaceString(line); line = lines.pop()) {
        curEnd.line--;
        curEnd.ch = 0;
      }
      if (line) {
        curEnd.line--;
        curEnd.ch = lineLength(cm, curEnd.line);
      } else {
        curEnd.ch = 0;
      }
    }
  }
  function expandSelectionToLine(_cm, curStart, curEnd) {
    curStart.ch = 0;
    curEnd.ch = 0;
    curEnd.line++;
  }

  function findFirstNonWhiteSpaceCharacter(text) {
    if (!text) {
      return 0;
    }
    const firstNonWS = text.search(/\S/);
    return firstNonWS == -1 ? text.length : firstNonWS;
  }

  function expandWordUnderCursor(cm, inclusive, _forward, bigWord, noSymbol) {
    const cur = getHead(cm);
    const line = cm.getLine(cur.line);
    let idx = cur.ch;
    let test = noSymbol ? wordCharTest[0] : bigWordCharTest [0];
    while (!test(line.charAt(idx))) {
      idx++;
      if (idx >= line.length) { return null; }
    }

    if (bigWord) {
      test = bigWordCharTest[0];
    } else {
      test = wordCharTest[0];
      if (!test(line.charAt(idx))) {
        test = wordCharTest[1];
      }
    }

    let end = idx;
    let start = idx;
    while (test(line.charAt(end)) && end < line.length) { end++; }
    while (test(line.charAt(start)) && start >= 0) { start--; }
    start++;

    if (inclusive) {
      const wordEnd = end;
      while (/\s/.test(line.charAt(end)) && end < line.length) { end++; }
      if (wordEnd == end) {
        const wordStart = start;
        while (/\s/.test(line.charAt(start - 1)) && start > 0) { start--; }
        if (!start) { start = wordStart; }
      }
    }
    return { start: Pos(cur.line, start), end: Pos(cur.line, end) };
  }

  function recordJumpPosition(cm, oldCur, newCur) {
    if (!cursorEqual(oldCur, newCur)) {
      vimGlobalState.jumpList.add(cm, oldCur, newCur);
    }
  }

  function recordLastCharacterSearch(increment, args) {
      vimGlobalState.lastChararacterSearch.increment = increment;
      vimGlobalState.lastChararacterSearch.forward = args.forward;
      vimGlobalState.lastChararacterSearch.selectedCharacter = args.selectedCharacter;
  }

  const symbolToMode = {
      '(': 'bracket', ')': 'bracket', '{': 'bracket', '}': 'bracket',
      '[': 'section', ']': 'section',
      '*': 'comment', '/': 'comment',
      'm': 'method', 'M': 'method',
      '#': 'preprocess'
  };
  const findSymbolModes = {
    bracket: {
      isComplete(state) {
        if (state.nextCh === state.symb) {
          state.depth++;
          if (state.depth >= 1)return true;
        } else if (state.nextCh === state.reverseSymb) {
          state.depth--;
        }
        return false;
      }
    },
    section: {
      init(state) {
        state.curMoveThrough = true;
        state.symb = (state.forward ? ']' : '[') === state.symb ? '{' : '}';
      },
      isComplete(state) {
        return state.index === 0 && state.nextCh === state.symb;
      }
    },
    comment: {
      isComplete(state) {
        const found = state.lastCh === '*' && state.nextCh === '/';
        state.lastCh = state.nextCh;
        return found;
      }
    },
    method: {
      init(state) {
        state.symb = (state.symb === 'm' ? '{' : '}');
        state.reverseSymb = state.symb === '{' ? '}' : '{';
      },
      isComplete(state) {
        if (state.nextCh === state.symb)return true;
        return false;
      }
    },
    preprocess: {
      init(state) {
        state.index = 0;
      },
      isComplete(state) {
        if (state.nextCh === '#') {
          const token = state.lineText.match(/#(\w+)/)[1];
          if (token === 'endif') {
            if (state.forward && state.depth === 0) {
              return true;
            }
            state.depth++;
          } else if (token === 'if') {
            if (!state.forward && state.depth === 0) {
              return true;
            }
            state.depth--;
          }
          if (token === 'else' && state.depth === 0)return true;
        }
        return false;
      }
    }
  };
  function findSymbol(cm, repeat, forward, symb) {
    const cur = copyCursor(cm.getCursor());
    const increment = forward ? 1 : -1;
    const endLine = forward ? cm.lineCount() : -1;
    const curCh = cur.ch;
    let line = cur.line;
    const lineText = cm.getLine(line);
    const state = {
      lineText,
      nextCh: lineText.charAt(curCh),
      lastCh: null,
      index: curCh,
      symb,
      reverseSymb: (forward ?  { ')': '(', '}': '{' } : { '(': ')', '{': '}' })[symb],
      forward,
      depth: 0,
      curMoveThrough: false
    };
    const mode = symbolToMode[symb];
    if (!mode)return cur;
    const init = findSymbolModes[mode].init;
    const isComplete = findSymbolModes[mode].isComplete;
    if (init) { init(state); }
    while (line !== endLine && repeat) {
      state.index += increment;
      state.nextCh = state.lineText.charAt(state.index);
      if (!state.nextCh) {
        line += increment;
        state.lineText = cm.getLine(line) || '';
        if (increment > 0) {
          state.index = 0;
        } else {
          const lineLen = state.lineText.length;
          state.index = (lineLen > 0) ? (lineLen-1) : 0;
        }
        state.nextCh = state.lineText.charAt(state.index);
      }
      if (isComplete(state)) {
        cur.line = line;
        cur.ch = state.index;
        repeat--;
      }
    }
    if (state.nextCh || state.curMoveThrough) {
      return Pos(line, state.index);
    }
    return cur;
  }
  function findWord(cm, cur, forward, bigWord, emptyLineIsWord) {
    let lineNum = cur.line;
    let pos = cur.ch;
    let line = cm.getLine(lineNum);
    const dir = forward ? 1 : -1;
    const charTests = bigWord ? bigWordCharTest: wordCharTest;

    if (emptyLineIsWord && line == '') {
      lineNum += dir;
      line = cm.getLine(lineNum);
      if (!isLine(cm, lineNum)) {
        return null;
      }
      pos = (forward) ? 0 : line.length;
    }

    while (true) {
      if (emptyLineIsWord && line == '') {
        return { from: 0, to: 0, line: lineNum };
      }
      const stop = (dir > 0) ? line.length : -1;
      let wordStart = stop;
      let wordEnd = stop;
      while (pos != stop) {
        let foundWord = false;
        for (let i = 0; i < charTests.length && !foundWord; ++i) {
          if (charTests[i](line.charAt(pos))) {
            wordStart = pos;
            while (pos != stop && charTests[i](line.charAt(pos))) {
              pos += dir;
            }
            wordEnd = pos;
            foundWord = wordStart != wordEnd;
            if (wordStart == cur.ch && lineNum == cur.line &&
                wordEnd == wordStart + dir) {
              continue;
            } else {
              return {
                from: Math.min(wordStart, wordEnd + 1),
                to: Math.max(wordStart, wordEnd),
                line: lineNum };
            }
          }
        }
        if (!foundWord) {
          pos += dir;
        }
      }
      lineNum += dir;
      if (!isLine(cm, lineNum)) {
        return null;
      }
      line = cm.getLine(lineNum);
      pos = (dir > 0) ? 0 : line.length;
    }
    throw new Error('The impossible happened.');
  }
  function moveToWord(cm, cur, repeat, forward, wordEnd, bigWord) {
    const curStart = copyCursor(cur);
    const words = [];
    if (forward && !wordEnd || !forward && wordEnd) {
      repeat++;
    }
    const emptyLineIsWord = !(forward && wordEnd);
    for (let i = 0; i < repeat; i++) {
      const word = findWord(cm, cur, forward, bigWord, emptyLineIsWord);
      if (!word) {
        const eodCh = lineLength(cm, cm.lastLine());
        words.push(forward
            ? {line: cm.lastLine(), from: eodCh, to: eodCh}
            : {line: 0, from: 0, to: 0});
        break;
      }
      words.push(word);
      cur = Pos(word.line, forward ? (word.to - 1) : word.from);
    }
    const shortCircuit = words.length != repeat;
    const firstWord = words[0];
    let lastWord = words.pop();
    if (forward && !wordEnd) {
      if (!shortCircuit && (firstWord.from != curStart.ch || firstWord.line != curStart.line)) {
        lastWord = words.pop();
      }
      return Pos(lastWord.line, lastWord.from);
    } else if (forward && wordEnd) {
      return Pos(lastWord.line, lastWord.to - 1);
    } else if (!forward && wordEnd) {
      if (!shortCircuit && (firstWord.to != curStart.ch || firstWord.line != curStart.line)) {
        lastWord = words.pop();
      }
      return Pos(lastWord.line, lastWord.to);
    } else {
      return Pos(lastWord.line, lastWord.from);
    }
  }

  function moveToCharacter(cm, repeat, forward, character) {
    const cur = cm.getCursor();
    let start = cur.ch;
    let idx;
    for (let i = 0; i < repeat; i ++) {
      const line = cm.getLine(cur.line);
      idx = charIdxInLine(start, line, character, forward, true);
      if (idx == -1) {
        return null;
      }
      start = idx;
    }
    return Pos(cm.getCursor().line, idx);
  }

  function moveToColumn(cm, repeat) {
    const line = cm.getCursor().line;
    return clipCursorToContent(cm, Pos(line, repeat - 1));
  }

  function updateMark(cm, vim, markName, pos) {
    if (!inArray(markName, validMarks)) {
      return;
    }
    if (vim.marks[markName]) {
      vim.marks[markName].clear();
    }
    vim.marks[markName] = cm.setBookmark(pos);
  }

  function charIdxInLine(start, line, character, forward, includeChar) {
    let idx;
    if (forward) {
      idx = line.indexOf(character, start + 1);
      if (idx != -1 && !includeChar) {
        idx -= 1;
      }
    } else {
      idx = line.lastIndexOf(character, start - 1);
      if (idx != -1 && !includeChar) {
        idx += 1;
      }
    }
    return idx;
  }

  function findParagraph(cm, head, repeat, dir, inclusive) {
    let line = head.line;
    const min = cm.firstLine();
    const max = cm.lastLine();
    let start;
    let end;
    let i = line;
    function isEmpty(i) { return !/\S/.test(cm.getLine(i)); } // ace_patch
    function isBoundary(i, dir, any) {
      if (any) { return isEmpty(i) != isEmpty(i + dir); }
      return !isEmpty(i) && isEmpty(i + dir);
    }
    function skipFold(i) {
        dir = dir > 0 ? 1 : -1;
        const foldLine = cm.ace.session.getFoldLine(i);
        if (foldLine) {
            if (i + dir > foldLine.start.row && i + dir < foldLine.end.row)
                dir = (dir > 0 ? foldLine.end.row : foldLine.start.row) - i;
        }
    }
    if (dir) {
      while (min <= i && i <= max && repeat > 0) {
        skipFold(i);
        if (isBoundary(i, dir)) { repeat--; }
        i += dir;
      }
      return new Pos(i, 0);
    }

    const vim = cm.state.vim;
    if (vim.visualLine && isBoundary(line, 1, true)) {
      const anchor = vim.sel.anchor;
      if (isBoundary(anchor.line, -1, true)) {
        if (!inclusive || anchor.line != line) {
          line += 1;
        }
      }
    }
    let startState = isEmpty(line);
    for (i = line; i <= max && repeat; i++) {
      if (isBoundary(i, 1, true)) {
        if (!inclusive || isEmpty(i) != startState) {
          repeat--;
        }
      }
    }
    end = new Pos(i, 0);
    if (i > max && !startState) { startState = true; }
    else { inclusive = false; }
    for (i = line; i > min; i--) {
      if (!inclusive || isEmpty(i) == startState || i == line) {
        if (isBoundary(i, -1, true)) { break; }
      }
    }
    start = new Pos(i, 0);
    return { start, end };
  }
  function selectCompanionObject(cm, head, symb, inclusive) {
    const cur = head;
    let start;
    let end;

    const bracketRegexp = ({
      '(': /[()]/, ')': /[()]/,
      '[': /[[\]]/, ']': /[[\]]/,
      '{': /[{}]/, '}': /[{}]/})[symb];
    const openSym = ({
      '(': '(', ')': '(',
      '[': '[', ']': '[',
      '{': '{', '}': '{'})[symb];
    const curChar = cm.getLine(cur.line).charAt(cur.ch);
    const offset = curChar === openSym ? 1 : 0;

    start = cm.scanForBracket(Pos(cur.line, cur.ch + offset), -1, null, {'bracketRegex': bracketRegexp});
    end = cm.scanForBracket(Pos(cur.line, cur.ch + offset), 1, null, {'bracketRegex': bracketRegexp});

    if (!start || !end) {
      return { start: cur, end: cur };
    }

    start = start.pos;
    end = end.pos;

    if ((start.line == end.line && start.ch > end.ch)
        || (start.line > end.line)) {
      const tmp = start;
      start = end;
      end = tmp;
    }

    if (inclusive) {
      end.ch += 1;
    } else {
      start.ch += 1;
    }

    return { start, end };
  }
  function findBeginningAndEnd(cm, head, symb, inclusive) {
    const cur = copyCursor(head);
    const line = cm.getLine(cur.line);
    const chars = line.split('');
    let start;
    let end;
    let i;
    let len;
    const firstIndex = chars.indexOf(symb);
    if (cur.ch < firstIndex) {
      cur.ch = firstIndex;
    }
    else if (firstIndex < cur.ch && chars[cur.ch] == symb) {
      end = cur.ch; // assign end to the current cursor
      --cur.ch; // make sure to look backwards
    }
    if (chars[cur.ch] == symb && !end) {
      start = cur.ch + 1; // assign start to ahead of the cursor
    } else {
      for (i = cur.ch; i > -1 && !start; i--) {
        if (chars[i] == symb) {
          start = i + 1;
        }
      }
    }
    if (start && !end) {
      for (i = start, len = chars.length; i < len && !end; i++) {
        if (chars[i] == symb) {
          end = i;
        }
      }
    }
    if (!start || !end) {
      return { start: cur, end: cur };
    }
    if (inclusive) {
      --start; ++end;
    }

    return {
      start: Pos(cur.line, start),
      end: Pos(cur.line, end)
    };
  }
  defineOption('pcre', true, 'boolean');

  class SearchState {
    getQuery() {
      return vimGlobalState.query;
    }

    setQuery(query) {
      vimGlobalState.query = query;
    }

    getOverlay() {
      return this.searchOverlay;
    }

    setOverlay(overlay) {
      this.searchOverlay = overlay;
    }

    isReversed() {
      return vimGlobalState.isReversed;
    }

    setReversed(reversed) {
      vimGlobalState.isReversed = reversed;
    }

    getScrollbarAnnotate() {
      return this.annotate;
    }

    setScrollbarAnnotate(annotate) {
      this.annotate = annotate;
    }
  }

  function getSearchState(cm) {
    const vim = cm.state.vim;
    return vim.searchState_ || (vim.searchState_ = new SearchState());
  }
  function dialog(cm, template, shortText, onClose, options) {
    if (cm.openDialog) {
      cm.openDialog(template, onClose, { bottom: true, value: options.value,
          onKeyDown: options.onKeyDown, onKeyUp: options.onKeyUp,
          selectValueOnOpen: false});
    }
    else {
      onClose(prompt(shortText, ''));
    }
  }
  function splitBySlash(argString) {
    const slashes = findUnescapedSlashes(argString) || [];
    if (!slashes.length) return [];
    const tokens = [];
    if (slashes[0] !== 0) return;
    for (let i = 0; i < slashes.length; i++) {
      if (typeof slashes[i] == 'number')
        tokens.push(argString.substring(slashes[i] + 1, slashes[i+1]));
    }
    return tokens;
  }

  function findUnescapedSlashes(str) {
    let escapeNextChar = false;
    const slashes = [];
    for (let i = 0; i < str.length; i++) {
      const c = str.charAt(i);
      if (!escapeNextChar && c == '/') {
        slashes.push(i);
      }
      escapeNextChar = !escapeNextChar && (c == '\\');
    }
    return slashes;
  }
  function translateRegex(str) {
    const specials = '|(){';
    const unescape = '}';
    let escapeNextChar = false;
    const out = [];
    for (let i = -1; i < str.length; i++) {
      const c = str.charAt(i) || '';
      const n = str.charAt(i+1) || '';
      let specialComesNext = (n && specials.includes(n));
      if (escapeNextChar) {
        if (c !== '\\' || !specialComesNext) {
          out.push(c);
        }
        escapeNextChar = false;
      } else {
        if (c === '\\') {
          escapeNextChar = true;
          if (n && unescape.includes(n)) {
            specialComesNext = true;
          }
          if (!specialComesNext || n === '\\') {
            out.push(c);
          }
        } else {
          out.push(c);
          if (specialComesNext && n !== '\\') {
            out.push('\\');
          }
        }
      }
    }
    return out.join('');
  }
  const charUnescapes = {'\\n': '\n', '\\r': '\r', '\\t': '\t'};
  function translateRegexReplace(str) {
    let escapeNextChar = false;
    const out = [];
    for (let i = -1; i < str.length; i++) {
      const c = str.charAt(i) || '';
      const n = str.charAt(i+1) || '';
      if (charUnescapes[c + n]) {
        out.push(charUnescapes[c+n]);
        i++;
      } else if (escapeNextChar) {
        out.push(c);
        escapeNextChar = false;
      } else {
        if (c === '\\') {
          escapeNextChar = true;
          if ((isNumber(n) || n === '$')) {
            out.push('$');
          } else if (n !== '/' && n !== '\\') {
            out.push('\\');
          }
        } else {
          if (c === '$') {
            out.push('$');
          }
          out.push(c);
          if (n === '/') {
            out.push('\\');
          }
        }
      }
    }
    return out.join('');
  }
  const unescapes = {'\\/': '/', '\\\\': '\\', '\\n': '\n', '\\r': '\r', '\\t': '\t'};
  function unescapeRegexReplace(str) {
    const stream = new CodeMirror.StringStream(str);
    const output = [];
    while (!stream.eol()) {
      while (stream.peek() && stream.peek() != '\\') {
        output.push(stream.next());
      }
      let matched = false;
      for (const matcher in unescapes) {
        if (stream.match(matcher, true)) {
          matched = true;
          output.push(unescapes[matcher]);
          break;
        }
      }
      if (!matched) {
        output.push(stream.next());
      }
    }
    return output.join('');
  }
  function parseQuery(query, ignoreCase, smartCase) {
    const lastSearchRegister = vimGlobalState.registerController.getRegister('/');
    lastSearchRegister.setText(query);
    if (query instanceof RegExp) { return query; }
    const slashes = findUnescapedSlashes(query);
    let regexPart;
    let forceIgnoreCase;
    if (!slashes.length) {
      regexPart = query;
    } else {
      regexPart = query.substring(0, slashes[0]);
      const flagsPart = query.substring(slashes[0]);
      forceIgnoreCase = (flagsPart.includes('i'));
    }
    if (!regexPart) {
      return null;
    }
    if (!getOption('pcre')) {
      regexPart = translateRegex(regexPart);
    }
    if (smartCase) {
      ignoreCase = (/^[^A-Z]*$/).test(regexPart);
    }
    const regexp = new RegExp(regexPart,
        (ignoreCase || forceIgnoreCase) ? 'i' : undefined);
    return regexp;
  }
  function showConfirm(cm, text) {
    if (cm.openNotification) {
      cm.openNotification(`<p class="ace_dialog-confirm">${text}</p>`,
                          {bottom: true, duration: 3000});
    } else {
      alert(text);
    }
  }
  function makePrompt(prefix, desc) {
    let raw = '';
    if (prefix) {
      raw += `<span style="font-family: monospace">${prefix}</span>`;
    }
    raw += '<input type="text"/> ' +
        '<span style="color: #888">';
    if (desc) {
      raw += '<span style="color: #888">';
      raw += desc;
      raw += '</span>';
    }
    return raw;
  }
  var searchPromptDesc = '(Javascript regexp)';
  function showPrompt(cm, options) {
    const shortText = `${options.prefix || ''} ${options.desc || ''}`;
    const prompt = makePrompt(options.prefix, options.desc);
    dialog(cm, prompt, shortText, options.onClose, options);
  }
  function regexEqual(r1, r2) {
    if (r1 instanceof RegExp && r2 instanceof RegExp) {
      const props = ['global', 'multiline', 'ignoreCase', 'source'];

      for (const prop of props) {
        if (r1[prop] !== r2[prop]) {
            return false;
        }
      }

      return true;
    }
    return false;
  }
  function updateSearchQuery(cm, rawQuery, ignoreCase, smartCase) {
    if (!rawQuery) {
      return;
    }
    const state = getSearchState(cm);
    const query = parseQuery(rawQuery, !!ignoreCase, !!smartCase);
    if (!query) {
      return;
    }
    highlightSearchMatches(cm, query);
    if (regexEqual(query, state.getQuery())) {
      return query;
    }
    state.setQuery(query);
    return query;
  }
  function searchOverlay(query) {
    if (query.source.charAt(0) == '^') {
      var matchSol = true;
    }
    return {
      token(stream) {
        if (matchSol && !stream.sol()) {
          stream.skipToEnd();
          return;
        }
        const match = stream.match(query, false);
        if (match) {
          if (match[0].length == 0) {
            stream.next();
            return 'searching';
          }
          if (!stream.sol()) {
            stream.backUp(1);
            if (!query.exec(stream.next() + match[0])) {
              stream.next();
              return null;
            }
          }
          stream.match(query);
          return 'searching';
        }
        while (!stream.eol()) {
          stream.next();
          if (stream.match(query, false)) break;
        }
      },
      query
    };
  }
  function highlightSearchMatches(cm, query) {
    const searchState = getSearchState(cm);
    let overlay = searchState.getOverlay();
    if (!overlay || query != overlay.query) {
      if (overlay) {
        cm.removeOverlay(overlay);
      }
      overlay = searchOverlay(query);
      cm.addOverlay(overlay);
      if (cm.showMatchesOnScrollbar) {
        if (searchState.getScrollbarAnnotate()) {
          searchState.getScrollbarAnnotate().clear();
        }
        searchState.setScrollbarAnnotate(cm.showMatchesOnScrollbar(query));
      }
      searchState.setOverlay(overlay);
    }
  }
  function findNext(cm, prev, query, repeat) {
    if (repeat === undefined) { repeat = 1; }
    return cm.operation(() => {
      const pos = cm.getCursor();
      let cursor = cm.getSearchCursor(query, pos);
      for (let i = 0; i < repeat; i++) {
        let found = cursor.find(prev);
        if (i == 0 && found && cursorEqual(cursor.from(), pos)) { found = cursor.find(prev); }
        if (!found) {
          cursor = cm.getSearchCursor(query,
              (prev) ? Pos(cm.lastLine()) : Pos(cm.firstLine(), 0) );
          if (!cursor.find(prev)) {
            return;
          }
        }
      }
      return cursor.from();
    });
  }
  function clearSearchHighlight(cm) {
    const state = getSearchState(cm);
    cm.removeOverlay(getSearchState(cm).getOverlay());
    state.setOverlay(null);
    if (state.getScrollbarAnnotate()) {
      state.getScrollbarAnnotate().clear();
      state.setScrollbarAnnotate(null);
    }
  }
  function isInRange(pos, start, end) {
    if (typeof pos != 'number') {
      pos = pos.line;
    }
    if (start instanceof Array) {
      return inArray(pos, start);
    } else {
      if (end) {
        return (pos >= start && pos <= end);
      } else {
        return pos == start;
      }
    }
  }
  function getUserVisibleLines(cm) {
    const renderer = cm.ace.renderer;
    return {
      top: renderer.getFirstFullyVisibleRow(),
      bottom: renderer.getLastFullyVisibleRow()
    }
  }

  class ExCommandDispatcher {
    constructor() {
      this.buildCommandMap_();
    }

    processCommand(cm, input, opt_params) {
      const that = this;
      cm.operation(() => {
        cm.curOp.isVimOp = true;
        that._processCommand(cm, input, opt_params);
      });
    }

    _processCommand(cm, input, opt_params) {
      const vim = cm.state.vim;
      const commandHistoryRegister = vimGlobalState.registerController.getRegister(':');
      const previousCommand = commandHistoryRegister.toString();
      if (vim.visualMode) {
        exitVisualMode(cm);
      }
      const inputStream = new CodeMirror.StringStream(input);
      commandHistoryRegister.setText(input);
      const params = opt_params || {};
      params.input = input;
      try {
        this.parseInput_(cm, inputStream, params);
      } catch(e) {
        showConfirm(cm, e);
        throw e;
      }
      let command;
      let commandName;
      if (!params.commandName) {
        if (params.line !== undefined) {
          commandName = 'move';
        }
      } else {
        command = this.matchCommand_(params.commandName);
        if (command) {
          commandName = command.name;
          if (command.excludeFromCommandHistory) {
            commandHistoryRegister.setText(previousCommand);
          }
          this.parseCommandArgs_(inputStream, params, command);
          if (command.type == 'exToKey') {
            for (let i = 0; i < command.toKeys.length; i++) {
              CodeMirror.Vim.handleKey(cm, command.toKeys[i], 'mapping');
            }
            return;
          } else if (command.type == 'exToEx') {
            this.processCommand(cm, command.toInput);
            return;
          }
        }
      }
      if (!commandName) {
        showConfirm(cm, `'${input}' isn't a command!`);
        return;
      }
      try {
        exCommands[commandName](cm, params);
        if ((!command || !command.possiblyAsync) && params.callback) {
          params.callback();
        }
      } catch(e) {
        showConfirm(cm, e);
        throw e;
      }
    }

    parseInput_(cm, inputStream, result) {
      inputStream.eatWhile(':');
      if (inputStream.eat('%')) {
        result.line = cm.firstLine();
        result.lineEnd = cm.lastLine();
      } else {
        result.line = this.parseLineSpec_(cm, inputStream);
        if (result.line !== undefined && inputStream.eat(',')) {
          result.lineEnd = this.parseLineSpec_(cm, inputStream);
        }
      }
      const commandMatch = inputStream.match(/^(\w+)/);
      if (commandMatch) {
        result.commandName = commandMatch[1];
      } else {
        result.commandName = inputStream.match(/.*/)[0];
      }

      return result;
    }

    parseLineSpec_(cm, inputStream) {
      const numberMatch = inputStream.match(/^(\d+)/);
      if (numberMatch) {
        return parseInt(numberMatch[1], 10) - 1;
      }
      switch (inputStream.next()) {
        case '.':
          return cm.getCursor().line;
        case '$':
          return cm.lastLine();
        case '\'':
          const mark = cm.state.vim.marks[inputStream.next()];
          if (mark && mark.find()) {
            return mark.find().line;
          }
          throw new Error('Mark not set');
        default:
          inputStream.backUp(1);
          return undefined;
      }
    }

    parseCommandArgs_(inputStream, params, command) {
      if (inputStream.eol()) {
        return;
      }
      params.argString = inputStream.match(/.*/)[0];
      const delim = command.argDelimiter || /\s+/;
      const args = trim(params.argString).split(delim);
      if (args.length && args[0]) {
        params.args = args;
      }
    }

    matchCommand_(commandName) {
      for (let i = commandName.length; i > 0; i--) {
        const prefix = commandName.substring(0, i);
        if (this.commandMap_[prefix]) {
          const command = this.commandMap_[prefix];
          if (command.name.indexOf(commandName) === 0) {
            return command;
          }
        }
      }
      return null;
    }

    buildCommandMap_() {
      this.commandMap_ = {};

      for (const command of defaultExCommandMap) {
        const key = command.shortName || command.name;
        this.commandMap_[key] = command;
      }
    }

    map(lhs, rhs, ctx) {
      if (lhs != ':' && lhs.charAt(0) == ':') {
        if (ctx) { throw Error('Mode not supported for ex mappings'); }
        const commandName = lhs.substring(1);
        if (rhs != ':' && rhs.charAt(0) == ':') {
          this.commandMap_[commandName] = {
            name: commandName,
            type: 'exToEx',
            toInput: rhs.substring(1),
            user: true
          };
        } else {
          this.commandMap_[commandName] = {
            name: commandName,
            type: 'exToKey',
            toKeys: rhs,
            user: true
          };
        }
      } else {
        if (rhs != ':' && rhs.charAt(0) == ':') {
          var mapping = {
            keys: lhs,
            type: 'keyToEx',
            exArgs: { input: rhs.substring(1) },
            user: true};
          if (ctx) { mapping.context = ctx; }
          defaultKeymap.unshift(mapping);
        } else {
          var mapping = {
            keys: lhs,
            type: 'keyToKey',
            toKeys: rhs,
            user: true
          };
          if (ctx) { mapping.context = ctx; }
          defaultKeymap.unshift(mapping);
        }
      }
    }

    unmap(lhs, ctx) {
      if (lhs != ':' && lhs.charAt(0) == ':') {
        if (ctx) { throw Error('Mode not supported for ex mappings'); }
        const commandName = lhs.substring(1);
        if (this.commandMap_[commandName] && this.commandMap_[commandName].user) {
          delete this.commandMap_[commandName];
          return;
        }
      } else {
        const keys = lhs;
        for (let i = 0; i < defaultKeymap.length; i++) {
          if (keys == defaultKeymap[i].keys
              && defaultKeymap[i].context === ctx
              && defaultKeymap[i].user) {
            defaultKeymap.splice(i, 1);
            return;
          }
        }
      }
    }
  }

  var exCommands = {
    colorscheme(cm, params) {
      if (!params.args || params.args.length < 1) {
        showConfirm(cm, cm.getOption('theme'));
        return;
      }
      cm.setOption('theme', params.args[0]);
    },
    map(cm, params, ctx) {
      const mapArgs = params.args;
      if (!mapArgs || mapArgs.length < 2) {
        if (cm) {
          showConfirm(cm, `Invalid mapping: ${params.input}`);
        }
        return;
      }
      exCommandDispatcher.map(mapArgs[0], mapArgs[1], ctx);
    },
    imap(cm, params) { this.map(cm, params, 'insert'); },
    nmap(cm, params) { this.map(cm, params, 'normal'); },
    vmap(cm, params) { this.map(cm, params, 'visual'); },
    unmap(cm, params, ctx) {
      const mapArgs = params.args;
      if (!mapArgs || mapArgs.length < 1) {
        if (cm) {
          showConfirm(cm, `No such mapping: ${params.input}`);
        }
        return;
      }
      exCommandDispatcher.unmap(mapArgs[0], ctx);
    },
    move(cm, params) {
      commandDispatcher.processCommand(cm, cm.state.vim, {
          type: 'motion',
          motion: 'moveToLineOrEdgeOfDocument',
          motionArgs: { forward: false, explicitRepeat: true,
            linewise: true },
          repeatOverride: params.line+1});
    },
    set(cm, params) {
      const setArgs = params.args;
      const setCfg = params.setCfg || {};
      if (!setArgs || setArgs.length < 1) {
        if (cm) {
          showConfirm(cm, `Invalid mapping: ${params.input}`);
        }
        return;
      }
      const expr = setArgs[0].split('=');
      let optionName = expr[0];
      let value = expr[1];
      let forceGet = false;

      if (optionName.charAt(optionName.length - 1) == '?') {
        if (value) { throw Error(`Trailing characters: ${params.argString}`); }
        optionName = optionName.substring(0, optionName.length - 1);
        forceGet = true;
      }
      if (value === undefined && optionName.substring(0, 2) == 'no') {
        optionName = optionName.substring(2);
        value = false;
      }

      const optionIsBoolean = options[optionName] && options[optionName].type == 'boolean';
      if (optionIsBoolean && value == undefined) {
        value = true;
      }
      if (!optionIsBoolean && value === undefined || forceGet) {
        const oldValue = getOption(optionName, cm, setCfg);
        if (oldValue === true || oldValue === false) {
          showConfirm(cm, ` ${oldValue ? '' : 'no'}${optionName}`);
        } else {
          showConfirm(cm, `  ${optionName}=${oldValue}`);
        }
      } else {
        setOption(optionName, value, cm, setCfg);
      }
    },
    setlocal(cm, params) {
      params.setCfg = {scope: 'local'};
      this.set(cm, params);
    },
    setglobal(cm, params) {
      params.setCfg = {scope: 'global'};
      this.set(cm, params);
    },
    registers(cm, params) {
      let regArgs = params.args;
      const registers = vimGlobalState.registerController.registers;
      let regInfo = '----------Registers----------<br><br>';
      if (!regArgs) {
        for (var registerName in registers) {
          const text = registers[registerName].toString();
          if (text.length) {
            regInfo += `"${registerName}    ${text}<br>`;
          }
        }
      } else {
        var registerName;
        regArgs = regArgs.join('');
        for (let i = 0; i < regArgs.length; i++) {
          registerName = regArgs.charAt(i);
          if (!vimGlobalState.registerController.isValidRegister(registerName)) {
            continue;
          }
          const register = registers[registerName] || new Register();
          regInfo += `"${registerName}    ${register.toString()}<br>`;
        }
      }
      showConfirm(cm, regInfo);
    },
    sort(cm, params) {
      let reverse;
      let ignoreCase;
      let unique;
      let number;
      function parseArgs() {
        if (params.argString) {
          const args = new CodeMirror.StringStream(params.argString);
          if (args.eat('!')) { reverse = true; }
          if (args.eol()) { return; }
          if (!args.eatSpace()) { return 'Invalid arguments'; }
          let opts = args.match(/[a-z]+/);
          if (opts) {
            opts = opts[0];
            ignoreCase = opts.includes('i');
            unique = opts.includes('u');
            const decimal = opts.includes('d') && 1;
            const hex = opts.includes('x') && 1;
            const octal = opts.includes('o') && 1;
            if (decimal + hex + octal > 1) { return 'Invalid arguments'; }
            number = decimal && 'decimal' || hex && 'hex' || octal && 'octal';
          }
          if (args.match(/\/.*\//)) { return 'patterns not supported'; }
        }
      }
      const err = parseArgs();
      if (err) {
        showConfirm(cm, `${err}: ${params.argString}`);
        return;
      }
      const lineStart = params.line || cm.firstLine();
      const lineEnd = params.lineEnd || params.line || cm.lastLine();
      if (lineStart == lineEnd) { return; }
      const curStart = Pos(lineStart, 0);
      const curEnd = Pos(lineEnd, lineLength(cm, lineEnd));
      let text = cm.getRange(curStart, curEnd).split('\n');
      const numberRegex = (number == 'decimal') ? /(-?)([\d]+)/ :
         (number == 'hex') ? /(-?)(?:0x)?([0-9a-f]+)/i :
         (number == 'octal') ? /([0-7]+)/ : null;
      const radix = (number == 'decimal') ? 10 : (number == 'hex') ? 16 : (number == 'octal') ? 8 : null;
      const numPart = [];
      let textPart = [];
      if (number) {
        for (var i = 0; i < text.length; i++) {
          if (numberRegex.exec(text[i])) {
            numPart.push(text[i]);
          } else {
            textPart.push(text[i]);
          }
        }
      } else {
        textPart = text;
      }
      function compareFn(a, b) {
        if (reverse) { let tmp; tmp = a; a = b; b = tmp; }
        if (ignoreCase) { a = a.toLowerCase(); b = b.toLowerCase(); }
        let anum = number && numberRegex.exec(a);
        let bnum = number && numberRegex.exec(b);
        if (!anum) { return a < b ? -1 : 1; }
        anum = parseInt((anum[1] + anum[2]).toLowerCase(), radix);
        bnum = parseInt((bnum[1] + bnum[2]).toLowerCase(), radix);
        return anum - bnum;
      }
      numPart.sort(compareFn);
      textPart.sort(compareFn);
      text = (!reverse) ? textPart.concat(numPart) : numPart.concat(textPart);
      if (unique) { // Remove duplicate lines
        const textOld = text;
        let lastLine;
        text = [];
        for (var i = 0; i < textOld.length; i++) {
          if (textOld[i] != lastLine) {
            text.push(textOld[i]);
          }
          lastLine = textOld[i];
        }
      }
      cm.replaceRange(text.join('\n'), curStart, curEnd);
    },
    global(cm, params) {
      const argString = params.argString;
      if (!argString) {
        showConfirm(cm, 'Regular Expression missing from global');
        return;
      }
      const lineStart = (params.line !== undefined) ? params.line : cm.firstLine();
      const lineEnd = params.lineEnd || params.line || cm.lastLine();
      const tokens = splitBySlash(argString);
      let regexPart = argString;
      let cmd;
      if (tokens.length) {
        regexPart = tokens[0];
        cmd = tokens.slice(1, tokens.length).join('/');
      }
      if (regexPart) {
        try {
         updateSearchQuery(cm, regexPart, true /** ignoreCase */,
           true /** smartCase */);
        } catch (e) {
         showConfirm(cm, `Invalid regex: ${regexPart}`);
         return;
        }
      }
      const query = getSearchState(cm).getQuery();
      const matchedLines = [];
      let content = '';
      for (let i = lineStart; i <= lineEnd; i++) {
        const matched = query.test(cm.getLine(i));
        if (matched) {
          matchedLines.push(i+1);
          content+= `${cm.getLine(i)}<br>`;
        }
      }
      if (!cmd) {
        showConfirm(cm, content);
        return;
      }
      let index = 0;
      const nextCommand = () => {
        if (index < matchedLines.length) {
          const command = matchedLines[index] + cmd;
          exCommandDispatcher.processCommand(cm, command, {
            callback: nextCommand
          });
        }
        index++;
      };
      nextCommand();
    },
    substitute(cm, params) {
      if (!cm.getSearchCursor) {
        throw new Error('Search feature not available. Requires searchcursor.js or ' +
            'any other getSearchCursor implementation.');
      }
      const argString = params.argString;
      const tokens = argString ? splitBySlash(argString) : [];
      let regexPart;
      let replacePart = '';
      let trailing;
      let flagsPart;
      let count;
      let confirm = false; // Whether to confirm each replace.
      let global = false; // True to replace all instances on a line, false to replace only 1.
      if (tokens.length) {
        regexPart = tokens[0];
        replacePart = tokens[1];
        if (replacePart !== undefined) {
          if (getOption('pcre')) {
            replacePart = unescapeRegexReplace(replacePart);
          } else {
            replacePart = translateRegexReplace(replacePart);
          }
          vimGlobalState.lastSubstituteReplacePart = replacePart;
        }
        trailing = tokens[2] ? tokens[2].split(' ') : [];
      } else {
        if (argString && argString.length) {
          showConfirm(cm, 'Substitutions should be of the form ' +
              ':s/pattern/replace/');
          return;
        }
      }
      if (trailing) {
        flagsPart = trailing[0];
        count = parseInt(trailing[1]);
        if (flagsPart) {
          if (flagsPart.includes('c')) {
            confirm = true;
            flagsPart.replace('c', '');
          }
          if (flagsPart.includes('g')) {
            global = true;
            flagsPart.replace('g', '');
          }
          regexPart = `${regexPart}/${flagsPart}`;
        }
      }
      if (regexPart) {
        try {
          updateSearchQuery(cm, regexPart, true /** ignoreCase */,
            true /** smartCase */);
        } catch (e) {
          showConfirm(cm, `Invalid regex: ${regexPart}`);
          return;
        }
      }
      replacePart = replacePart || vimGlobalState.lastSubstituteReplacePart;
      if (replacePart === undefined) {
        showConfirm(cm, 'No previous substitute regular expression');
        return;
      }
      const state = getSearchState(cm);
      const query = state.getQuery();
      let lineStart = (params.line !== undefined) ? params.line : cm.getCursor().line;
      let lineEnd = params.lineEnd || lineStart;
      if (lineStart == cm.firstLine() && lineEnd == cm.lastLine()) {
        lineEnd = Infinity;
      }
      if (count) {
        lineStart = lineEnd;
        lineEnd = lineStart + count - 1;
      }
      const startPos = clipCursorToContent(cm, Pos(lineStart, 0));
      const cursor = cm.getSearchCursor(query, startPos);
      doReplace(cm, confirm, global, lineStart, lineEnd, cursor, query, replacePart, params.callback);
    },
    redo: CodeMirror.commands.redo,
    undo: CodeMirror.commands.undo,
    write(cm) {
      if (CodeMirror.commands.save) {
        CodeMirror.commands.save(cm);
      } else {
        cm.save();
      }
    },
    nohlsearch(cm) {
      clearSearchHighlight(cm);
    },
    delmarks(cm, params) {
      if (!params.argString || !trim(params.argString)) {
        showConfirm(cm, 'Argument required');
        return;
      }

      const state = cm.state.vim;
      const stream = new CodeMirror.StringStream(trim(params.argString));
      while (!stream.eol()) {
        stream.eatSpace();
        const count = stream.pos;

        if (!stream.match(/[a-zA-Z]/, false)) {
          showConfirm(cm, `Invalid argument: ${params.argString.substring(count)}`);
          return;
        }

        const sym = stream.next();
        if (stream.match('-', true)) {
          if (!stream.match(/[a-zA-Z]/, false)) {
            showConfirm(cm, `Invalid argument: ${params.argString.substring(count)}`);
            return;
          }

          const startMark = sym;
          const finishMark = stream.next();
          if (isLowerCase(startMark) && isLowerCase(finishMark) ||
              isUpperCase(startMark) && isUpperCase(finishMark)) {
            const start = startMark.charCodeAt(0);
            const finish = finishMark.charCodeAt(0);
            if (start >= finish) {
              showConfirm(cm, `Invalid argument: ${params.argString.substring(count)}`);
              return;
            }
            for (let j = 0; j <= finish - start; j++) {
              const mark = String.fromCharCode(start + j);
              delete state.marks[mark];
            }
          } else {
            showConfirm(cm, `Invalid argument: ${startMark}-`);
            return;
          }
        } else {
          delete state.marks[sym];
        }
      }
    }
  };

  var exCommandDispatcher = new ExCommandDispatcher();
  function doReplace(cm, confirm, global, lineStart, lineEnd, searchCursor, query,
      replaceWith, callback) {
    cm.state.vim.exMode = true;
    let done = false;
    let lastPos = searchCursor.from();
    function replaceAll() {
      cm.operation(() => {
        while (!done) {
          replace();
          next();
        }
        stop();
      });
    }
    function replace() {
      const text = cm.getRange(searchCursor.from(), searchCursor.to());
      const newText = text.replace(query, replaceWith);
      searchCursor.replace(newText);
    }
    function next() {
      while(searchCursor.findNext() &&
            isInRange(searchCursor.from(), lineStart, lineEnd)) {
        if (!global && lastPos && searchCursor.from().line == lastPos.line) {
          continue;
        }
        cm.scrollIntoView(searchCursor.from(), 30);
        cm.setSelection(searchCursor.from(), searchCursor.to());
        lastPos = searchCursor.from();
        done = false;
        return;
      }
      done = true;
    }
    function stop(close) {
      if (close) { close(); }
      cm.focus();
      if (lastPos) {
        cm.setCursor(lastPos);
        const vim = cm.state.vim;
        vim.exMode = false;
        vim.lastHPos = vim.lastHSPos = lastPos.ch;
      }
      if (callback) { callback(); }
    }
    function onPromptKeyDown(e, _value, close) {
      CodeMirror.e_stop(e);
      const keyName = CodeMirror.keyName(e);
      switch (keyName) {
        case 'Y':
          replace(); next(); break;
        case 'N':
          next(); break;
        case 'A':
          const savedCallback = callback;
          callback = undefined;
          cm.operation(replaceAll);
          callback = savedCallback;
          break;
        case 'L':
          replace();
        case 'Q':
        case 'Esc':
        case 'Ctrl-C':
        case 'Ctrl-[':
          stop(close);
          break;
      }
      if (done) { stop(close); }
      return true;
    }
    next();
    if (done) {
      showConfirm(cm, `No matches for ${query.source}`);
      return;
    }
    if (!confirm) {
      replaceAll();
      if (callback) { callback(); }
      return;
    }
    showPrompt(cm, {
      prefix: `replace with <strong>${replaceWith}</strong> (y/n/a/q/l)`,
      onKeyDown: onPromptKeyDown
    });
  }

  CodeMirror.keyMap.vim = {
    attach: attachVimMap,
    detach: detachVimMap,
    call: cmKey
  };

  function exitInsertMode(cm) {
    const vim = cm.state.vim;
    const macroModeState = vimGlobalState.macroModeState;
    const insertModeChangeRegister = vimGlobalState.registerController.getRegister('.');
    const isPlaying = macroModeState.isPlaying;
    const lastChange = macroModeState.lastInsertModeChanges;
    var text = [];
    if (!isPlaying) {
      const selLength = lastChange.inVisualBlock ? vim.lastSelection.visualBlock.height : 1;
      const changes = lastChange.changes;
      var text = [];
      let i = 0;
      while (i < changes.length) {
        text.push(changes[i]);
        if (changes[i] instanceof InsertModeKey) {
           i++;
        } else {
           i+= selLength;
        }
      }
      lastChange.changes = text;
      cm.off('change', onChange);
      CodeMirror.off(cm.getInputField(), 'keydown', onKeyEventTargetKeyDown);
    }
    if (!isPlaying && vim.insertModeRepeat > 1) {
      repeatLastEdit(cm, vim, vim.insertModeRepeat - 1,
          true /** repeatForInsert */);
      vim.lastEditInputState.repeatOverride = vim.insertModeRepeat;
    }
    delete vim.insertModeRepeat;
    vim.insertMode = false;
    cm.setCursor(cm.getCursor().line, cm.getCursor().ch-1);
    cm.setOption('keyMap', 'vim');
    cm.setOption('disableInput', true);
    cm.toggleOverwrite(false); // exit replace mode if we were in it.
    insertModeChangeRegister.setText(lastChange.changes.join(''));
    CodeMirror.signal(cm, "vim-mode-change", {mode: "normal"});
    if (macroModeState.isRecording) {
      logInsertModeChange(macroModeState);
    }
  }

  function _mapCommand(command) {
    defaultKeymap.unshift(command);
  }

  function mapCommand(keys, type, name, args, extra) {
    const command = {keys, type};
    command[type] = name;
    command[`${type}Args`] = args;
    for (const key in extra)
      command[key] = extra[key];
    _mapCommand(command);
  }
  defineOption('insertModeEscKeysTimeout', 200, 'number');

  CodeMirror.keyMap['vim-insert'] = {
    'Ctrl-N': 'autocomplete',
    'Ctrl-P': 'autocomplete',
    'Enter'(cm) {
      const fn = CodeMirror.commands.newlineAndIndentContinueComment ||
          CodeMirror.commands.newlineAndIndent;
      fn(cm);
    },
    fallthrough: ['default'],
    attach: attachVimMap,
    detach: detachVimMap,
    call: cmKey
  };

  CodeMirror.keyMap['vim-replace'] = {
    'Backspace': 'goCharLeft',
    fallthrough: ['vim-insert'],
    attach: attachVimMap,
    detach: detachVimMap,
    call: cmKey
  };

  function executeMacroRegister(cm, vim, macroModeState, registerName) {
    const register = vimGlobalState.registerController.getRegister(registerName);
    if (registerName == ':') {
      if (register.keyBuffer[0]) {
        exCommandDispatcher.processCommand(cm, register.keyBuffer[0]);
      }
      macroModeState.isPlaying = false;
      return;
    }
    const keyBuffer = register.keyBuffer;
    let imc = 0;
    macroModeState.isPlaying = true;
    macroModeState.replaySearchQueries = register.searchQueries.slice(0);

    for (let text of keyBuffer) {
      let match;
      let key;
      while (text) {
        match = (/<\w+-.+?>|<\w+>|./).exec(text);
        key = match[0];
        text = text.substring(match.index + key.length);
        CodeMirror.Vim.handleKey(cm, key, 'macro');
        if (vim.insertMode) {
          const changes = register.insertModeChanges[imc++].changes;
          vimGlobalState.macroModeState.lastInsertModeChanges.changes =
              changes;
          repeatInsertModeChanges(cm, changes, 1);
          exitInsertMode(cm);
        }
      }
    }

    macroModeState.isPlaying = false;
  }

  function logKey(macroModeState, key) {
    if (macroModeState.isPlaying) { return; }
    const registerName = macroModeState.latestRegister;
    const register = vimGlobalState.registerController.getRegister(registerName);
    if (register) {
      register.pushText(key);
    }
  }

  function logInsertModeChange(macroModeState) {
    if (macroModeState.isPlaying) { return; }
    const registerName = macroModeState.latestRegister;
    const register = vimGlobalState.registerController.getRegister(registerName);
    if (register && register.pushInsertModeChanges) {
      register.pushInsertModeChanges(macroModeState.lastInsertModeChanges);
    }
  }

  function logSearchQuery(macroModeState, query) {
    if (macroModeState.isPlaying) { return; }
    const registerName = macroModeState.latestRegister;
    const register = vimGlobalState.registerController.getRegister(registerName);
    if (register && register.pushSearchQuery) {
      register.pushSearchQuery(query);
    }
  }
  function onChange(_cm, changeObj) {
    const macroModeState = vimGlobalState.macroModeState;
    const lastChange = macroModeState.lastInsertModeChanges;
    if (!macroModeState.isPlaying) {
      while(changeObj) {
        lastChange.expectCursorActivityForChange = true;
        if (changeObj.origin == '+input' || changeObj.origin == 'paste'
            || changeObj.origin === undefined /* only in testing */) {
          const text = changeObj.text.join('\n');
          if (lastChange.maybeReset) {
            lastChange.changes = [];
            lastChange.maybeReset = false;
          }
          lastChange.changes.push(text);
        }
        changeObj = changeObj.next;
      }
    }
  }
  function onCursorActivity(cm) {
    const vim = cm.state.vim;
    if (vim.insertMode) {
      const macroModeState = vimGlobalState.macroModeState;
      if (macroModeState.isPlaying) { return; }
      const lastChange = macroModeState.lastInsertModeChanges;
      if (lastChange.expectCursorActivityForChange) {
        lastChange.expectCursorActivityForChange = false;
      } else {
        lastChange.maybeReset = true;
      }
    } else if (!cm.curOp.isVimOp) {
      handleExternalSelection(cm, vim);
    }
    if (vim.visualMode) {
      updateFakeCursor(cm);
    }
  }
  function updateFakeCursor(cm) {
    const vim = cm.state.vim;
    const from = clipCursorToContent(cm, copyCursor(vim.sel.head));
    const to = offsetCursor(from, 0, 1);
    if (vim.fakeCursor) {
      vim.fakeCursor.clear();
    }
    vim.fakeCursor = cm.markText(from, to, {className: 'cm-animate-fat-cursor'});
  }
  function handleExternalSelection(cm, vim) {
    let anchor = cm.getCursor('anchor');
    let head = cm.getCursor('head');
    if (vim.visualMode && !cm.somethingSelected()) {
      exitVisualMode(cm, false);
    } else if (!vim.visualMode && !vim.insertMode && cm.somethingSelected()) {
      vim.visualMode = true;
      vim.visualLine = false;
      CodeMirror.signal(cm, "vim-mode-change", {mode: "visual"});
    }
    if (vim.visualMode) {
      const headOffset = !cursorIsBefore(head, anchor) ? -1 : 0;
      const anchorOffset = cursorIsBefore(head, anchor) ? -1 : 0;
      head = offsetCursor(head, 0, headOffset);
      anchor = offsetCursor(anchor, 0, anchorOffset);
      vim.sel = {
        anchor,
        head
      };
      updateMark(cm, vim, '<', cursorMin(head, anchor));
      updateMark(cm, vim, '>', cursorMax(head, anchor));
    } else if (!vim.insertMode) {
      vim.lastHPos = cm.getCursor().ch;
    }
  }
  function InsertModeKey(keyName) {
    this.keyName = keyName;
  }
  function onKeyEventTargetKeyDown(e) {
    const macroModeState = vimGlobalState.macroModeState;
    const lastChange = macroModeState.lastInsertModeChanges;
    const keyName = CodeMirror.keyName(e);
    if (!keyName) { return; }
    function onKeyFound() {
      if (lastChange.maybeReset) {
        lastChange.changes = [];
        lastChange.maybeReset = false;
      }
      lastChange.changes.push(new InsertModeKey(keyName));
      return true;
    }
    if (keyName.includes('Delete') || keyName.includes('Backspace')) {
      CodeMirror.lookupKey(keyName, 'vim-insert', onKeyFound);
    }
  }
  function repeatLastEdit(cm, vim, repeat, repeatForInsert) {
    const macroModeState = vimGlobalState.macroModeState;
    macroModeState.isPlaying = true;
    const isAction = !!vim.lastEditActionCommand;
    const cachedInputState = vim.inputState;
    function repeatCommand() {
      if (isAction) {
        commandDispatcher.processAction(cm, vim, vim.lastEditActionCommand);
      } else {
        commandDispatcher.evalInput(cm, vim);
      }
    }
    function repeatInsert(repeat) {
      if (macroModeState.lastInsertModeChanges.changes.length > 0) {
        repeat = !vim.lastEditActionCommand ? 1 : repeat;
        const changeObject = macroModeState.lastInsertModeChanges;
        repeatInsertModeChanges(cm, changeObject.changes, repeat);
      }
    }
    vim.inputState = vim.lastEditInputState;
    if (isAction && vim.lastEditActionCommand.interlaceInsertRepeat) {
      for (let i = 0; i < repeat; i++) {
        repeatCommand();
        repeatInsert(1);
      }
    } else {
      if (!repeatForInsert) {
        repeatCommand();
      }
      repeatInsert(repeat);
    }
    vim.inputState = cachedInputState;
    if (vim.insertMode && !repeatForInsert) {
      exitInsertMode(cm);
    }
    macroModeState.isPlaying = false;
  }

  function repeatInsertModeChanges(cm, changes, repeat) {
    function keyHandler(binding) {
      if (typeof binding == 'string') {
        CodeMirror.commands[binding](cm);
      } else {
        binding(cm);
      }
      return true;
    }
    const head = cm.getCursor('head');
    const inVisualBlock = vimGlobalState.macroModeState.lastInsertModeChanges.inVisualBlock;
    if (inVisualBlock) {
      const vim = cm.state.vim;
      const lastSel = vim.lastSelection;
      const offset = getOffset(lastSel.anchor, lastSel.head);
      selectForInsert(cm, head, offset.line + 1);
      repeat = cm.listSelections().length;
      cm.setCursor(head);
    }
    for (let i = 0; i < repeat; i++) {
      if (inVisualBlock) {
        cm.setCursor(offsetCursor(head, i, 0));
      }

      for (const change of changes) {
        if (change instanceof InsertModeKey) {
          CodeMirror.lookupKey(change.keyName, 'vim-insert', keyHandler);
        } else {
          const cur = cm.getCursor();
          cm.replaceRange(change, cur, cur);
        }
      }
    }
    if (inVisualBlock) {
      cm.setCursor(offsetCursor(head, 0, 1));
    }
  }

  resetVimGlobalState();
  CodeMirror.Vim = Vim();

  Vim = CodeMirror.Vim;

  const specialKey = {'return':'CR',backspace:'BS','delete':'Del',esc:'Esc',
    left:'Left',right:'Right',up:'Up',down:'Down',space: 'Space',
    home:'Home',end:'End',pageup:'PageUp',pagedown:'PageDown', enter: 'CR'
  };
  function lookupKey(hashId, key, e) {
    if (key.length > 1 && key[0] == "n") {
      key = key.replace("numpad", "");
    }
    key = specialKey[key] || key;
    let name = '';
    if (e.ctrlKey) { name += 'C-'; }
    if (e.altKey) { name += 'A-'; }
    if (e.shiftKey) { name += 'S-'; }

    name += key;
    if (name.length > 1) { name = `<${name}>`; }
    return name;
  }
  var handleKey = Vim.handleKey.bind(Vim);
  function cloneVimState(state) {
    const n = new state.constructor();
    Object.keys(state).forEach(key => {
      let o = state[key];
      if (Array.isArray(o))
        o = o.slice();
      else if (o && typeof o == "object" && o.constructor != Object)
        o = cloneVimState(o);
      n[key] = o;
    });
    if (state.sel) {
      n.sel = {
        head: state.sel.head && copyCursor(state.sel.head),
        anchor: state.sel.anchor && copyCursor(state.sel.anchor)
      };
    }
    return n;
  }
  function multiSelectHandleKey(cm, key, origin) {
    let isHandled = false;
    const vim = Vim.maybeInitVimState_(cm);
    const visualBlock = vim.visualBlock || vim.wasInVisualBlock;
    if (vim.wasInVisualBlock && !cm.ace.inMultiSelectMode) {
      vim.wasInVisualBlock = false;
    } else if (cm.ace.inMultiSelectMode && vim.visualBlock) {
       vim.wasInVisualBlock = true;
    }

    if (key == '<Esc>' && !vim.insertMode && !vim.visualMode && cm.ace.inMultiSelectMode) {
      cm.ace.exitMultiSelectMode();
    } else if (visualBlock || !cm.ace.inMultiSelectMode || cm.ace.inVirtualSelectionMode) {
      isHandled = Vim.handleKey(cm, key, origin);
    } else {
      const old = cloneVimState(vim);
      cm.operation(() => {
        cm.ace.forEachSelection(() => {
          const sel = cm.ace.selection;
          cm.state.vim.lastHPos = sel.$desiredColumn == null ? sel.lead.column : sel.$desiredColumn;
          let head = cm.getCursor("head");
          let anchor = cm.getCursor("anchor");
          const headOffset = !cursorIsBefore(head, anchor) ? -1 : 0;
          const anchorOffset = cursorIsBefore(head, anchor) ? -1 : 0;
          head = offsetCursor(head, 0, headOffset);
          anchor = offsetCursor(anchor, 0, anchorOffset);
          cm.state.vim.sel.head = head;
          cm.state.vim.sel.anchor = anchor;

          isHandled = handleKey(cm, key, origin);
          sel.$desiredColumn = cm.state.vim.lastHPos == -1 ? null : cm.state.vim.lastHPos;
          if (cm.virtualSelectionMode()) {
            cm.state.vim = cloneVimState(old);
          }
        });
        if (cm.curOp.cursorActivity && !isHandled)
          cm.curOp.cursorActivity = false;
      }, true);
    }
    return isHandled;
  }
  exports.CodeMirror = CodeMirror;
  const getVim = Vim.maybeInitVimState_;
  exports.handler = {
    $id: "ace/keyboard/vim",
    drawCursor(style, pixelPos, config, sel, session) {
      const vim = this.state.vim || {};
      const w = config.characterWidth;
      let h = config.lineHeight;
      let top = pixelPos.top;
      let left = pixelPos.left;
      if (!vim.insertMode) {
        const isbackwards = !sel.cursor
            ? session.selection.isBackwards() || session.selection.isEmpty()
            : Range.comparePoints(sel.cursor, sel.start) <= 0;
        if (!isbackwards && left > w)
          left -= w;
      }
      if (!vim.insertMode && vim.status) {
        h = h / 2;
        top += h;
      }
      style.left = `${left}px`;
      style.top =  `${top}px`;
      style.width = `${w}px`;
      style.height = `${h}px`;
    },
    handleKeyboard(data, hashId, key, keyCode, e) {
      const editor = data.editor;
      const cm = editor.state.cm;
      let vim = getVim(cm);
      if (keyCode == -1) return;

      if (key == "c" && hashId == 1) { // key == "ctrl-c"
        if (!useragent.isMac && editor.getCopyText()) {
          editor.once("copy", () => {
            editor.selection.clearSelection();
          });
          return {command: "null", passEvent: true};
        }
      } else if (!vim.insertMode) {
        if (useragent.isMac && this.handleMacRepeat(data, hashId, key)) {
          hashId = -1;
          key = data.inputChar;
        }
      }

      if (hashId == -1 || hashId & 1 || hashId === 0 && key.length > 1) {
        const insertMode = vim.insertMode;
        const name = lookupKey(hashId, key, e || {});
        if (vim.status == null)
          vim.status = "";
        const isHandled = multiSelectHandleKey(cm, name, 'user');
        vim = getVim(cm); // may be changed by multiSelectHandleKey
        if (isHandled && vim.status != null)
          vim.status += name;
        else if (vim.status == null)
          vim.status = "";
        cm._signal("changeStatus");
        if (!isHandled && (hashId != -1 || insertMode))
          return;
        return {command: "null", passEvent: !isHandled};
      }
    },
    attach(editor) {
      if (!editor.state) editor.state = {};
      const cm = new CodeMirror(editor);
      editor.state.cm = cm;
      editor.$vimModeHandler = this;
      CodeMirror.keyMap.vim.attach(cm);
      getVim(cm).status = null;
      cm.on('vim-command-done', () => {
        if (cm.virtualSelectionMode()) return;
        getVim(cm).status = null;
        cm.ace._signal("changeStatus");
        cm.ace.session.markUndoGroup();
      });
      cm.on("changeStatus", () => {
        cm.ace.renderer.updateCursor();
        cm.ace._signal("changeStatus");
      });
      cm.on("vim-mode-change", () => {
        if (cm.virtualSelectionMode()) return;
        cm.ace.renderer.setStyle("normal-mode", !getVim(cm).insertMode);
        cm._signal("changeStatus");
      });
      cm.ace.renderer.setStyle("normal-mode", !getVim(cm).insertMode);
      editor.renderer.$cursorLayer.drawCursor = this.drawCursor.bind(cm);
      this.updateMacCompositionHandlers(editor, true);
    },
    detach(editor) {
      const cm = editor.state.cm;
      CodeMirror.keyMap.vim.detach(cm);
      cm.destroy();
      editor.state.cm = null;
      editor.$vimModeHandler = null;
      editor.renderer.$cursorLayer.drawCursor = null;
      editor.renderer.setStyle("normal-mode", false);
      this.updateMacCompositionHandlers(editor, false);
    },
    getStatusText(editor) {
      const cm = editor.state.cm;
      const vim = getVim(cm);
      if (vim.insertMode)
        return "INSERT";
      let status = "";
      if (vim.visualMode) {
        status += "VISUAL";
        if (vim.visualLine)
          status += " LINE";
        if (vim.visualBlock)
          status += " BLOCK";
      }
      if (vim.status)
        status += (status ? " " : "") + vim.status;
      return status;
    },
    handleMacRepeat(data, hashId, key) {
      if (hashId == -1) {
        data.inputChar = key;
        data.lastEvent = "input";
      } else if (data.inputChar && data.$lastHash == hashId && data.$lastKey == key) {
        if (data.lastEvent == "input") {
          data.lastEvent = "input1";
        } else if (data.lastEvent == "input1") {
          return true;
        }
      } else {
        data.$lastHash = hashId;
        data.$lastKey = key;
        data.lastEvent = "keypress";
      }
    },
    updateMacCompositionHandlers(editor, enable) {
      const onCompositionUpdateOverride = function(text) {
        const cm = editor.state.cm;
        const vim = getVim(cm);
        if (!vim.insertMode) {
          const el = this.textInput.getElement();
          el.blur();
          el.focus();
          el.value = text;
        } else {
          this.onCompositionUpdateOrig(text);
        }
      };
      const onCompositionStartOverride = function(text) {
        const cm = editor.state.cm;
        const vim = getVim(cm);
        if (!vim.insertMode) {
          this.onCompositionStartOrig(text);
        }
      };
      if (enable) {
        if (!editor.onCompositionUpdateOrig) {
          editor.onCompositionUpdateOrig = editor.onCompositionUpdate;
          editor.onCompositionUpdate = onCompositionUpdateOverride;
          editor.onCompositionStartOrig = editor.onCompositionStart;
          editor.onCompositionStart = onCompositionStartOverride;
        }
      } else {
        if (editor.onCompositionUpdateOrig) {
          editor.onCompositionUpdate = editor.onCompositionUpdateOrig;
          editor.onCompositionUpdateOrig = null;
          editor.onCompositionStart = editor.onCompositionStartOrig;
          editor.onCompositionStartOrig = null;
        }
      }
    }
  };
  const renderVirtualNumbers = {
    getText(session, row) {
      return `${Math.abs(session.selection.lead.row - row)  || (row + 1 + (row < 9? "\xb7" : "" ))}`;
    },
    getWidth(session, lastLineNumber, config) {
      return session.getLength().toString().length * config.characterWidth;
    },
    update(e, editor) {
      editor.renderer.$loop.schedule(editor.renderer.CHANGE_GUTTER);
    },
    attach(editor) {
      editor.renderer.$gutterLayer.$renderer = this;
      editor.on("changeSelection", this.update);
    },
    detach(editor) {
      editor.renderer.$gutterLayer.$renderer = null;
      editor.off("changeSelection", this.update);
    }
  };
  Vim.defineOption({
    name: "wrap",
    set(value, cm) {
      if (cm) {cm.ace.setOption("wrap", value)}
    },
    type: "boolean"
  }, false);
  Vim.defineEx('write', 'w', (a, b) => {
    console.log(a, b)
    document.body.dispatchEvent(saveEv);
  });
  Vim.defineEx('!', '!', (a, b) => {
    console.log(a, b)
  });
  Vim.defineEx('WRITE', 'W', () => {
    document.body.dispatchEvent(saveEv);
  });
  defaultKeymap.push(
    { keys: 'zc', type: 'action', action: 'fold', actionArgs: { open: false } },
    { keys: 'zC', type: 'action', action: 'fold', actionArgs: { open: false, all: true } },
    { keys: 'zo', type: 'action', action: 'fold', actionArgs: { open: true } },
    { keys: 'zO', type: 'action', action: 'fold', actionArgs: { open: true, all: true } },
    { keys: 'za', type: 'action', action: 'fold', actionArgs: { toggle: true } },
    { keys: 'zA', type: 'action', action: 'fold', actionArgs: { toggle: true, all: true } },
    { keys: 'zf', type: 'action', action: 'fold', actionArgs: { open: true, all: true } },
    { keys: 'zd', type: 'action', action: 'fold', actionArgs: { open: true, all: true } },

    { keys: '<C-A-k>', type: 'action', action: 'aceCommand', actionArgs: { name: "addCursorAbove" } },
    { keys: '<C-A-j>', type: 'action', action: 'aceCommand', actionArgs: { name: "addCursorBelow" } },
    { keys: '<C-A-S-k>', type: 'action', action: 'aceCommand', actionArgs: { name: "addCursorAboveSkipCurrent" } },
    { keys: '<C-A-S-j>', type: 'action', action: 'aceCommand', actionArgs: { name: "addCursorBelowSkipCurrent" } },
    { keys: '<C-A-h>', type: 'action', action: 'aceCommand', actionArgs: { name: "selectMoreBefore" } },
    { keys: '<C-A-l>', type: 'action', action: 'aceCommand', actionArgs: { name: "selectMoreAfter" } },
    { keys: '<C-A-S-h>', type: 'action', action: 'aceCommand', actionArgs: { name: "selectNextBefore" } },
    { keys: '<C-A-S-l>', type: 'action', action: 'aceCommand', actionArgs: { name: "selectNextAfter" } }
  );
  actions.aceCommand = (cm, actionArgs, vim) => {
    cm.vimCmd = actionArgs;
    if (cm.ace.inVirtualSelectionMode)
      cm.ace.on("beforeEndOperation", delayedExecAceCommand);
    else
      delayedExecAceCommand(null, cm.ace);
  };
  function delayedExecAceCommand(op, ace) {
    ace.off("beforeEndOperation", delayedExecAceCommand);
    const cmd = ace.state.cm.vimCmd;
    if (cmd) {
      ace.execCommand(cmd.exec ? cmd : cmd.name, cmd.args);
    }
    ace.curOp = ace.prevOp;
  }
  actions.fold = (cm, actionArgs, vim) => {
    cm.ace.execCommand(['toggleFoldWidget', 'toggleFoldWidget', 'foldOther', 'unfoldall'
      ][(actionArgs.all ? 2 : 0) + (actionArgs.open ? 1 : 0)]);
  };

  exports.handler.defaultKeymap = defaultKeymap;
  exports.handler.actions = actions;
  exports.Vim = Vim;

  Vim.map("Y", "yy", "normal");
});
