"no use strict";
;((window => {
if (typeof window.window != "undefined" && window.document)
    return;
if (window.require && window.define)
    return;

if (!window.console) {
    window.console = function() {
        const msgs = Array.prototype.slice.call(arguments, 0);
        postMessage({type: "log", data: msgs});
    };
    window.console.error =
    window.console.warn = 
    window.console.log =
    window.console.trace = window.console;
}
window.window = window;
window.ace = window;

window.onerror = (message, file, line, col, err) => {
    postMessage({type: "error", data: {
        message,
        data: err.data,
        file,
        line, 
        col,
        stack: err.stack
    }});
};

window.normalizeModule = (parentId, moduleName) => {
    // normalize plugin requires
    if (moduleName.includes("!")) {
        const chunks = moduleName.split("!");
        return `${window.normalizeModule(parentId, chunks[0])}!${window.normalizeModule(parentId, chunks[1])}`;
    }
    // normalize relative requires
    if (moduleName.charAt(0) == ".") {
        const base = parentId.split("/").slice(0, -1).join("/");
        moduleName = (base ? base + "/" : "") + moduleName;
        
        while (moduleName.includes(".") && previous != moduleName) {
            var previous = moduleName;
            moduleName = moduleName.replace(/^\.\//, "").replace(/\/\.\//, "/").replace(/[^\/]+\/\.\.\//, "");
        }
    }
    
    return moduleName;
};

window.require = function require(parentId, id) {
    if (!id) {
        id = parentId;
        parentId = null;
    }
    if (!id.charAt)
        throw new Error("worker.js require() accepts only (parentId, id) as arguments");

    id = window.normalizeModule(parentId, id);

    const module = window.require.modules[id];
    if (module) {
        if (!module.initialized) {
            module.initialized = true;
            module.exports = module.factory().exports;
        }
        return module.exports;
    }
   
    if (!window.require.tlns)
        return console.log(`unable to load ${id}`);
    
    let path = resolveModuleId(id, window.require.tlns);
    if (path.slice(-3) != ".js") path += ".js";
    
    window.require.id = id;
    window.require.modules[id] = {}; // prevent infinite loop on broken modules
    importScripts(path);
    return window.require(parentId, id);
};
function resolveModuleId(id, paths) {
    let testPath = id;
    let tail = "";
    while (testPath) {
        const alias = paths[testPath];
        if (typeof alias == "string") {
            return alias + tail;
        } else if (alias) {
            return  alias.location.replace(/\/*$/, "/") + (tail || alias.main || alias.name);
        } else if (alias === false) {
            return "";
        }
        const i = testPath.lastIndexOf("/");
        if (i === -1) break;
        tail = testPath.substr(i) + tail;
        testPath = testPath.slice(0, i);
    }
    return id;
}
window.require.modules = {};
window.require.tlns = {};

window.define = function(id, deps, factory) {
    if (arguments.length == 2) {
        factory = deps;
        if (typeof id != "string") {
            deps = id;
            id = window.require.id;
        }
    } else if (arguments.length == 1) {
        factory = id;
        deps = [];
        id = window.require.id;
    }
    
    if (typeof factory != "function") {
        window.require.modules[id] = {
            exports: factory,
            initialized: true
        };
        return;
    }

    if (!deps.length)
        // If there is no dependencies, we inject "require", "exports" and
        // "module" as dependencies, to provide CommonJS compatibility.
        deps = ["require", "exports", "module"];

    const req = childId => window.require(id, childId);

    window.require.modules[id] = {
        exports: {},
        factory() {
            const module = this;
            const returnExports = factory.apply(this, deps.map(dep => {
                switch (dep) {
                    // Because "require", "exports" and "module" aren't actual
                    // dependencies, we must handle them seperately.
                    case "require": return req;
                    case "exports": return module.exports;
                    case "module":  return module;
                    // But for all other dependencies, we can just go ahead and
                    // require them.
                    default:        return req(dep);
                }
            }));
            if (returnExports)
                module.exports = returnExports;
            return module;
        }
    };
};
window.define.amd = {};
require.tlns = {};
window.initBaseUrls  = function initBaseUrls(topLevelNamespaces) {
    for (const i in topLevelNamespaces)
        require.tlns[i] = topLevelNamespaces[i];
};

window.initSender = function initSender() {

    const EventEmitter = window.require("ace/lib/event_emitter").EventEmitter;
    const oop = window.require("ace/lib/oop");
    
    const Sender = () => {};
    
    (function() {
        
        oop.implement(this, EventEmitter);
                
        this.callback = (data, callbackId) => {
            postMessage({
                type: "call",
                id: callbackId,
                data
            });
        };
    
        this.emit = (name, data) => {
            postMessage({
                type: "event",
                name,
                data
            });
        };
        
    }).call(Sender.prototype);
    
    return new Sender();
};

let main = window.main = null;
let sender = window.sender = null;

window.onmessage = e => {
    const msg = e.data;
    if (msg.event && sender) {
        sender._signal(msg.event, msg.data);
    }
    else if (msg.command) {
        if (main[msg.command])
            main[msg.command](...msg.args);
        else if (window[msg.command])
            window[msg.command](...msg.args);
        else
            throw new Error(`Unknown command:${msg.command}`);
    }
    else if (msg.init) {
        window.initBaseUrls(msg.tlns);
        require("ace/lib/es5-shim");
        sender = window.sender = window.initSender();
        const clazz = require(msg.module)[msg.classname];
        main = window.main = new clazz(sender);
    }
};
}))(this);

ace.define("ace/lib/oop",["require","exports","module"], (require, exports, module) => {
    exports.inherits = (ctor, superCtor) => {
        ctor.super_ = superCtor;
        ctor.prototype = Object.create(superCtor.prototype, {
            constructor: {
                value: ctor,
                enumerable: false,
                writable: true,
                configurable: true
            }
        });
    };

    exports.mixin = (obj, mixin) => {
        for (const key in mixin) {
            obj[key] = mixin[key];
        }
        return obj;
    };

    exports.implement = (proto, mixin) => {
        exports.mixin(proto, mixin);
    };
});

ace.define("ace/range",["require","exports","module"], (require, exports, module) => {
    const comparePoints = (p1, p2) => p1.row - p2.row || p1.column - p2.column;

    class Range {
        constructor(startRow, startColumn, endRow, endColumn) {
            this.start = {
                row: startRow,
                column: startColumn
            };

            this.end = {
                row: endRow,
                column: endColumn
            };
        }

        static fromPoints(start, end) {
            return new Range(start.row, start.column, end.row, end.column);
        }

        static comparePoints(p1, p2) {
            return p1.row - p2.row || p1.column - p2.column;
        }
    }

    (function() {
        this.isEqual = function(range) {
            return this.start.row === range.start.row &&
                this.end.row === range.end.row &&
                this.start.column === range.start.column &&
                this.end.column === range.end.column;
        };
        this.toString = function() {
            return (`Range: [${this.start.row}/${this.start.column}] -> [${this.end.row}/${this.end.column}]`);
        };

        this.contains = function(row, column) {
            return this.compare(row, column) == 0;
        };
        this.compareRange = function(range) {
            let cmp;
            const end = range.end;
            const start = range.start;

            cmp = this.compare(end.row, end.column);
            if (cmp == 1) {
                cmp = this.compare(start.row, start.column);
                if (cmp == 1) {
                    return 2;
                } else if (cmp == 0) {
                    return 1;
                } else {
                    return 0;
                }
            } else if (cmp == -1) {
                return -2;
            } else {
                cmp = this.compare(start.row, start.column);
                if (cmp == -1) {
                    return -1;
                } else if (cmp == 1) {
                    return 42;
                } else {
                    return 0;
                }
            }
        };
        this.comparePoint = function(p) {
            return this.compare(p.row, p.column);
        };
        this.containsRange = function(range) {
            return this.comparePoint(range.start) == 0 && this.comparePoint(range.end) == 0;
        };
        this.intersects = function(range) {
            const cmp = this.compareRange(range);
            return (cmp == -1 || cmp == 0 || cmp == 1);
        };
        this.isEnd = function(row, column) {
            return this.end.row == row && this.end.column == column;
        };
        this.isStart = function(row, column) {
            return this.start.row == row && this.start.column == column;
        };
        this.setStart = function(row, column) {
            if (typeof row == "object") {
                this.start.column = row.column;
                this.start.row = row.row;
            } else {
                this.start.row = row;
                this.start.column = column;
            }
        };
        this.setEnd = function(row, column) {
            if (typeof row == "object") {
                this.end.column = row.column;
                this.end.row = row.row;
            } else {
                this.end.row = row;
                this.end.column = column;
            }
        };
        this.inside = function(row, column) {
            if (this.compare(row, column) == 0) {
                if (this.isEnd(row, column) || this.isStart(row, column)) {
                    return false;
                } else {
                    return true;
                }
            }
            return false;
        };
        this.insideStart = function(row, column) {
            if (this.compare(row, column) == 0) {
                if (this.isEnd(row, column)) {
                    return false;
                } else {
                    return true;
                }
            }
            return false;
        };
        this.insideEnd = function(row, column) {
            if (this.compare(row, column) == 0) {
                if (this.isStart(row, column)) {
                    return false;
                } else {
                    return true;
                }
            }
            return false;
        };
        this.compare = function(row, column) {
            if (!this.isMultiLine()) {
                if (row === this.start.row) {
                    return column < this.start.column ? -1 : (column > this.end.column ? 1 : 0);
                }
            }

            if (row < this.start.row)
                return -1;

            if (row > this.end.row)
                return 1;

            if (this.start.row === row)
                return column >= this.start.column ? 0 : -1;

            if (this.end.row === row)
                return column <= this.end.column ? 0 : 1;

            return 0;
        };
        this.compareStart = function(row, column) {
            if (this.start.row == row && this.start.column == column) {
                return -1;
            } else {
                return this.compare(row, column);
            }
        };
        this.compareEnd = function(row, column) {
            if (this.end.row == row && this.end.column == column) {
                return 1;
            } else {
                return this.compare(row, column);
            }
        };
        this.compareInside = function(row, column) {
            if (this.end.row == row && this.end.column == column) {
                return 1;
            } else if (this.start.row == row && this.start.column == column) {
                return -1;
            } else {
                return this.compare(row, column);
            }
        };
        this.clipRows = function(firstRow, lastRow) {
            if (this.end.row > lastRow)
                var end = {row: lastRow + 1, column: 0};
            else if (this.end.row < firstRow)
                var end = {row: firstRow, column: 0};

            if (this.start.row > lastRow)
                var start = {row: lastRow + 1, column: 0};
            else if (this.start.row < firstRow)
                var start = {row: firstRow, column: 0};

            return Range.fromPoints(start || this.start, end || this.end);
        };
        this.extend = function(row, column) {
            const cmp = this.compare(row, column);

            if (cmp == 0)
                return this;
            else if (cmp == -1)
                const start = {row, column};
            else
                const end = {row, column};

            return Range.fromPoints(start || this.start, end || this.end);
        };

        this.isEmpty = function() {
            return (this.start.row === this.end.row && this.start.column === this.end.column);
        };
        this.isMultiLine = function() {
            return (this.start.row !== this.end.row);
        };
        this.clone = function() {
            return Range.fromPoints(this.start, this.end);
        };
        this.collapseRows = function() {
            if (this.end.column == 0)
                return new Range(this.start.row, 0, Math.max(this.start.row, this.end.row-1), 0)
            else
                return new Range(this.start.row, 0, this.end.row, 0)
        };
        this.toScreenRange = function(session) {
            const screenPosStart = session.documentToScreenPosition(this.start);
            const screenPosEnd = session.documentToScreenPosition(this.end);

            return new Range(
                screenPosStart.row, screenPosStart.column,
                screenPosEnd.row, screenPosEnd.column
            );
        };
        this.moveBy = function(row, column) {
            this.start.row += row;
            this.start.column += column;
            this.end.row += row;
            this.end.column += column;
        };

    }).call(Range.prototype);
    Range.comparePoints = comparePoints;


    exports.Range = Range;
});

ace.define("ace/apply_delta",["require","exports","module"], (require, exports, module) => {
    function throwDeltaError(delta, errorText){
        console.log("Invalid Delta:", delta);
        throw `Invalid Delta: ${errorText}`;
    }

    function positionInDocument(docLines, position) {
        return position.row    >= 0 && position.row    <  docLines.length &&
               position.column >= 0 && position.column <= docLines[position.row].length;
    }

    function validateDelta(docLines, delta) {
        if (delta.action != "insert" && delta.action != "remove")
            throwDeltaError(delta, "delta.action must be 'insert' or 'remove'");
        if (!(delta.lines instanceof Array))
            throwDeltaError(delta, "delta.lines must be an Array");
        if (!delta.start || !delta.end)
           throwDeltaError(delta, "delta.start/end must be an present");
        const start = delta.start;
        if (!positionInDocument(docLines, delta.start))
            throwDeltaError(delta, "delta.start must be contained in document");
        const end = delta.end;
        if (delta.action == "remove" && !positionInDocument(docLines, end))
            throwDeltaError(delta, "delta.end must contained in document for 'remove' actions");
        const numRangeRows = end.row - start.row;
        const numRangeLastLineChars = (end.column - (numRangeRows == 0 ? start.column : 0));
        if (numRangeRows != delta.lines.length - 1 || delta.lines[numRangeRows].length != numRangeLastLineChars)
            throwDeltaError(delta, "delta.range must match delta lines");
    }

    exports.applyDelta = (docLines, delta, doNotValidate) => {
        
        const row = delta.start.row;
        const startColumn = delta.start.column;
        const line = docLines[row] || "";
        switch (delta.action) {
            case "insert":
                const lines = delta.lines;
                if (lines.length === 1) {
                    docLines[row] = line.substring(0, startColumn) + delta.lines[0] + line.substring(startColumn);
                } else {
                    const args = [row, 1].concat(delta.lines);
                    docLines.splice(...args);
                    docLines[row] = line.substring(0, startColumn) + docLines[row];
                    docLines[row + delta.lines.length - 1] += line.substring(startColumn);
                }
                break;
            case "remove":
                const endColumn = delta.end.column;
                const endRow = delta.end.row;
                if (row === endRow) {
                    docLines[row] = line.substring(0, startColumn) + line.substring(endColumn);
                } else {
                    docLines.splice(
                        row, endRow - row + 1,
                        line.substring(0, startColumn) + docLines[endRow].substring(endColumn)
                    );
                }
                break;
        }
    }
});

ace.define("ace/lib/event_emitter",["require","exports","module"], (require, exports, module) => {
    const EventEmitter = {};
    const stopPropagation = function() { this.propagationStopped = true; };
    const preventDefault = function() { this.defaultPrevented = true; };

    EventEmitter._emit =
    EventEmitter._dispatchEvent = function(eventName, e) {
        this._eventRegistry || (this._eventRegistry = {});
        this._defaultHandlers || (this._defaultHandlers = {});

        let listeners = this._eventRegistry[eventName] || [];
        const defaultHandler = this._defaultHandlers[eventName];
        if (!listeners.length && !defaultHandler)
            return;

        if (typeof e != "object" || !e)
            e = {};

        if (!e.type)
            e.type = eventName;
        if (!e.stopPropagation)
            e.stopPropagation = stopPropagation;
        if (!e.preventDefault)
            e.preventDefault = preventDefault;

        listeners = listeners.slice();
        for (let i=0; i<listeners.length; i++) {
            listeners[i](e, this);
            if (e.propagationStopped)
                break;
        }
        
        if (defaultHandler && !e.defaultPrevented)
            return defaultHandler(e, this);
    };


    EventEmitter._signal = function(eventName, e) {
        let listeners = (this._eventRegistry || {})[eventName];
        if (!listeners)
            return;
        listeners = listeners.slice();
        for (let i=0; i<listeners.length; i++)
            listeners[i](e, this);
    };

    EventEmitter.once = function(eventName, callback) {
        const _self = this;
        callback && this.addEventListener(eventName, function newCallback() {
            _self.removeEventListener(eventName, newCallback);
            callback(...arguments);
        });
    };


    EventEmitter.setDefaultHandler = function(eventName, callback) {
        let handlers = this._defaultHandlers;
        if (!handlers)
            handlers = this._defaultHandlers = {_disabled_: {}};
        
        if (handlers[eventName]) {
            const old = handlers[eventName];
            let disabled = handlers._disabled_[eventName];
            if (!disabled)
                handlers._disabled_[eventName] = disabled = [];
            disabled.push(old);
            const i = disabled.indexOf(callback);
            if (i != -1) 
                disabled.splice(i, 1);
        }
        handlers[eventName] = callback;
    };
    EventEmitter.removeDefaultHandler = function(eventName, callback) {
        const handlers = this._defaultHandlers;
        if (!handlers)
            return;
        const disabled = handlers._disabled_[eventName];
        
        if (handlers[eventName] == callback) {
            const old = handlers[eventName];
            if (disabled)
                this.setDefaultHandler(eventName, disabled.pop());
        } else if (disabled) {
            const i = disabled.indexOf(callback);
            if (i != -1)
                disabled.splice(i, 1);
        }
    };

    EventEmitter.on =
    EventEmitter.addEventListener = function(eventName, callback, capturing) {
        this._eventRegistry = this._eventRegistry || {};

        let listeners = this._eventRegistry[eventName];
        if (!listeners)
            listeners = this._eventRegistry[eventName] = [];

        if (!listeners.includes(callback))
            listeners[capturing ? "unshift" : "push"](callback);
        return callback;
    };

    EventEmitter.off =
    EventEmitter.removeListener =
    EventEmitter.removeEventListener = function(eventName, callback) {
        this._eventRegistry = this._eventRegistry || {};

        const listeners = this._eventRegistry[eventName];
        if (!listeners)
            return;

        const index = listeners.indexOf(callback);
        if (index !== -1)
            listeners.splice(index, 1);
    };

    EventEmitter.removeAllListeners = function(eventName) {
        if (this._eventRegistry) this._eventRegistry[eventName] = [];
    };

    exports.EventEmitter = EventEmitter;
});

ace.define("ace/anchor",["require","exports","module","ace/lib/oop","ace/lib/event_emitter"], (require, exports, module) => {
    const oop = require("./lib/oop");
    const EventEmitter = require("./lib/event_emitter").EventEmitter;

    const Anchor = exports.Anchor = function(doc, row, column) {
        this.$onChange = this.onChange.bind(this);
        this.attach(doc);
        
        if (typeof column == "undefined")
            this.setPosition(row.row, row.column);
        else
            this.setPosition(row, column);
    };

    (function() {

        oop.implement(this, EventEmitter);
        this.getPosition = function() {
            return this.$clipPositionToDocument(this.row, this.column);
        };
        this.getDocument = function() {
            return this.document;
        };
        this.$insertRight = false;
        this.onChange = function(delta) {
            if (delta.start.row == delta.end.row && delta.start.row != this.row)
                return;

            if (delta.start.row > this.row)
                return;
                
            const point = $getTransformedPoint(delta, {row: this.row, column: this.column}, this.$insertRight);
            this.setPosition(point.row, point.column, true);
        };
        
        function $pointsInOrder(point1, point2, equalPointsInOrder) {
            const bColIsAfter = equalPointsInOrder ? point1.column <= point2.column : point1.column < point2.column;
            return (point1.row < point2.row) || (point1.row == point2.row && bColIsAfter);
        }
                
        function $getTransformedPoint(delta, point, moveIfEqual) {
            const deltaIsInsert = delta.action == "insert";
            const deltaRowShift = (deltaIsInsert ? 1 : -1) * (delta.end.row    - delta.start.row);
            const deltaColShift = (deltaIsInsert ? 1 : -1) * (delta.end.column - delta.start.column);
            const deltaStart = delta.start;
            const deltaEnd = deltaIsInsert ? deltaStart : delta.end; // Collapse insert range.
            if ($pointsInOrder(point, deltaStart, moveIfEqual)) {
                return {
                    row: point.row,
                    column: point.column
                };
            }
            if ($pointsInOrder(deltaEnd, point, !moveIfEqual)) {
                return {
                    row: point.row + deltaRowShift,
                    column: point.column + (point.row == deltaEnd.row ? deltaColShift : 0)
                };
            }
            
            return {
                row: deltaStart.row,
                column: deltaStart.column
            };
        }
        this.setPosition = function(row, column, noClip) {
            let pos;
            if (noClip) {
                pos = {
                    row,
                    column
                };
            } else {
                pos = this.$clipPositionToDocument(row, column);
            }

            if (this.row == pos.row && this.column == pos.column)
                return;

            const old = {
                row: this.row,
                column: this.column
            };

            this.row = pos.row;
            this.column = pos.column;
            this._signal("change", {
                old,
                value: pos
            });
        };
        this.detach = function() {
            this.document.removeEventListener("change", this.$onChange);
        };
        this.attach = function(doc) {
            this.document = doc || this.document;
            this.document.on("change", this.$onChange);
        };
        this.$clipPositionToDocument = function(row, column) {
            const pos = {};

            if (row >= this.document.getLength()) {
                pos.row = Math.max(0, this.document.getLength() - 1);
                pos.column = this.document.getLine(pos.row).length;
            }
            else if (row < 0) {
                pos.row = 0;
                pos.column = 0;
            }
            else {
                pos.row = row;
                pos.column = Math.min(this.document.getLine(pos.row).length, Math.max(0, column));
            }

            if (column < 0)
                pos.column = 0;

            return pos;
        };

    }).call(Anchor.prototype);
});

ace.define("ace/document",["require","exports","module","ace/lib/oop","ace/apply_delta","ace/lib/event_emitter","ace/range","ace/anchor"], (require, exports, module) => {
    const oop = require("./lib/oop");
    const applyDelta = require("./apply_delta").applyDelta;
    const EventEmitter = require("./lib/event_emitter").EventEmitter;
    const Range = require("./range").Range;
    const Anchor = require("./anchor").Anchor;

    const Document = function(textOrLines) {
        this.$lines = [""];
        if (textOrLines.length === 0) {
            this.$lines = [""];
        } else if (Array.isArray(textOrLines)) {
            this.insertMergedLines({row: 0, column: 0}, textOrLines);
        } else {
            this.insert({row: 0, column:0}, textOrLines);
        }
    };

    (function() {

        oop.implement(this, EventEmitter);
        this.setValue = function(text) {
            const len = this.getLength() - 1;
            this.remove(new Range(0, 0, len, this.getLine(len).length));
            this.insert({row: 0, column: 0}, text);
        };
        this.getValue = function() {
            return this.getAllLines().join(this.getNewLineCharacter());
        };
        this.createAnchor = function(row, column) {
            return new Anchor(this, row, column);
        };
        if ("aaa".split(/a/).length === 0) {
            this.$split = text => text.replace(/\r\n|\r/g, "\n").split("\n");
        } else {
            this.$split = text => text.split(/\r\n|\r|\n/);
        }


        this.$detectNewLine = function(text) {
            const match = text.match(/^.*?(\r\n|\r|\n)/m);
            this.$autoNewLine = match ? match[1] : "\n";
            this._signal("changeNewLineMode");
        };
        this.getNewLineCharacter = function() {
            switch (this.$newLineMode) {
              case "windows":
                return "\r\n";
              case "unix":
                return "\n";
              default:
                return this.$autoNewLine || "\n";
            }
        };

        this.$autoNewLine = "";
        this.$newLineMode = "auto";
        this.setNewLineMode = function(newLineMode) {
            if (this.$newLineMode === newLineMode)
                return;

            this.$newLineMode = newLineMode;
            this._signal("changeNewLineMode");
        };
        this.getNewLineMode = function() {
            return this.$newLineMode;
        };
        this.isNewLine = text => text == "\r\n" || text == "\r" || text == "\n";
        this.getLine = function(row) {
            return this.$lines[row] || "";
        };
        this.getLines = function(firstRow, lastRow) {
            return this.$lines.slice(firstRow, lastRow + 1);
        };
        this.getAllLines = function() {
            return this.getLines(0, this.getLength());
        };
        this.getLength = function() {
            return this.$lines.length;
        };
        this.getTextRange = function(range) {
            return this.getLinesForRange(range).join(this.getNewLineCharacter());
        };
        this.getLinesForRange = function(range) {
            let lines;
            if (range.start.row === range.end.row) {
                lines = [this.getLine(range.start.row).substring(range.start.column, range.end.column)];
            } else {
                lines = this.getLines(range.start.row, range.end.row);
                lines[0] = (lines[0] || "").substring(range.start.column);
                const l = lines.length - 1;
                if (range.end.row - range.start.row == l)
                    lines[l] = lines[l].substring(0, range.end.column);
            }
            return lines;
        };
        this.insertLines = function(row, lines) {
            console.warn("Use of document.insertLines is deprecated. Use the insertFullLines method instead.");
            return this.insertFullLines(row, lines);
        };
        this.removeLines = function(firstRow, lastRow) {
            console.warn("Use of document.removeLines is deprecated. Use the removeFullLines method instead.");
            return this.removeFullLines(firstRow, lastRow);
        };
        this.insertNewLine = function(position) {
            console.warn("Use of document.insertNewLine is deprecated. Use insertMergedLines(position, ['', '']) instead.");
            return this.insertMergedLines(position, ["", ""]);
        };
        this.insert = function(position, text) {
            if (this.getLength() <= 1)
                this.$detectNewLine(text);
            
            return this.insertMergedLines(position, this.$split(text));
        };
        this.insertInLine = function(position, text) {
            const start = this.clippedPos(position.row, position.column);
            const end = this.pos(position.row, position.column + text.length);
            
            this.applyDelta({
                start,
                end,
                action: "insert",
                lines: [text]
            }, true);
            
            return this.clonePos(end);
        };
        
        this.clippedPos = function(row, column) {
            const length = this.getLength();
            if (row === undefined) {
                row = length;
            } else if (row < 0) {
                row = 0;
            } else if (row >= length) {
                row = length - 1;
                column = undefined;
            }
            const line = this.getLine(row);
            if (column == undefined)
                column = line.length;
            column = Math.min(Math.max(column, 0), line.length);
            return {row, column};
        };
        
        this.clonePos = pos => ({
            row: pos.row,
            column: pos.column
        });
        
        this.pos = (row, column) => ({
            row,
            column
        });
        
        this.$clipPosition = function(position) {
            const length = this.getLength();
            if (position.row >= length) {
                position.row = Math.max(0, length - 1);
                position.column = this.getLine(length - 1).length;
            } else {
                position.row = Math.max(0, position.row);
                position.column = Math.min(Math.max(position.column, 0), this.getLine(position.row).length);
            }
            return position;
        };
        this.insertFullLines = function(row, lines) {
            row = Math.min(Math.max(row, 0), this.getLength());
            let column = 0;
            if (row < this.getLength()) {
                lines = lines.concat([""]);
                column = 0;
            } else {
                lines = [""].concat(lines);
                row--;
                column = this.$lines[row].length;
            }
            this.insertMergedLines({row, column}, lines);
        };    
        this.insertMergedLines = function(position, lines) {
            const start = this.clippedPos(position.row, position.column);
            const end = {
                row: start.row + lines.length - 1,
                column: (lines.length == 1 ? start.column : 0) + lines[lines.length - 1].length
            };
            
            this.applyDelta({
                start,
                end,
                action: "insert",
                lines
            });
            
            return this.clonePos(end);
        };
        this.remove = function(range) {
            const start = this.clippedPos(range.start.row, range.start.column);
            const end = this.clippedPos(range.end.row, range.end.column);
            this.applyDelta({
                start,
                end,
                action: "remove",
                lines: this.getLinesForRange({start, end})
            });
            return this.clonePos(start);
        };
        this.removeInLine = function(row, startColumn, endColumn) {
            const start = this.clippedPos(row, startColumn);
            const end = this.clippedPos(row, endColumn);
            
            this.applyDelta({
                start,
                end,
                action: "remove",
                lines: this.getLinesForRange({start, end})
            }, true);
            
            return this.clonePos(start);
        };
        this.removeFullLines = function(firstRow, lastRow) {
            firstRow = Math.min(Math.max(0, firstRow), this.getLength() - 1);
            lastRow  = Math.min(Math.max(0, lastRow ), this.getLength() - 1);
            const deleteFirstNewLine = lastRow == this.getLength() - 1 && firstRow > 0;
            const deleteLastNewLine  = lastRow  < this.getLength() - 1;
            const startRow = ( deleteFirstNewLine ? firstRow - 1                  : firstRow                    );
            const startCol = ( deleteFirstNewLine ? this.getLine(startRow).length : 0                           );
            const endRow   = ( deleteLastNewLine  ? lastRow + 1                   : lastRow                     );
            const endCol   = ( deleteLastNewLine  ? 0                             : this.getLine(endRow).length ); 
            const range = new Range(startRow, startCol, endRow, endCol);
            const deletedLines = this.$lines.slice(firstRow, lastRow + 1);
            
            this.applyDelta({
                start: range.start,
                end: range.end,
                action: "remove",
                lines: this.getLinesForRange(range)
            });
            return deletedLines;
        };
        this.removeNewLine = function(row) {
            if (row < this.getLength() - 1 && row >= 0) {
                this.applyDelta({
                    start: this.pos(row, this.getLine(row).length),
                    end: this.pos(row + 1, 0),
                    action: "remove",
                    lines: ["", ""]
                });
            }
        };
        this.replace = function(range, text) {
            if (!(range instanceof Range))
                range = Range.fromPoints(range.start, range.end);
            if (text.length === 0 && range.isEmpty())
                return range.start;
            if (text == this.getTextRange(range))
                return range.end;

            this.remove(range);
            let end;
            if (text) {
                end = this.insert(range.start, text);
            }
            else {
                end = range.start;
            }
            
            return end;
        };
        this.applyDeltas = function(deltas) {
            for (let i=0; i<deltas.length; i++) {
                this.applyDelta(deltas[i]);
            }
        };
        this.revertDeltas = function(deltas) {
            for (let i=deltas.length-1; i>=0; i--) {
                this.revertDelta(deltas[i]);
            }
        };
        this.applyDelta = function(delta, doNotValidate) {
            const isInsert = delta.action == "insert";
            if (isInsert ? delta.lines.length <= 1 && !delta.lines[0]
                : !Range.comparePoints(delta.start, delta.end)) {
                return;
            }
            
            if (isInsert && delta.lines.length > 20000)
                this.$splitAndapplyLargeDelta(delta, 20000);
            applyDelta(this.$lines, delta, doNotValidate);
            this._signal("change", delta);
        };
        
        this.$splitAndapplyLargeDelta = function(delta, MAX) {
            const lines = delta.lines;
            const l = lines.length;
            const row = delta.start.row;
            let column = delta.start.column;
            let from = 0;
            let to = 0;
            do {
                from = to;
                to += MAX - 1;
                const chunk = lines.slice(from, to);
                if (to > l) {
                    delta.lines = chunk;
                    delta.start.row = row + from;
                    delta.start.column = column;
                    break;
                }
                chunk.push("");
                this.applyDelta({
                    start: this.pos(row + from, column),
                    end: this.pos(row + to, column = 0),
                    action: delta.action,
                    lines: chunk
                }, true);
            } while(true);
        };
        this.revertDelta = function(delta) {
            this.applyDelta({
                start: this.clonePos(delta.start),
                end: this.clonePos(delta.end),
                action: (delta.action == "insert" ? "remove" : "insert"),
                lines: delta.lines.slice()
            });
        };
        this.indexToPosition = function(index, startRow) {
            const lines = this.$lines || this.getAllLines();
            const newlineLength = this.getNewLineCharacter().length;
            for (var i = startRow || 0, l = lines.length; i < l; i++) {
                index -= lines[i].length + newlineLength;
                if (index < 0)
                    return {row: i, column: index + lines[i].length + newlineLength};
            }
            return {row: l-1, column: lines[l-1].length};
        };
        this.positionToIndex = function(pos, startRow) {
            const lines = this.$lines || this.getAllLines();
            const newlineLength = this.getNewLineCharacter().length;
            let index = 0;
            const row = Math.min(pos.row, lines.length);
            for (let i = startRow || 0; i < row; ++i)
                index += lines[i].length + newlineLength;

            return index + pos.column;
        };

    }).call(Document.prototype);

    exports.Document = Document;
});

ace.define("ace/lib/lang",["require","exports","module"], (require, exports, module) => {
    exports.last = a => a[a.length - 1];

    exports.stringReverse = string => string.split("").reverse().join("");

    exports.stringRepeat = (string, count) => {
        let result = '';
        while (count > 0) {
            if (count & 1)
                result += string;

            if (count >>= 1)
                string += string;
        }
        return result;
    };

    const trimBeginRegexp = /^\s\s*/;
    const trimEndRegexp = /\s\s*$/;

    exports.stringTrimLeft = string => string.replace(trimBeginRegexp, '');

    exports.stringTrimRight = string => string.replace(trimEndRegexp, '');

    exports.copyObject = obj => {
        const copy = {};
        for (const key in obj) {
            copy[key] = obj[key];
        }
        return copy;
    };

    exports.copyArray = function(array){
        const copy = [];
        for (let i=0, l=array.length; i<l; i++) {
            if (array[i] && typeof array[i] == "object")
                copy[i] = this.copyObject(array[i]);
            else 
                copy[i] = array[i];
        }
        return copy;
    };

    exports.deepCopy = function deepCopy(obj) {
        if (typeof obj !== "object" || !obj)
            return obj;
        let copy;
        if (Array.isArray(obj)) {
            copy = [];
            for (var key = 0; key < obj.length; key++) {
                copy[key] = deepCopy(obj[key]);
            }
            return copy;
        }
        if (Object.prototype.toString.call(obj) !== "[object Object]")
            return obj;
        
        copy = {};
        for (var key in obj)
            copy[key] = deepCopy(obj[key]);
        return copy;
    };

    exports.arrayToMap = arr => {
        const map = {};
        for (let i=0; i<arr.length; i++) {
            map[arr[i]] = 1;
        }
        return map;

    };

    exports.createMap = props => {
        const map = Object.create(null);
        for (const i in props) {
            map[i] = props[i];
        }
        return map;
    };
    exports.arrayRemove = (array, value) => {
      for (let i = 0; i <= array.length; i++) {
        if (value === array[i]) {
          array.splice(i, 1);
        }
      }
    };

    exports.escapeRegExp = str => str.replace(/([.*+?^${}()|[\]\/\\])/g, '\\$1');

    exports.escapeHTML = str => str.replace(/&/g, "&#38;").replace(/"/g, "&#34;").replace(/'/g, "&#39;").replace(/</g, "&#60;");

    exports.getMatchOffsets = (string, regExp) => {
        const matches = [];

        string.replace(regExp, function(str) {
            matches.push({
                offset: arguments[arguments.length-2],
                length: str.length
            });
        });

        return matches;
    };
    exports.deferredCall = fcn => {
        let timer = null;
        const callback = () => {
            timer = null;
            fcn();
        };

        class deferred {
            constructor(timeout) {
                deferred.cancel();
                timer = setTimeout(callback, timeout || 0);
                return deferred;
            }

            static call() {
                this.cancel();
                fcn();
                return deferred;
            }

            static cancel() {
                clearTimeout(timer);
                timer = null;
                return deferred;
            }

            static isPending() {
                return timer;
            }
        }

        deferred.schedule = deferred;

        return deferred;
    };


    exports.delayedCall = (fcn, defaultTimeout) => {
        let timer = null;
        const callback = () => {
            timer = null;
            fcn();
        };

        class _self {
            constructor(timeout) {
                if (timer == null)
                    timer = setTimeout(callback, timeout || defaultTimeout);
            }

            static delay(timeout) {
                timer && clearTimeout(timer);
                timer = setTimeout(callback, timeout || defaultTimeout);
            }

            static call() {
                this.cancel();
                fcn();
            }

            static cancel() {
                timer && clearTimeout(timer);
                timer = null;
            }

            static isPending() {
                return timer;
            }
        }

        _self.schedule = _self;

        return _self;
    };
});

ace.define("ace/worker/mirror",["require","exports","module","ace/range","ace/document","ace/lib/lang"], (require, exports, module) => {
    const Range = require("../range").Range;
    const Document = require("../document").Document;
    const lang = require("../lib/lang");

    const Mirror = exports.Mirror = function(sender) {
        this.sender = sender;
        const doc = this.doc = new Document("");
        
        const deferredUpdate = this.deferredUpdate = lang.delayedCall(this.onUpdate.bind(this));
        
        const _self = this;
        sender.on("change", e => {
            const data = e.data;
            if (data[0].start) {
                doc.applyDeltas(data);
            } else {
                for (let i = 0; i < data.length; i += 2) {
                    if (Array.isArray(data[i+1])) {
                        var d = {action: "insert", start: data[i], lines: data[i+1]};
                    } else {
                        var d = {action: "remove", start: data[i], end: data[i+1]};
                    }
                    doc.applyDelta(d, true);
                }
            }
            if (_self.$timeout)
                return deferredUpdate.schedule(_self.$timeout);
            _self.onUpdate();
        });
    };

    (function() {
        
        this.$timeout = 500;
        
        this.setTimeout = function(timeout) {
            this.$timeout = timeout;
        };
        
        this.setValue = function(value) {
            this.doc.setValue(value);
            this.deferredUpdate.schedule(this.$timeout);
        };
        
        this.getValue = function(callbackId) {
            this.sender.callback(this.doc.getValue(), callbackId);
        };
        
        this.onUpdate = () => {
        };
        
        this.isPending = function() {
            return this.deferredUpdate.isPending();
        };
        
    }).call(Mirror.prototype);
});

ace.define("ace/mode/lua/luaparse",["require","exports","module"], function(require, exports, module) {

(((root, name, factory) => {
   factory(exports)
})(this, 'luaparse', exports => {
    exports.version = '0.1.4';

    let input;
    let options;
    let length;
    const defaultOptions = exports.defaultOptions = {
        wait: false
      , comments: true
      , scope: false
      , locations: false
      , ranges: false
    };

    const EOF = 1;
    const StringLiteral = 2;
    const Keyword = 4;
    const Identifier = 8;
    const NumericLiteral = 16;
    const Punctuator = 32;
    const BooleanLiteral = 64;
    const NilLiteral = 128;
    const VarargLiteral = 256;

    exports.tokenTypes = { EOF, StringLiteral
      , Keyword, Identifier, NumericLiteral
      , Punctuator, BooleanLiteral
      , NilLiteral, VarargLiteral
    };

    const errors = exports.errors = {
        unexpected: 'Unexpected %1 \'%2\' near \'%3\''
      , expected: '\'%1\' expected near \'%2\''
      , expectedToken: '%1 expected near \'%2\''
      , unfinishedString: 'unfinished string near \'%1\''
      , malformedNumber: 'malformed number near \'%1\''
    };

    const ast = exports.ast = {
        labelStatement(label) {
        return {
            type: 'LabelStatement'
          , label
        };
      }

      , breakStatement() {
        return {
            type: 'BreakStatement'
        };
      }

      , gotoStatement(label) {
        return {
            type: 'GotoStatement'
          , label
        };
      }

      , returnStatement(args) {
        return {
            type: 'ReturnStatement'
          , 'arguments': args
        };
      }

      , ifStatement(clauses) {
        return {
            type: 'IfStatement'
          , clauses
        };
      }
      , ifClause(condition, body) {
        return {
            type: 'IfClause'
          , condition
          , body
        };
      }
      , elseifClause(condition, body) {
        return {
            type: 'ElseifClause'
          , condition
          , body
        };
      }
      , elseClause(body) {
        return {
            type: 'ElseClause'
          , body
        };
      }

      , whileStatement(condition, body) {
        return {
            type: 'WhileStatement'
          , condition
          , body
        };
      }

      , doStatement(body) {
        return {
            type: 'DoStatement'
          , body
        };
      }

      , repeatStatement(condition, body) {
        return {
            type: 'RepeatStatement'
          , condition
          , body
        };
      }

      , localStatement(variables, init) {
        return {
            type: 'LocalStatement'
          , variables
          , init
        };
      }

      , assignmentStatement(variables, init) {
        return {
            type: 'AssignmentStatement'
          , variables
          , init
        };
      }

      , callStatement(expression) {
        return {
            type: 'CallStatement'
          , expression
        };
      }

      , functionStatement(identifier, parameters, isLocal, body) {
        return {
            type: 'FunctionDeclaration'
          , identifier
          , isLocal
          , parameters
          , body
        };
      }

      , forNumericStatement(variable, start, end, step, body) {
        return {
            type: 'ForNumericStatement'
          , variable
          , start
          , end
          , step
          , body
        };
      }

      , forGenericStatement(variables, iterators, body) {
        return {
            type: 'ForGenericStatement'
          , variables
          , iterators
          , body
        };
      }

      , chunk(body) {
        return {
            type: 'Chunk'
          , body
        };
      }

      , identifier(name) {
        return {
            type: 'Identifier'
          , name
        };
      }

      , literal(type, value, raw) {
        type = (type === StringLiteral) ? 'StringLiteral'
          : (type === NumericLiteral) ? 'NumericLiteral'
          : (type === BooleanLiteral) ? 'BooleanLiteral'
          : (type === NilLiteral) ? 'NilLiteral'
          : 'VarargLiteral';

        return {
            type
          , value
          , raw
        };
      }

      , tableKey(key, value) {
        return {
            type: 'TableKey'
          , key
          , value
        };
      }
      , tableKeyString(key, value) {
        return {
            type: 'TableKeyString'
          , key
          , value
        };
      }
      , tableValue(value) {
        return {
            type: 'TableValue'
          , value
        };
      }


      , tableConstructorExpression(fields) {
        return {
            type: 'TableConstructorExpression'
          , fields
        };
      }
      , binaryExpression(operator, left, right) {
        const type = ('and' === operator || 'or' === operator) ?
          'LogicalExpression' :
          'BinaryExpression';

        return {
            type
          , operator
          , left
          , right
        };
      }
      , unaryExpression(operator, argument) {
        return {
            type: 'UnaryExpression'
          , operator
          , argument
        };
      }
      , memberExpression(base, indexer, identifier) {
        return {
            type: 'MemberExpression'
          , indexer
          , identifier
          , base
        };
      }

      , indexExpression(base, index) {
        return {
            type: 'IndexExpression'
          , base
          , index
        };
      }

      , callExpression(base, args) {
        return {
            type: 'CallExpression'
          , base
          , 'arguments': args
        };
      }

      , tableCallExpression(base, args) {
        return {
            type: 'TableCallExpression'
          , base
          , 'arguments': args
        };
      }

      , stringCallExpression(base, argument) {
        return {
            type: 'StringCallExpression'
          , base
          , argument
        };
      }

      , comment(value, raw) {
        return {
            type: 'Comment'
          , value
          , raw
        };
      }
    };

    function finishNode(node) {
      if (trackLocations) {
        const location = locations.pop();
        location.complete();
        if (options.locations) node.loc = location.loc;
        if (options.ranges) node.range = location.range;
      }
      return node;
    }

    const slice = Array.prototype.slice;
    const toString = Object.prototype.toString;

    const indexOf = function indexOf(array, element) {
        for (let i = 0, length = array.length; i < length; i++) {
          if (array[i] === element) return i;
        }
        return -1;
      };

    function indexOfObject(array, property, element) {
      for (let i = 0, length = array.length; i < length; i++) {
        if (array[i][property] === element) return i;
      }
      return -1;
    }

    function sprintf(format) {
      const args = slice.call(arguments, 1);
      format = format.replace(/%(\d)/g, (match, index) => `${args[index - 1]}` || '');
      return format;
    }

    function extend() {
        const args = slice.call(arguments);
        const dest = {};
        let src;
        let prop;

        for (let i = 0, length = args.length; i < length; i++) {
          src = args[i];
          for (prop in src) if (src.hasOwnProperty(prop)) {
            dest[prop] = src[prop];
          }
        }
        return dest;
    }

    function raise(token) {
        const message = sprintf(...slice.call(arguments, 1));
        let error;
        let col;

        if ('undefined' !== typeof token.line) {
          col = token.range[0] - token.lineStart;
          error = new SyntaxError(sprintf('[%1:%2] %3', token.line, col, message));
          error.line = token.line;
          error.index = token.range[0];
          error.column = col;
        } else {
          col = index - lineStart + 1;
          error = new SyntaxError(sprintf('[%1:%2] %3', line, col, message));
          error.index = index;
          error.line = line;
          error.column = col;
        }
        throw error;
    }

    function raiseUnexpectedToken(type, token) {
      raise(token, errors.expectedToken, type, token.value);
    }

    function unexpected(found, near) {
      if ('undefined' === typeof near) near = lookahead.value;
      if ('undefined' !== typeof found.type) {
        let type;
        switch (found.type) {
          case StringLiteral:   type = 'string';      break;
          case Keyword:         type = 'keyword';     break;
          case Identifier:      type = 'identifier';  break;
          case NumericLiteral:  type = 'number';      break;
          case Punctuator:      type = 'symbol';      break;
          case BooleanLiteral:  type = 'boolean';     break;
          case NilLiteral:
            return raise(found, errors.unexpected, 'symbol', 'nil', near);
        }
        return raise(found, errors.unexpected, type, found.value, near);
      }
      return raise(found, errors.unexpected, 'symbol', found, near);
    }

    var index;
    let token;
    let previousToken;
    var lookahead;
    let comments;
    let tokenStart;
    var line;
    var lineStart;

    exports.lex = lex;

    function lex() {
        skipWhiteSpace();
        while (45 === input.charCodeAt(index) &&
               45 === input.charCodeAt(index + 1)) {
          scanComment();
          skipWhiteSpace();
        }
        if (index >= length) return {
            type : EOF
          , value: '<eof>'
          , line
          , lineStart
          , range: [index, index]
        };

        const charCode = input.charCodeAt(index);
        const next = input.charCodeAt(index + 1);
        tokenStart = index;
        if (isIdentifierStart(charCode)) return scanIdentifierOrKeyword();

        switch (charCode) {
          case 39: case 34: // '"
            return scanStringLiteral();
          case 48: case 49: case 50: case 51: case 52: case 53:
          case 54: case 55: case 56: case 57:
            return scanNumericLiteral();

          case 46: // .
            if (isDecDigit(next)) return scanNumericLiteral();
            if (46 === next) {
              if (46 === input.charCodeAt(index + 2)) return scanVarargLiteral();
              return scanPunctuator('..');
            }
            return scanPunctuator('.');

          case 61: // =
            if (61 === next) return scanPunctuator('==');
            return scanPunctuator('=');

          case 62: // >
            if (61 === next) return scanPunctuator('>=');
            return scanPunctuator('>');

          case 60: // <
            if (61 === next) return scanPunctuator('<=');
            return scanPunctuator('<');

          case 126: // ~
            if (61 === next) return scanPunctuator('~=');
            return raise({}, errors.expected, '=', '~');

          case 58: // :
            if (58 === next) return scanPunctuator('::');
            return scanPunctuator(':');

          case 91: // [
            if (91 === next || 61 === next) return scanLongStringLiteral();
            return scanPunctuator('[');
          case 42: case 47: case 94: case 37: case 44: case 123: case 125:
          case 93: case 40: case 41: case 59: case 35: case 45: case 43:
            return scanPunctuator(input.charAt(index));
        }

        return unexpected(input.charAt(index));
    }

    function skipWhiteSpace() {
      while (index < length) {
        const charCode = input.charCodeAt(index);
        if (isWhiteSpace(charCode)) {
          index++;
        } else if (isLineTerminator(charCode)) {
          line++;
          lineStart = ++index;
        } else {
          break;
        }
      }
    }

    function scanIdentifierOrKeyword() {
        let value;
        let type;
        while (isIdentifierPart(input.charCodeAt(++index)));
        value = input.slice(tokenStart, index);
        if (isKeyword(value)) {
          type = Keyword;
        } else if ('true' === value || 'false' === value) {
          type = BooleanLiteral;
          value = ('true' === value);
        } else if ('nil' === value) {
          type = NilLiteral;
          value = null;
        } else {
          type = Identifier;
        }

        return {
            type
          , value
          , line
          , lineStart
          , range: [tokenStart, index]
        };
    }

    function scanPunctuator(value) {
      index += value.length;
      return {
          type: Punctuator
        , value
        , line
        , lineStart
        , range: [tokenStart, index]
      };
    }

    function scanVarargLiteral() {
      index += 3;
      return {
          type: VarargLiteral
        , value: '...'
        , line
        , lineStart
        , range: [tokenStart, index]
      };
    }

    function scanStringLiteral() {
        const delimiter = input.charCodeAt(index++);
        let stringStart = index;
        let string = '';
        let charCode;

        while (index < length) {
          charCode = input.charCodeAt(index++);
          if (delimiter === charCode) break;
          if (92 === charCode) { // \
            string += input.slice(stringStart, index - 1) + readEscapeSequence();
            stringStart = index;
          }
          else if (index >= length || isLineTerminator(charCode)) {
            string += input.slice(stringStart, index - 1);
            raise({}, errors.unfinishedString, string + String.fromCharCode(charCode));
          }
        }
        string += input.slice(stringStart, index - 1);

        return {
            type: StringLiteral
          , value: string
          , line
          , lineStart
          , range: [tokenStart, index]
        };
    }

    function scanLongStringLiteral() {
      const string = readLongString();
      if (false === string) raise(token, errors.expected, '[', token.value);

      return {
          type: StringLiteral
        , value: string
        , line
        , lineStart
        , range: [tokenStart, index]
      };
    }

    function scanNumericLiteral() {
        const character = input.charAt(index);
        const next = input.charAt(index + 1);

        const value = ('0' === character && 'xX'.includes(next || null)) ?
          readHexLiteral() : readDecLiteral();

        return {
            type: NumericLiteral
          , value
          , line
          , lineStart
          , range: [tokenStart, index]
        };
    }

    function readHexLiteral() {
        let // defaults to 0 as it gets summed
        fraction = 0;

        let // defaults to 1 as it gets multiplied
        binaryExponent = 1;

        let // positive
        binarySign = 1;

        let digit;
        let fractionStart;
        let exponentStart;
        let digitStart;

        digitStart = index += 2; // Skip 0x part
        if (!isHexDigit(input.charCodeAt(index)))
          raise({}, errors.malformedNumber, input.slice(tokenStart, index));

        while (isHexDigit(input.charCodeAt(index))) index++;
        digit = parseInt(input.slice(digitStart, index), 16);
        if ('.' === input.charAt(index)) {
          fractionStart = ++index;

          while (isHexDigit(input.charCodeAt(index))) index++;
          fraction = input.slice(fractionStart, index);
          fraction = (fractionStart === index) ? 0
            : parseInt(fraction, 16) / (16 ** (index - fractionStart));
        }
        if ('pP'.includes(input.charAt(index) || null)) {
          index++;
          if ('+-'.includes(input.charAt(index) || null))
            binarySign = ('+' === input.charAt(index++)) ? 1 : -1;

          exponentStart = index;
          if (!isDecDigit(input.charCodeAt(index)))
            raise({}, errors.malformedNumber, input.slice(tokenStart, index));

          while (isDecDigit(input.charCodeAt(index))) index++;
          binaryExponent = input.slice(exponentStart, index);
          binaryExponent = 2 ** (binaryExponent * binarySign);
        }

        return (digit + fraction) * binaryExponent;
    }

    function readDecLiteral() {
      while (isDecDigit(input.charCodeAt(index))) index++;
      if ('.' === input.charAt(index)) {
        index++;
        while (isDecDigit(input.charCodeAt(index))) index++;
      }
      if ('eE'.includes(input.charAt(index) || null)) {
        index++;
        if ('+-'.includes(input.charAt(index) || null)) index++;
        if (!isDecDigit(input.charCodeAt(index)))
          raise({}, errors.malformedNumber, input.slice(tokenStart, index));

        while (isDecDigit(input.charCodeAt(index))) index++;
      }

      return parseFloat(input.slice(tokenStart, index));
    }

    function readEscapeSequence() {
      const sequenceStart = index;
      switch (input.charAt(index)) {
        case 'n': index++; return '\n';
        case 'r': index++; return '\r';
        case 't': index++; return '\t';
        case 'v': index++; return '\x0B';
        case 'b': index++; return '\b';
        case 'f': index++; return '\f';
        case 'z': index++; skipWhiteSpace(); return '';
        case 'x':
          if (isHexDigit(input.charCodeAt(index + 1)) &&
              isHexDigit(input.charCodeAt(index + 2))) {
            index += 3;
            return `\\${input.slice(sequenceStart, index)}`;
          }
          return `\\${input.charAt(index++)}`;
        default:
          if (isDecDigit(input.charCodeAt(index))) {
            while (isDecDigit(input.charCodeAt(++index)));
            return `\\${input.slice(sequenceStart, index)}`;
          }
          return input.charAt(index++);
      }
    }

    function scanComment() {
        tokenStart = index;
        index += 2; // --

        const character = input.charAt(index);
        let content = '';
        let isLong = false;
        const commentStart = index;
        const lineStartComment = lineStart;
        const lineComment = line;

        if ('[' === character) {
          content = readLongString();
          if (false === content) content = character;
          else isLong = true;
        }
        if (!isLong) {
          while (index < length) {
            if (isLineTerminator(input.charCodeAt(index))) break;
            index++;
          }
          if (options.comments) content = input.slice(commentStart, index);
        }

        if (options.comments) {
          const node = ast.comment(content, input.slice(tokenStart, index));
          if (options.locations) {
            node.loc = {
                start: { line: lineComment, column: tokenStart - lineStartComment }
              , end: { line, column: index - lineStart }
            };
          }
          if (options.ranges) {
            node.range = [tokenStart, index];
          }
          comments.push(node);
        }
    }

    function readLongString() {
        let level = 0;
        let content = '';
        let terminator = false;
        let character;
        let stringStart;

        index++; // [
        while ('=' === input.charAt(index + level)) level++;
        if ('[' !== input.charAt(index + level)) return false;

        index += level + 1;
        if (isLineTerminator(input.charCodeAt(index))) {
          line++;
          lineStart = index++;
        }

        stringStart = index;
        while (index < length) {
          character = input.charAt(index++);
          if (isLineTerminator(character.charCodeAt(0))) {
            line++;
            lineStart = index;
          }
          if (']' === character) {
            terminator = true;
            for (let i = 0; i < level; i++) {
              if ('=' !== input.charAt(index + i)) terminator = false;
            }
            if (']' !== input.charAt(index + level)) terminator = false;
          }
          if (terminator) break;
        }
        content += input.slice(stringStart, index - 1);
        index += level + 1;

        return content;
    }

    function next() {
      previousToken = token;
      token = lookahead;
      lookahead = lex();
    }

    function consume(value) {
      if (value === token.value) {
        next();
        return true;
      }
      return false;
    }

    function expect(value) {
      if (value === token.value) next();
      else raise(token, errors.expected, value, token.value);
    }

    function isWhiteSpace(charCode) {
      return 9 === charCode || 32 === charCode || 0xB === charCode || 0xC === charCode;
    }

    function isLineTerminator(charCode) {
      return 10 === charCode || 13 === charCode;
    }

    function isDecDigit(charCode) {
      return charCode >= 48 && charCode <= 57;
    }

    function isHexDigit(charCode) {
      return (charCode >= 48 && charCode <= 57) || (charCode >= 97 && charCode <= 102) || (charCode >= 65 && charCode <= 70);
    }

    function isIdentifierStart(charCode) {
      return (charCode >= 65 && charCode <= 90) || (charCode >= 97 && charCode <= 122) || 95 === charCode;
    }

    function isIdentifierPart(charCode) {
      return (charCode >= 65 && charCode <= 90) || (charCode >= 97 && charCode <= 122) || 95 === charCode || (charCode >= 48 && charCode <= 57);
    }

    function isKeyword(id) {
      switch (id.length) {
        case 2:
          return 'do' === id || 'if' === id || 'in' === id || 'or' === id;
        case 3:
          return 'and' === id || 'end' === id || 'for' === id || 'not' === id;
        case 4:
          return 'else' === id || 'goto' === id || 'then' === id;
        case 5:
          return 'break' === id || 'local' === id || 'until' === id || 'while' === id;
        case 6:
          return 'elseif' === id || 'repeat' === id || 'return' === id;
        case 8:
          return 'function' === id;
      }
      return false;
    }

    function isUnary(token) {
      if (Punctuator === token.type) return '#-'.includes(token.value);
      if (Keyword === token.type) return 'not' === token.value;
      return false;
    }
    function isCallExpression(expression) {
      switch (expression.type) {
        case 'CallExpression':
        case 'TableCallExpression':
        case 'StringCallExpression':
          return true;
      }
      return false;
    }

    function isBlockFollow(token) {
      if (EOF === token.type) return true;
      if (Keyword !== token.type) return false;
      switch (token.value) {
        case 'else': case 'elseif':
        case 'end': case 'until':
          return true;
        default:
          return false;
      }
    }
    let scopes;
    let scopeDepth;
    let globals;
    function createScope() {
      scopes.push(Array(...scopes[scopeDepth++]));
    }
    function exitScope() {
      scopes.pop();
      scopeDepth--;
    }
    function scopeIdentifierName(name) {
      if (-1 !== indexOf(scopes[scopeDepth], name)) return;
      scopes[scopeDepth].push(name);
    }
    function scopeIdentifier(node) {
      scopeIdentifierName(node.name);
      attachScope(node, true);
    }
    function attachScope(node, isLocal) {
      if (!isLocal && -1 === indexOfObject(globals, 'name', node.name))
        globals.push(node);

      node.isLocal = isLocal;
    }
    function scopeHasName(name) {
      return (-1 !== indexOf(scopes[scopeDepth], name));
    }

    var locations = [];
    var trackLocations;

    function createLocationMarker() {
      return new Marker(token);
    }

    class Marker {
        constructor(token) {
          if (options.locations) {
            this.loc = {
                start: {
                  line: token.line
                , column: token.range[0] - token.lineStart
              }
              , end: {
                  line: 0
                , column: 0
              }
            };
          }
          if (options.ranges) this.range = [token.range[0], 0];
        }

        complete() {
          if (options.locations) {
            this.loc.end.line = previousToken.line;
            this.loc.end.column = previousToken.range[1] - previousToken.lineStart;
          }
          if (options.ranges) {
            this.range[1] = previousToken.range[1];
          }
        }
    }

    function markLocation() {
      if (trackLocations) locations.push(createLocationMarker());
    }
    function pushLocation(marker) {
      if (trackLocations) locations.push(marker);
    }

    function parseChunk() {
      next();
      markLocation();
      const body = parseBlock();
      if (EOF !== token.type) unexpected(token);
      if (trackLocations && !body.length) previousToken = token;
      return finishNode(ast.chunk(body));
    }

    function parseBlock(terminator) {
        const block = [];
        let statement;
        if (options.scope) createScope();

        while (!isBlockFollow(token)) {
          if ('return' === token.value) {
            block.push(parseStatement());
            break;
          }
          statement = parseStatement();
          if (statement) block.push(statement);
        }

        if (options.scope) exitScope();
        return block;
    }

    function parseStatement() {
      markLocation();
      if (Keyword === token.type) {
        switch (token.value) {
          case 'local':    next(); return parseLocalStatement();
          case 'if':       next(); return parseIfStatement();
          case 'return':   next(); return parseReturnStatement();
          case 'function': next();
            const name = parseFunctionName();
            return parseFunctionDeclaration(name);
          case 'while':    next(); return parseWhileStatement();
          case 'for':      next(); return parseForStatement();
          case 'repeat':   next(); return parseRepeatStatement();
          case 'break':    next(); return parseBreakStatement();
          case 'do':       next(); return parseDoStatement();
          case 'goto':     next(); return parseGotoStatement();
        }
      }

      if (Punctuator === token.type) {
        if (consume('::')) return parseLabelStatement();
      }
      if (trackLocations) locations.pop();
      if (consume(';')) return;

      return parseAssignmentOrCallStatement();
    }

    function parseLabelStatement() {
        const name = token.value;
        const label = parseIdentifier();

        if (options.scope) {
          scopeIdentifierName(`::${name}::`);
          attachScope(label, true);
        }

        expect('::');
        return finishNode(ast.labelStatement(label));
    }

    function parseBreakStatement() {
      return finishNode(ast.breakStatement());
    }

    function parseGotoStatement() {
        const name = token.value;
        const label = parseIdentifier();

        if (options.scope) label.isLabel = scopeHasName(`::${name}::`);
        return finishNode(ast.gotoStatement(label));
    }

    function parseDoStatement() {
      const body = parseBlock();
      expect('end');
      return finishNode(ast.doStatement(body));
    }

    function parseWhileStatement() {
      const condition = parseExpectedExpression();
      expect('do');
      const body = parseBlock();
      expect('end');
      return finishNode(ast.whileStatement(condition, body));
    }

    function parseRepeatStatement() {
      const body = parseBlock();
      expect('until');
      const condition = parseExpectedExpression();
      return finishNode(ast.repeatStatement(condition, body));
    }

    function parseReturnStatement() {
      const expressions = [];

      if ('end' !== token.value) {
        let expression = parseExpression();
        if (null != expression) expressions.push(expression);
        while (consume(',')) {
          expression = parseExpectedExpression();
          expressions.push(expression);
        }
        consume(';'); // grammar tells us ; is optional here.
      }
      return finishNode(ast.returnStatement(expressions));
    }

    function parseIfStatement() {
        const clauses = [];
        let condition;
        let body;
        let marker;
        if (trackLocations) {
          marker = locations[locations.length - 1];
          locations.push(marker);
        }
        condition = parseExpectedExpression();
        expect('then');
        body = parseBlock();
        clauses.push(finishNode(ast.ifClause(condition, body)));

        if (trackLocations) marker = createLocationMarker();
        while (consume('elseif')) {
          pushLocation(marker);
          condition = parseExpectedExpression();
          expect('then');
          body = parseBlock();
          clauses.push(finishNode(ast.elseifClause(condition, body)));
          if (trackLocations) marker = createLocationMarker();
        }

        if (consume('else')) {
          if (trackLocations) {
            marker = new Marker(previousToken);
            locations.push(marker);
          }
          body = parseBlock();
          clauses.push(finishNode(ast.elseClause(body)));
        }

        expect('end');
        return finishNode(ast.ifStatement(clauses));
    }

    function parseForStatement() {
        let variable = parseIdentifier();
        let body;
        if (options.scope) scopeIdentifier(variable);
        if (consume('=')) {
          const start = parseExpectedExpression();
          expect(',');
          const end = parseExpectedExpression();
          const step = consume(',') ? parseExpectedExpression() : null;

          expect('do');
          body = parseBlock();
          expect('end');

          return finishNode(ast.forNumericStatement(variable, start, end, step, body));
        }
        else {
          const variables = [variable];
          while (consume(',')) {
            variable = parseIdentifier();
            if (options.scope) scopeIdentifier(variable);
            variables.push(variable);
          }
          expect('in');
          const iterators = [];
          do {
            const expression = parseExpectedExpression();
            iterators.push(expression);
          } while (consume(','));

          expect('do');
          body = parseBlock();
          expect('end');

          return finishNode(ast.forGenericStatement(variables, iterators, body));
        }
    }

    function parseLocalStatement() {
      let name;

      if (Identifier === token.type) {
          const variables = [];
          const init = [];

          do {
            name = parseIdentifier();

            variables.push(name);
          } while (consume(','));

          if (consume('=')) {
            do {
              const expression = parseExpectedExpression();
              init.push(expression);
            } while (consume(','));
          }
          if (options.scope) {
            for (let i = 0, l = variables.length; i < l; i++) {
              scopeIdentifier(variables[i]);
            }
          }

          return finishNode(ast.localStatement(variables, init));
      }
      if (consume('function')) {
        name = parseIdentifier();
        if (options.scope) scopeIdentifier(name);
        return parseFunctionDeclaration(name, true);
      } else {
        raiseUnexpectedToken('<name>', token);
      }
    }

    function parseAssignmentOrCallStatement() {
        const previous = token;
        let expression;
        let marker;

        if (trackLocations) marker = createLocationMarker();
        expression = parsePrefixExpression();

        if (null == expression) return unexpected(token);
        if (',='.includes(token.value)) {
            const variables = [expression];
            const init = [];
            let exp;

            while (consume(',')) {
              exp = parsePrefixExpression();
              if (null == exp) raiseUnexpectedToken('<expression>', token);
              variables.push(exp);
            }
            expect('=');
            do {
              exp = parseExpectedExpression();
              init.push(exp);
            } while (consume(','));

            pushLocation(marker);
            return finishNode(ast.assignmentStatement(variables, init));
        }
        if (isCallExpression(expression)) {
          pushLocation(marker);
          return finishNode(ast.callStatement(expression));
        }
        return unexpected(previous);
    }

    function parseIdentifier() {
      markLocation();
      const identifier = token.value;
      if (Identifier !== token.type) raiseUnexpectedToken('<name>', token);
      next();
      return finishNode(ast.identifier(identifier));
    }

    function parseFunctionDeclaration(name, isLocal) {
      const parameters = [];
      expect('(');
      if (!consume(')')) {
        while (true) {
          if (Identifier === token.type) {
            const parameter = parseIdentifier();
            if (options.scope) scopeIdentifier(parameter);

            parameters.push(parameter);

            if (consume(',')) continue;
            else if (consume(')')) break;
          }
          else if (VarargLiteral === token.type) {
            parameters.push(parsePrimaryExpression());
            expect(')');
            break;
          } else {
            raiseUnexpectedToken('<name> or \'...\'', token);
          }
        }
      }

      const body = parseBlock();
      expect('end');

      isLocal = isLocal || false;
      return finishNode(ast.functionStatement(name, parameters, isLocal, body));
    }

    function parseFunctionName() {
        let base;
        let name;
        let marker;

        if (trackLocations) marker = createLocationMarker();
        base = parseIdentifier();

        if (options.scope) attachScope(base, false);

        while (consume('.')) {
          pushLocation(marker);
          name = parseIdentifier();
          if (options.scope) attachScope(name, false);
          base = finishNode(ast.memberExpression(base, '.', name));
        }

        if (consume(':')) {
          pushLocation(marker);
          name = parseIdentifier();
          if (options.scope) attachScope(name, false);
          base = finishNode(ast.memberExpression(base, ':', name));
        }

        return base;
    }

    function parseTableConstructor() {
        const fields = [];
        let key;
        let value;

        while (true) {
          markLocation();
          if (Punctuator === token.type && consume('[')) {
            key = parseExpectedExpression();
            expect(']');
            expect('=');
            value = parseExpectedExpression();
            fields.push(finishNode(ast.tableKey(key, value)));
          } else if (Identifier === token.type) {
            key = parseExpectedExpression();
            if (consume('=')) {
              value = parseExpectedExpression();
              fields.push(finishNode(ast.tableKeyString(key, value)));
            } else {
              fields.push(finishNode(ast.tableValue(key)));
            }
          } else {
            if (null == (value = parseExpression())) {
              locations.pop();
              break;
            }
            fields.push(finishNode(ast.tableValue(value)));
          }
          if (',;'.includes(token.value)) {
            next();
            continue;
          }
          if ('}' === token.value) break;
        }
        expect('}');
        return finishNode(ast.tableConstructorExpression(fields));
    }

    function parseExpression() {
      const expression = parseSubExpression(0);
      return expression;
    }

    function parseExpectedExpression() {
      const expression = parseExpression();
      if (null == expression) raiseUnexpectedToken('<expression>', token);
      else return expression;
    }

    function binaryPrecedence(operator) {
        const charCode = operator.charCodeAt(0);
        const length = operator.length;

        if (1 === length) {
          switch (charCode) {
            case 94: return 10; // ^
            case 42: case 47: case 37: return 7; // * / %
            case 43: case 45: return 6; // + -
            case 60: case 62: return 3; // < >
          }
        } else if (2 === length) {
          switch (charCode) {
            case 46: return 5; // ..
            case 60: case 62: case 61: case 126: return 3; // <= >= == ~=
            case 111: return 1; // or
          }
        } else if (97 === charCode && 'and' === operator) return 2;
        return 0;
    }

    function parseSubExpression(minPrecedence) {
        let operator = token.value;
        let expression;
        let marker;

        if (trackLocations) marker = createLocationMarker();
        if (isUnary(token)) {
          markLocation();
          next();
          const argument = parseSubExpression(8);
          if (argument == null) raiseUnexpectedToken('<expression>', token);
          expression = finishNode(ast.unaryExpression(operator, argument));
        }
        if (null == expression) {
          expression = parsePrimaryExpression();
          if (null == expression) {
            expression = parsePrefixExpression();
          }
        }
        if (null == expression) return null;

        let precedence;
        while (true) {
          operator = token.value;

          precedence = (Punctuator === token.type || Keyword === token.type) ?
            binaryPrecedence(operator) : 0;

          if (precedence === 0 || precedence <= minPrecedence) break;
          if ('^' === operator || '..' === operator) precedence--;
          next();
          const right = parseSubExpression(precedence);
          if (null == right) raiseUnexpectedToken('<expression>', token);
          if (trackLocations) locations.push(marker);
          expression = finishNode(ast.binaryExpression(operator, expression, right));

        }
        return expression;
    }

    function parsePrefixExpression() {
        let base;
        let name;
        let marker;
        let isLocal;

        if (trackLocations) marker = createLocationMarker();
        if (Identifier === token.type) {
          name = token.value;
          base = parseIdentifier();
          if (options.scope) attachScope(base, isLocal = scopeHasName(name));
        } else if (consume('(')) {
          base = parseExpectedExpression();
          expect(')');
          if (options.scope) isLocal = base.isLocal;
        } else {
          return null;
        }
        let expression;
        let identifier;
        while (true) {
          if (Punctuator === token.type) {
            switch (token.value) {
              case '[':
                pushLocation(marker);
                next();
                expression = parseExpectedExpression();
                base = finishNode(ast.indexExpression(base, expression));
                expect(']');
                break;
              case '.':
                pushLocation(marker);
                next();
                identifier = parseIdentifier();
                if (options.scope) attachScope(identifier, isLocal);
                base = finishNode(ast.memberExpression(base, '.', identifier));
                break;
              case ':':
                pushLocation(marker);
                next();
                identifier = parseIdentifier();
                if (options.scope) attachScope(identifier, isLocal);
                base = finishNode(ast.memberExpression(base, ':', identifier));
                pushLocation(marker);
                base = parseCallExpression(base);
                break;
              case '(': case '{': // args
                pushLocation(marker);
                base = parseCallExpression(base);
                break;
              default:
                return base;
            }
          } else if (StringLiteral === token.type) {
            pushLocation(marker);
            base = parseCallExpression(base);
          } else {
            break;
          }
        }

        return base;
    }

    function parseCallExpression(base) {
      if (Punctuator === token.type) {
        switch (token.value) {
          case '(':
            next();
            const expressions = [];
            let expression = parseExpression();
            if (null != expression) expressions.push(expression);
            while (consume(',')) {
              expression = parseExpectedExpression();
              expressions.push(expression);
            }

            expect(')');
            return finishNode(ast.callExpression(base, expressions));

          case '{':
            markLocation();
            next();
            const table = parseTableConstructor();
            return finishNode(ast.tableCallExpression(base, table));
        }
      } else if (StringLiteral === token.type) {
        return finishNode(ast.stringCallExpression(base, parsePrimaryExpression()));
      }

      raiseUnexpectedToken('function arguments', token);
    }

    function parsePrimaryExpression() {
        const literals = StringLiteral | NumericLiteral | BooleanLiteral | NilLiteral | VarargLiteral;
        const value = token.value;
        const type = token.type;
        let marker;

        if (trackLocations) marker = createLocationMarker();

        if (type & literals) {
          pushLocation(marker);
          const raw = input.slice(token.range[0], token.range[1]);
          next();
          return finishNode(ast.literal(type, value, raw));
        } else if (Keyword === type && 'function' === value) {
          pushLocation(marker);
          next();
          return parseFunctionDeclaration(null);
        } else if (consume('{')) {
          pushLocation(marker);
          return parseTableConstructor();
        }
    }

    exports.parse = parse;

    function parse(_input, _options) {
      if ('undefined' === typeof _options && 'object' === typeof _input) {
        _options = _input;
        _input = undefined;
      }
      if (!_options) _options = {};

      input = _input || '';
      options = extend(defaultOptions, _options);
      index = 0;
      line = 1;
      lineStart = 0;
      length = input.length;
      scopes = [[]];
      scopeDepth = 0;
      globals = [];
      locations = [];

      if (options.comments) comments = [];
      if (!options.wait) return end();
      return exports;
    }
    exports.write = write;

    function write(_input) {
      input += String(_input);
      length = input.length;
      return exports;
    }
    exports.end = end;

    function end(_input) {
      if ('undefined' !== typeof _input) write(_input);

      length = input.length;
      trackLocations = options.locations || options.ranges;
      lookahead = lex();

      const chunk = parseChunk();
      if (options.comments) chunk.comments = comments;
      if (options.scope) chunk.globals = globals;

      if (locations.length > 0)
        throw new Error('Location tracking failed. This is most likely a bug in luaparse');

      return chunk;
    }
}));

});

ace.define("ace/mode/lua_worker",["require","exports","module","ace/lib/oop","ace/worker/mirror","ace/mode/lua/luaparse"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const Mirror = require("../worker/mirror").Mirror;
    const luaparse = require("../mode/lua/luaparse");

    const Worker = exports.Worker = function(sender) {
        Mirror.call(this, sender);
        this.setTimeout(500);
    };

    oop.inherits(Worker, Mirror);

    (function() {

        this.onUpdate = function() {
            const value = this.doc.getValue();
            const errors = [];
            try {
                luaparse.parse(value);
            } catch(e) {
                if (e instanceof SyntaxError) {
                    errors.push({
                        row: e.line - 1,
                        column: e.column,
                        text: e.message,
                        type: "error"
                    });
                }
            }
            this.sender.emit("annotate", errors);
        };

    }).call(Worker.prototype);
});

ace.define("ace/lib/es5-shim",["require","exports","module"], (require, exports, module) => {
    function Empty() {}

    if (!Function.prototype.bind) {
        Function.prototype.bind = function bind(that) { // .length is 1
            const target = this;
            if (typeof target != "function") {
                throw new TypeError(`Function.prototype.bind called on incompatible ${target}`);
            }
            const args = slice.call(arguments, 1); // for normal call
            const bound = function () {

                if (this instanceof bound) {

                    const result = target.apply(
                        this,
                        args.concat(slice.call(arguments))
                    );
                    if (Object(result) === result) {
                        return result;
                    }
                    return this;

                } else {
                    return target.apply(
                        that,
                        args.concat(slice.call(arguments))
                    );

                }

            };
            if(target.prototype) {
                Empty.prototype = target.prototype;
                bound.prototype = new Empty();
                Empty.prototype = null;
            }
            return bound;
        };
    }
    const call = Function.prototype.call;
    const prototypeOfArray = Array.prototype;
    const prototypeOfObject = Object.prototype;
    var slice = prototypeOfArray.slice;
    const _toString = call.bind(prototypeOfObject.toString);
    const owns = call.bind(prototypeOfObject.hasOwnProperty);
    let defineGetter;
    let defineSetter;
    let lookupGetter;
    let lookupSetter;
    let supportsAccessors;
    if ((supportsAccessors = owns(prototypeOfObject, "__defineGetter__"))) {
        defineGetter = call.bind(prototypeOfObject.__defineGetter__);
        defineSetter = call.bind(prototypeOfObject.__defineSetter__);
        lookupGetter = call.bind(prototypeOfObject.__lookupGetter__);
        lookupSetter = call.bind(prototypeOfObject.__lookupSetter__);
    }
    if ([1,2].splice(0).length != 2) {
        if((() => {
            // test IE < 9 to splice bug - see issue #138
            function makeArray(l) {
                const a = new Array(l+2);
                a[0] = a[1] = 0;
                return a;
            }
            const array = [];
            let lengthBefore;

            array.splice(...makeArray(20));
            array.splice(...makeArray(26));

            lengthBefore = array.length; //46
            array.splice(5, 0, "XXX"); // add one element

            lengthBefore + 1 == array.length

            if (lengthBefore + 1 == array.length) {
                return true;// has right splice implementation without bugs
            }
        })()) {//IE 6/7
            const array_splice = Array.prototype.splice;
            Array.prototype.splice = function(start, deleteCount) {
                if (!arguments.length) {
                    return [];
                } else {
                    return array_splice.apply(this, [
                        start === void 0 ? 0 : start,
                        deleteCount === void 0 ? (this.length - start) : deleteCount
                    ].concat(slice.call(arguments, 2)))
                }
            };
        } else {//IE8
            Array.prototype.splice = function(pos, removeCount){
                const length = this.length;
                if (pos > 0) {
                    if (pos > length)
                        pos = length;
                } else if (pos == void 0) {
                    pos = 0;
                } else if (pos < 0) {
                    pos = Math.max(length + pos, 0);
                }

                if (!(pos+removeCount < length))
                    removeCount = length - pos;

                const removed = this.slice(pos, pos+removeCount);
                const insert = slice.call(arguments, 2);
                const add = insert.length;            
                if (pos === length) {
                    if (add) {
                        this.push(...insert);
                    }
                } else {
                    const remove = Math.min(removeCount, length - pos);
                    const tailOldPos = pos + remove;
                    const tailNewPos = tailOldPos + add - remove;
                    const tailCount = length - tailOldPos;
                    const lengthAfterRemove = length - remove;

                    if (tailNewPos < tailOldPos) { // case A
                        for (var i = 0; i < tailCount; ++i) {
                            this[tailNewPos+i] = this[tailOldPos+i];
                        }
                    } else if (tailNewPos > tailOldPos) { // case B
                        for (i = tailCount; i--; ) {
                            this[tailNewPos+i] = this[tailOldPos+i];
                        }
                    } // else, add == remove (nothing to do)

                    if (add && pos === lengthAfterRemove) {
                        this.length = lengthAfterRemove; // truncate array
                        this.push(...insert);
                    } else {
                        this.length = lengthAfterRemove + add; // reserves space
                        for (i = 0; i < add; ++i) {
                            this[pos+i] = insert[i];
                        }
                    }
                }
                return removed;
            };
        }
    }
    if (!Array.isArray) {
        Array.isArray = function isArray(obj) {
            return _toString(obj) == "[object Array]";
        };
    }
    const boxedString = Object("a");
    const splitString = boxedString[0] != "a" || !(0 in boxedString);

    if (!Array.prototype.forEach) {
        Array.prototype.forEach = function forEach(fun /*, thisp*/) {
            const object = toObject(this);

            const self = splitString && _toString(this) == "[object String]" ?
                this.split("") :
                object;

            const thisp = arguments[1];
            let i = -1;
            const length = self.length >>> 0;
            if (_toString(fun) != "[object Function]") {
                throw new TypeError(); // TODO message
            }

            while (++i < length) {
                if (i in self) {
                    fun.call(thisp, self[i], i, object);
                }
            }
        };
    }
    if (!Array.prototype.map) {
        Array.prototype.map = function map(fun /*, thisp*/) {
            const object = toObject(this);

            const self = splitString && _toString(this) == "[object String]" ?
                this.split("") :
                object;

            const length = self.length >>> 0;
            const result = Array(length);
            const thisp = arguments[1];
            if (_toString(fun) != "[object Function]") {
                throw new TypeError(`${fun} is not a function`);
            }

            for (let i = 0; i < length; i++) {
                if (i in self)
                    result[i] = fun.call(thisp, self[i], i, object);
            }
            return result;
        };
    }
    if (!Array.prototype.filter) {
        Array.prototype.filter = function filter(fun /*, thisp */) {
            const object = toObject(this);

            const self = splitString && _toString(this) == "[object String]" ?
                this.split("") :
                    object;

            const length = self.length >>> 0;
            const result = [];
            let value;
            const thisp = arguments[1];
            if (_toString(fun) != "[object Function]") {
                throw new TypeError(`${fun} is not a function`);
            }

            for (let i = 0; i < length; i++) {
                if (i in self) {
                    value = self[i];
                    if (fun.call(thisp, value, i, object)) {
                        result.push(value);
                    }
                }
            }
            return result;
        };
    }
    if (!Array.prototype.every) {
        Array.prototype.every = function every(fun /*, thisp */) {
            const object = toObject(this);

            const self = splitString && _toString(this) == "[object String]" ?
                this.split("") :
                object;

            const length = self.length >>> 0;
            const thisp = arguments[1];
            if (_toString(fun) != "[object Function]") {
                throw new TypeError(`${fun} is not a function`);
            }

            for (let i = 0; i < length; i++) {
                if (i in self && !fun.call(thisp, self[i], i, object)) {
                    return false;
                }
            }
            return true;
        };
    }
    if (!Array.prototype.some) {
        Array.prototype.some = function some(fun /*, thisp */) {
            const object = toObject(this);

            const self = splitString && _toString(this) == "[object String]" ?
                this.split("") :
                object;

            const length = self.length >>> 0;
            const thisp = arguments[1];
            if (_toString(fun) != "[object Function]") {
                throw new TypeError(`${fun} is not a function`);
            }

            for (let i = 0; i < length; i++) {
                if (i in self && fun.call(thisp, self[i], i, object)) {
                    return true;
                }
            }
            return false;
        };
    }
    if (!Array.prototype.reduce) {
        Array.prototype.reduce = function reduce(fun /*, initial*/) {
            const object = toObject(this);

            const self = splitString && _toString(this) == "[object String]" ?
                this.split("") :
                object;

            const length = self.length >>> 0;
            if (_toString(fun) != "[object Function]") {
                throw new TypeError(`${fun} is not a function`);
            }
            if (!length && arguments.length == 1) {
                throw new TypeError("reduce of empty array with no initial value");
            }

            let i = 0;
            let result;
            if (arguments.length >= 2) {
                result = arguments[1];
            } else {
                do {
                    if (i in self) {
                        result = self[i++];
                        break;
                    }
                    if (++i >= length) {
                        throw new TypeError("reduce of empty array with no initial value");
                    }
                } while (true);
            }

            for (; i < length; i++) {
                if (i in self) {
                    result = fun.call(void 0, result, self[i], i, object);
                }
            }

            return result;
        };
    }
    if (!Array.prototype.reduceRight) {
        Array.prototype.reduceRight = function reduceRight(fun /*, initial*/) {
            const object = toObject(this);

            const self = splitString && _toString(this) == "[object String]" ?
                this.split("") :
                object;

            const length = self.length >>> 0;
            if (_toString(fun) != "[object Function]") {
                throw new TypeError(`${fun} is not a function`);
            }
            if (!length && arguments.length == 1) {
                throw new TypeError("reduceRight of empty array with no initial value");
            }

            let result;
            let i = length - 1;
            if (arguments.length >= 2) {
                result = arguments[1];
            } else {
                do {
                    if (i in self) {
                        result = self[i--];
                        break;
                    }
                    if (--i < 0) {
                        throw new TypeError("reduceRight of empty array with no initial value");
                    }
                } while (true);
            }

            do {
                if (i in this) {
                    result = fun.call(void 0, result, self[i], i, object);
                }
            } while (i--);

            return result;
        };
    }
    if (!Array.prototype.indexOf || ([0, 1].indexOf(1, 2) != -1)) {
        Array.prototype.indexOf = function indexOf(sought /*, fromIndex */ ) {
            const self = splitString && _toString(this) == "[object String]" ?
                    this.split("") :
                    toObject(this);

            const length = self.length >>> 0;

            if (!length) {
                return -1;
            }

            let i = 0;
            if (arguments.length > 1) {
                i = toInteger(arguments[1]);
            }
            i = i >= 0 ? i : Math.max(0, length + i);
            for (; i < length; i++) {
                if (i in self && self[i] === sought) {
                    return i;
                }
            }
            return -1;
        };
    }
    if (!Array.prototype.lastIndexOf || ([0, 1].lastIndexOf(0, -3) != -1)) {
        Array.prototype.lastIndexOf = function lastIndexOf(sought /*, fromIndex */) {
            const self = splitString && _toString(this) == "[object String]" ?
                    this.split("") :
                    toObject(this);

            const length = self.length >>> 0;

            if (!length) {
                return -1;
            }
            let i = length - 1;
            if (arguments.length > 1) {
                i = Math.min(i, toInteger(arguments[1]));
            }
            i = i >= 0 ? i : length - Math.abs(i);
            for (; i >= 0; i--) {
                if (i in self && sought === self[i]) {
                    return i;
                }
            }
            return -1;
        };
    }
    if (!Object.getPrototypeOf) {
        Object.getPrototypeOf = function getPrototypeOf(object) {
            return object.__proto__ || (
                object.constructor ?
                object.constructor.prototype :
                prototypeOfObject
            );
        };
    }
    if (!Object.getOwnPropertyDescriptor) {
        const ERR_NON_OBJECT = "Object.getOwnPropertyDescriptor called on a " +
                             "non-object: ";
        Object.getOwnPropertyDescriptor = function getOwnPropertyDescriptor(object, property) {
            if ((typeof object != "object" && typeof object != "function") || object === null)
                throw new TypeError(ERR_NON_OBJECT + object);
            if (!owns(object, property))
                return;

            let descriptor;
            var getter;
            var setter;
            descriptor =  { enumerable: true, configurable: true };
            if (supportsAccessors) {
                const prototype = object.__proto__;
                object.__proto__ = prototypeOfObject;

                var getter = lookupGetter(object, property);
                var setter = lookupSetter(object, property);
                object.__proto__ = prototype;

                if (getter || setter) {
                    if (getter) descriptor.get = getter;
                    if (setter) descriptor.set = setter;
                    return descriptor;
                }
            }
            descriptor.value = object[property];
            return descriptor;
        };
    }
    if (!Object.getOwnPropertyNames) {
        Object.getOwnPropertyNames = function getOwnPropertyNames(object) {
            return Object.keys(object);
        };
    }
    if (!Object.create) {
        let createEmpty;
        if (Object.prototype.__proto__ === null) {
            createEmpty = () => ({
                "__proto__": null
            });
        } else {
            createEmpty = () => {
                const empty = {};
                for (const i in empty)
                    empty[i] = null;
                empty.constructor =
                empty.hasOwnProperty =
                empty.propertyIsEnumerable =
                empty.isPrototypeOf =
                empty.toLocaleString =
                empty.toString =
                empty.valueOf =
                empty.__proto__ = null;
                return empty;
            }
        }

        Object.create = function create(prototype, properties) {
            let object;
            if (prototype === null) {
                object = createEmpty();
            } else {
                if (typeof prototype != "object")
                    throw new TypeError(`typeof prototype[${typeof prototype}] != 'object'`);
                const Type = () => {};
                Type.prototype = prototype;
                object = new Type();
                object.__proto__ = prototype;
            }
            if (properties !== void 0)
                Object.defineProperties(object, properties);
            return object;
        };
    }

    function doesDefinePropertyWork(object) {
        try {
            Object.defineProperty(object, "sentinel", {});
            return "sentinel" in object;
        } catch (exception) {
        }
    }
    if (Object.defineProperty) {
        const definePropertyWorksOnObject = doesDefinePropertyWork({});
        const definePropertyWorksOnDom = typeof document == "undefined" ||
            doesDefinePropertyWork(document.createElement("div"));
        if (!definePropertyWorksOnObject || !definePropertyWorksOnDom) {
            var definePropertyFallback = Object.defineProperty;
        }
    }

    if (!Object.defineProperty || definePropertyFallback) {
        const ERR_NON_OBJECT_DESCRIPTOR = "Property description must be an object: ";
        const ERR_NON_OBJECT_TARGET = "Object.defineProperty called on non-object: ";
        const ERR_ACCESSORS_NOT_SUPPORTED = "getters & setters can not be defined " +
                                          "on this javascript engine";

        Object.defineProperty = function defineProperty(object, property, descriptor) {
            if ((typeof object != "object" && typeof object != "function") || object === null)
                throw new TypeError(ERR_NON_OBJECT_TARGET + object);
            if ((typeof descriptor != "object" && typeof descriptor != "function") || descriptor === null)
                throw new TypeError(ERR_NON_OBJECT_DESCRIPTOR + descriptor);
            if (definePropertyFallback) {
                try {
                    return definePropertyFallback.call(Object, object, property, descriptor);
                } catch (exception) {
                }
            }
            if (owns(descriptor, "value")) {

                if (supportsAccessors && (lookupGetter(object, property) ||
                                          lookupSetter(object, property)))
                {
                    const prototype = object.__proto__;
                    object.__proto__ = prototypeOfObject;
                    delete object[property];
                    object[property] = descriptor.value;
                    object.__proto__ = prototype;
                } else {
                    object[property] = descriptor.value;
                }
            } else {
                if (!supportsAccessors)
                    throw new TypeError(ERR_ACCESSORS_NOT_SUPPORTED);
                if (owns(descriptor, "get"))
                    defineGetter(object, property, descriptor.get);
                if (owns(descriptor, "set"))
                    defineSetter(object, property, descriptor.set);
            }

            return object;
        };
    }
    if (!Object.defineProperties) {
        Object.defineProperties = function defineProperties(object, properties) {
            for (const property in properties) {
                if (owns(properties, property))
                    Object.defineProperty(object, property, properties[property]);
            }
            return object;
        };
    }
    if (!Object.seal) {
        Object.seal = function seal(object) {
            return object;
        };
    }
    if (!Object.freeze) {
        Object.freeze = function freeze(object) {
            return object;
        };
    }
    try {
        Object.freeze(() => {});
    } catch (exception) {
        Object.freeze = (function freeze(freezeObject) {
            return function freeze(object) {
                if (typeof object == "function") {
                    return object;
                } else {
                    return freezeObject(object);
                }
            };
        })(Object.freeze);
    }
    if (!Object.preventExtensions) {
        Object.preventExtensions = function preventExtensions(object) {
            return object;
        };
    }
    if (!Object.isSealed) {
        Object.isSealed = function isSealed(object) {
            return false;
        };
    }
    if (!Object.isFrozen) {
        Object.isFrozen = function isFrozen(object) {
            return false;
        };
    }
    if (!Object.isExtensible) {
        Object.isExtensible = function isExtensible(object) {
            if (Object(object) === object) {
                throw new TypeError(); // TODO message
            }
            let name = '';
            while (owns(object, name)) {
                name += '?';
            }
            object[name] = true;
            const returnValue = owns(object, name);
            delete object[name];
            return returnValue;
        };
    }
    if (!Object.keys) {
        let hasDontEnumBug = true;

        const dontEnums = [
            "toString",
            "toLocaleString",
            "valueOf",
            "hasOwnProperty",
            "isPrototypeOf",
            "propertyIsEnumerable",
            "constructor"
        ];

        const dontEnumsLength = dontEnums.length;

        for (const key in {"toString": null}) {
            hasDontEnumBug = false;
        }

        Object.keys = function keys(object) {

            if (
                (typeof object != "object" && typeof object != "function") ||
                object === null
            ) {
                throw new TypeError("Object.keys called on a non-object");
            }

            var keys = [];
            for (const name in object) {
                if (owns(object, name)) {
                    keys.push(name);
                }
            }

            if (hasDontEnumBug) {
                for (let i = 0, ii = dontEnumsLength; i < ii; i++) {
                    const dontEnum = dontEnums[i];
                    if (owns(object, dontEnum)) {
                        keys.push(dontEnum);
                    }
                }
            }
            return keys;
        };
    }
    if (!Date.now) {
        Date.now = function now() {
            return new Date().getTime();
        };
    }
    let ws = "\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003" +
        "\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028" +
        "\u2029\uFEFF";
    if (!String.prototype.trim || ws.trim()) {
        ws = `[${ws}]`;
        const trimBeginRegexp = new RegExp(`^${ws}${ws}*`);
        const trimEndRegexp = new RegExp(`${ws + ws}*$`);
        String.prototype.trim = function trim() {
            return String(this).replace(trimBeginRegexp, "").replace(trimEndRegexp, "");
        };
    }

    function toInteger(n) {
        n = +n;
        if (n !== n) { // isNaN
            n = 0;
        } else if (n !== 0 && n !== (1/0) && n !== -(1/0)) {
            n = (n > 0 || -1) * Math.floor(Math.abs(n));
        }
        return n;
    }

    function isPrimitive(input) {
        const type = typeof input;
        return (
            input === null ||
            type === "undefined" ||
            type === "boolean" ||
            type === "number" ||
            type === "string"
        );
    }

    function toPrimitive(input) {
        let val;
        let valueOf;
        let toString;
        if (isPrimitive(input)) {
            return input;
        }
        valueOf = input.valueOf;
        if (typeof valueOf === "function") {
            val = valueOf.call(input);
            if (isPrimitive(val)) {
                return val;
            }
        }
        toString = input.toString;
        if (typeof toString === "function") {
            val = toString.call(input);
            if (isPrimitive(val)) {
                return val;
            }
        }
        throw new TypeError();
    }
    var toObject = o => {
        if (o == null) { // this matches both null and undefined
            throw new TypeError(`can't convert ${o} to object`);
        }
        return Object(o);
    };
});
