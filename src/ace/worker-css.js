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

ace.define("ace/mode/css/csslint",["require","exports","module"], (require, exports, module) => {
    const parserlib = {};
    ((() => {
        function EventTarget(){
            this._listeners = {};
        }

        EventTarget.prototype = {
            constructor: EventTarget,
            addListener(type, listener) {
                if (!this._listeners[type]){
                    this._listeners[type] = [];
                }

                this._listeners[type].push(listener);
            },
            fire(event) {
                if (typeof event == "string"){
                    event = { type: event };
                }
                if (typeof event.target != "undefined"){
                    event.target = this;
                }

                if (typeof event.type == "undefined"){
                    throw new Error("Event object missing 'type' property.");
                }

                if (this._listeners[event.type]){
                    const listeners = this._listeners[event.type].concat();
                    for (let i=0, len=listeners.length; i < len; i++){
                        listeners[i].call(this, event);
                    }
                }
            },
            removeListener(type, listener) {
                if (this._listeners[type]){
                    const listeners = this._listeners[type];
                    for (let i=0, len=listeners.length; i < len; i++){
                        if (listeners[i] === listener){
                            listeners.splice(i, 1);
                            break;
                        }
                    }


                }
            }
        };
        function StringReader(text){
            this._input = text.replace(/\n\r?/g, "\n");
            this._line = 1;
            this._col = 1;
            this._cursor = 0;
        }

        StringReader.prototype = {
            constructor: StringReader,
            getCol() {
                return this._col;
            },
            getLine() {
                return this._line ;
            },
            eof() {
                return (this._cursor == this._input.length);
            },
            peek(count) {
                let c = null;
                count = (typeof count == "undefined" ? 1 : count);
                if (this._cursor < this._input.length){
                    c = this._input.charAt(this._cursor + count - 1);
                }

                return c;
            },
            read() {
                let c = null;
                if (this._cursor < this._input.length){
                    if (this._input.charAt(this._cursor) == "\n"){
                        this._line++;
                        this._col=1;
                    } else {
                        this._col++;
                    }
                    c = this._input.charAt(this._cursor++);
                }

                return c;
            },
            mark() {
                this._bookmark = {
                    cursor: this._cursor,
                    line:   this._line,
                    col:    this._col
                };
            },

            reset() {
                if (this._bookmark){
                    this._cursor = this._bookmark.cursor;
                    this._line = this._bookmark.line;
                    this._col = this._bookmark.col;
                    delete this._bookmark;
                }
            },
            readTo(pattern) {
                let buffer = "";
                let c;
                while (buffer.length < pattern.length || buffer.lastIndexOf(pattern) != buffer.length - pattern.length){
                    c = this.read();
                    if (c){
                        buffer += c;
                    } else {
                        throw new Error(`Expected "${pattern}" at line ${this._line}, col ${this._col}.`);
                    }
                }

                return buffer;
            },
            readWhile(filter) {
                let buffer = "";
                let c = this.read();

                while(c !== null && filter(c)){
                    buffer += c;
                    c = this.read();
                }

                return buffer;
            },
            readMatch(matcher) {
                const source = this._input.substring(this._cursor);
                let value = null;
                if (typeof matcher == "string"){
                    if (source.indexOf(matcher) === 0){
                        value = this.readCount(matcher.length);
                    }
                } else if (matcher instanceof RegExp){
                    if (matcher.test(source)){
                        value = this.readCount(RegExp.lastMatch.length);
                    }
                }

                return value;
            },
            readCount(count) {
                let buffer = "";

                while(count--){
                    buffer += this.read();
                }

                return buffer;
            }

        };
        function SyntaxError(message, line, col){
            this.col = col;
            this.line = line;
            this.message = message;

        }
        SyntaxError.prototype = new Error();

        class SyntaxUnit {
            constructor(text, line, col, type) {
                this.col = col;
                this.line = line;
                this.text = text;
                this.type = type;
            }

            static fromToken(token) {
                return new SyntaxUnit(token.value, token.startLine, token.startCol);
            }
        }

        SyntaxUnit.prototype = {
            constructor: SyntaxUnit,
            valueOf() {
                return this.text;
            },
            toString() {
                return this.text;
            }

        };

        class TokenStreamBase {
            constructor(input, tokenData) {
                this._reader = input ? new StringReader(input.toString()) : null;
                this._token = null;
                this._tokenData = tokenData;
                this._lt = [];
                this._ltIndex = 0;

                this._ltIndexCache = [];
            }

            static createTokenData(tokens) {
                const nameMap     = [];
                const typeMap     = {};
                const tokenData     = tokens.concat([]);
                let i            = 0;
                const len            = tokenData.length+1;

                tokenData.UNKNOWN = -1;
                tokenData.unshift({name:"EOF"});

                for (; i < len; i++){
                    nameMap.push(tokenData[i].name);
                    tokenData[tokenData[i].name] = i;
                    if (tokenData[i].text){
                        typeMap[tokenData[i].text] = i;
                    }
                }

                tokenData.name = tt => nameMap[tt];

                tokenData.type = c => typeMap[c];

                return tokenData;
            }
        }

        TokenStreamBase.prototype = {
            constructor: TokenStreamBase,
            match(tokenTypes, channel) {
                if (!(tokenTypes instanceof Array)){
                    tokenTypes = [tokenTypes];
                }

                const tt  = this.get(channel);
                let i   = 0;
                const len = tokenTypes.length;

                while(i < len){
                    if (tt == tokenTypes[i++]){
                        return true;
                    }
                }
                this.unget();
                return false;
            },
            mustMatch(tokenTypes, channel) {

                let token;
                if (!(tokenTypes instanceof Array)){
                    tokenTypes = [tokenTypes];
                }

                if (!this.match(...arguments)){
                    token = this.LT(1);
                    throw new SyntaxError(`Expected ${this._tokenData[tokenTypes[0]].name} at line ${token.startLine}, col ${token.startCol}.`, token.startLine, token.startCol);
                }
            },
            advance(tokenTypes, channel) {

                while(this.LA(0) !== 0 && !this.match(tokenTypes, channel)){
                    this.get();
                }

                return this.LA(0);
            },
            get(channel) {
                const tokenInfo   = this._tokenData;
                const reader      = this._reader;
                let value;
                let i           =0;
                const len         = tokenInfo.length;
                const found       = false;
                let token;
                let info;
                if (this._lt.length && this._ltIndex >= 0 && this._ltIndex < this._lt.length){

                    i++;
                    this._token = this._lt[this._ltIndex++];
                    info = tokenInfo[this._token.type];
                    while((info.channel !== undefined && channel !== info.channel) &&
                            this._ltIndex < this._lt.length){
                        this._token = this._lt[this._ltIndex++];
                        info = tokenInfo[this._token.type];
                        i++;
                    }
                    if ((info.channel === undefined || channel === info.channel) &&
                            this._ltIndex <= this._lt.length){
                        this._ltIndexCache.push(i);
                        return this._token.type;
                    }
                }
                token = this._getToken();
                if (token.type > -1 && !tokenInfo[token.type].hide){
                    token.channel = tokenInfo[token.type].channel;
                    this._token = token;
                    this._lt.push(token);
                    this._ltIndexCache.push(this._lt.length - this._ltIndex + i);
                    if (this._lt.length > 5){
                        this._lt.shift();
                    }
                    if (this._ltIndexCache.length > 5){
                        this._ltIndexCache.shift();
                    }
                    this._ltIndex = this._lt.length;
                }
                info = tokenInfo[token.type];
                if (info &&
                        (info.hide ||
                        (info.channel !== undefined && channel !== info.channel))){
                    return this.get(channel);
                } else {
                    return token.type;
                }
            },
            LA(index) {
                let total = index;
                let tt;
                if (index > 0){
                    if (index > 5){
                        throw new Error("Too much lookahead.");
                    }
                    while(total){
                        tt = this.get();
                        total--;
                    }
                    while(total < index){
                        this.unget();
                        total++;
                    }
                } else if (index < 0){

                    if(this._lt[this._ltIndex+index]){
                        tt = this._lt[this._ltIndex+index].type;
                    } else {
                        throw new Error("Too much lookbehind.");
                    }

                } else {
                    tt = this._token.type;
                }

                return tt;
            },
            LT(index) {
                this.LA(index);
                return this._lt[this._ltIndex+index-1];
            },
            peek() {
                return this.LA(1);
            },
            token() {
                return this._token;
            },
            tokenName(tokenType) {
                if (tokenType < 0 || tokenType > this._tokenData.length){
                    return "UNKNOWN_TOKEN";
                } else {
                    return this._tokenData[tokenType].name;
                }
            },
            tokenType(tokenName) {
                return this._tokenData[tokenName] || -1;
            },
            unget() {
                if (this._ltIndexCache.length){
                    this._ltIndex -= this._ltIndexCache.pop();//--;
                    this._token = this._lt[this._ltIndex - 1];
                } else {
                    throw new Error("Too much lookahead.");
                }
            }

        };


        parserlib.util = {
        StringReader,
        SyntaxError,
        SyntaxUnit,
        EventTarget,
        TokenStreamBase
        };
    }))();
    ((() => {
        const EventTarget = parserlib.util.EventTarget;
        const TokenStreamBase = parserlib.util.TokenStreamBase;
        const StringReader = parserlib.util.StringReader;
        const SyntaxError = parserlib.util.SyntaxError;
        const SyntaxUnit  = parserlib.util.SyntaxUnit;

        const Colors = {
            aliceblue       :"#f0f8ff",
            antiquewhite    :"#faebd7",
            aqua            :"#00ffff",
            aquamarine      :"#7fffd4",
            azure           :"#f0ffff",
            beige           :"#f5f5dc",
            bisque          :"#ffe4c4",
            black           :"#000000",
            blanchedalmond  :"#ffebcd",
            blue            :"#0000ff",
            blueviolet      :"#8a2be2",
            brown           :"#a52a2a",
            burlywood       :"#deb887",
            cadetblue       :"#5f9ea0",
            chartreuse      :"#7fff00",
            chocolate       :"#d2691e",
            coral           :"#ff7f50",
            cornflowerblue  :"#6495ed",
            cornsilk        :"#fff8dc",
            crimson         :"#dc143c",
            cyan            :"#00ffff",
            darkblue        :"#00008b",
            darkcyan        :"#008b8b",
            darkgoldenrod   :"#b8860b",
            darkgray        :"#a9a9a9",
            darkgrey        :"#a9a9a9",
            darkgreen       :"#006400",
            darkkhaki       :"#bdb76b",
            darkmagenta     :"#8b008b",
            darkolivegreen  :"#556b2f",
            darkorange      :"#ff8c00",
            darkorchid      :"#9932cc",
            darkred         :"#8b0000",
            darksalmon      :"#e9967a",
            darkseagreen    :"#8fbc8f",
            darkslateblue   :"#483d8b",
            darkslategray   :"#2f4f4f",
            darkslategrey   :"#2f4f4f",
            darkturquoise   :"#00ced1",
            darkviolet      :"#9400d3",
            deeppink        :"#ff1493",
            deepskyblue     :"#00bfff",
            dimgray         :"#696969",
            dimgrey         :"#696969",
            dodgerblue      :"#1e90ff",
            firebrick       :"#b22222",
            floralwhite     :"#fffaf0",
            forestgreen     :"#228b22",
            fuchsia         :"#ff00ff",
            gainsboro       :"#dcdcdc",
            ghostwhite      :"#f8f8ff",
            gold            :"#ffd700",
            goldenrod       :"#daa520",
            gray            :"#808080",
            grey            :"#808080",
            green           :"#008000",
            greenyellow     :"#adff2f",
            honeydew        :"#f0fff0",
            hotpink         :"#ff69b4",
            indianred       :"#cd5c5c",
            indigo          :"#4b0082",
            ivory           :"#fffff0",
            khaki           :"#f0e68c",
            lavender        :"#e6e6fa",
            lavenderblush   :"#fff0f5",
            lawngreen       :"#7cfc00",
            lemonchiffon    :"#fffacd",
            lightblue       :"#add8e6",
            lightcoral      :"#f08080",
            lightcyan       :"#e0ffff",
            lightgoldenrodyellow  :"#fafad2",
            lightgray       :"#d3d3d3",
            lightgrey       :"#d3d3d3",
            lightgreen      :"#90ee90",
            lightpink       :"#ffb6c1",
            lightsalmon     :"#ffa07a",
            lightseagreen   :"#20b2aa",
            lightskyblue    :"#87cefa",
            lightslategray  :"#778899",
            lightslategrey  :"#778899",
            lightsteelblue  :"#b0c4de",
            lightyellow     :"#ffffe0",
            lime            :"#00ff00",
            limegreen       :"#32cd32",
            linen           :"#faf0e6",
            magenta         :"#ff00ff",
            maroon          :"#800000",
            mediumaquamarine:"#66cdaa",
            mediumblue      :"#0000cd",
            mediumorchid    :"#ba55d3",
            mediumpurple    :"#9370d8",
            mediumseagreen  :"#3cb371",
            mediumslateblue :"#7b68ee",
            mediumspringgreen   :"#00fa9a",
            mediumturquoise :"#48d1cc",
            mediumvioletred :"#c71585",
            midnightblue    :"#191970",
            mintcream       :"#f5fffa",
            mistyrose       :"#ffe4e1",
            moccasin        :"#ffe4b5",
            navajowhite     :"#ffdead",
            navy            :"#000080",
            oldlace         :"#fdf5e6",
            olive           :"#808000",
            olivedrab       :"#6b8e23",
            orange          :"#ffa500",
            orangered       :"#ff4500",
            orchid          :"#da70d6",
            palegoldenrod   :"#eee8aa",
            palegreen       :"#98fb98",
            paleturquoise   :"#afeeee",
            palevioletred   :"#d87093",
            papayawhip      :"#ffefd5",
            peachpuff       :"#ffdab9",
            peru            :"#cd853f",
            pink            :"#ffc0cb",
            plum            :"#dda0dd",
            powderblue      :"#b0e0e6",
            purple          :"#800080",
            red             :"#ff0000",
            rosybrown       :"#bc8f8f",
            royalblue       :"#4169e1",
            saddlebrown     :"#8b4513",
            salmon          :"#fa8072",
            sandybrown      :"#f4a460",
            seagreen        :"#2e8b57",
            seashell        :"#fff5ee",
            sienna          :"#a0522d",
            silver          :"#c0c0c0",
            skyblue         :"#87ceeb",
            slateblue       :"#6a5acd",
            slategray       :"#708090",
            slategrey       :"#708090",
            snow            :"#fffafa",
            springgreen     :"#00ff7f",
            steelblue       :"#4682b4",
            tan             :"#d2b48c",
            teal            :"#008080",
            thistle         :"#d8bfd8",
            tomato          :"#ff6347",
            turquoise       :"#40e0d0",
            violet          :"#ee82ee",
            wheat           :"#f5deb3",
            white           :"#ffffff",
            whitesmoke      :"#f5f5f5",
            yellow          :"#ffff00",
            yellowgreen     :"#9acd32",
            activeBorder        :"Active window border.",
            activecaption       :"Active window caption.",
            appworkspace        :"Background color of multiple document interface.",
            background          :"Desktop background.",
            buttonface          :"The face background color for 3-D elements that appear 3-D due to one layer of surrounding border.",
            buttonhighlight     :"The color of the border facing the light source for 3-D elements that appear 3-D due to one layer of surrounding border.",
            buttonshadow        :"The color of the border away from the light source for 3-D elements that appear 3-D due to one layer of surrounding border.",
            buttontext          :"Text on push buttons.",
            captiontext         :"Text in caption, size box, and scrollbar arrow box.",
            graytext            :"Grayed (disabled) text. This color is set to #000 if the current display driver does not support a solid gray color.",
            greytext            :"Greyed (disabled) text. This color is set to #000 if the current display driver does not support a solid grey color.",
            highlight           :"Item(s) selected in a control.",
            highlighttext       :"Text of item(s) selected in a control.",
            inactiveborder      :"Inactive window border.",
            inactivecaption     :"Inactive window caption.",
            inactivecaptiontext :"Color of text in an inactive caption.",
            infobackground      :"Background color for tooltip controls.",
            infotext            :"Text color for tooltip controls.",
            menu                :"Menu background.",
            menutext            :"Text in menus.",
            scrollbar           :"Scroll bar gray area.",
            threeddarkshadow    :"The color of the darker (generally outer) of the two borders away from the light source for 3-D elements that appear 3-D due to two concentric layers of surrounding border.",
            threedface          :"The face background color for 3-D elements that appear 3-D due to two concentric layers of surrounding border.",
            threedhighlight     :"The color of the lighter (generally outer) of the two borders facing the light source for 3-D elements that appear 3-D due to two concentric layers of surrounding border.",
            threedlightshadow   :"The color of the darker (generally inner) of the two borders facing the light source for 3-D elements that appear 3-D due to two concentric layers of surrounding border.",
            threedshadow        :"The color of the lighter (generally inner) of the two borders away from the light source for 3-D elements that appear 3-D due to two concentric layers of surrounding border.",
            window              :"Window background.",
            windowframe         :"Window frame.",
            windowtext          :"Text in windows."
        };
        function Combinator(text, line, col){

            SyntaxUnit.call(this, text, line, col, Parser.COMBINATOR_TYPE);
            this.type = "unknown";
            if (/^\s+$/.test(text)){
                this.type = "descendant";
            } else if (text == ">"){
                this.type = "child";
            } else if (text == "+"){
                this.type = "adjacent-sibling";
            } else if (text == "~"){
                this.type = "sibling";
            }

        }

        Combinator.prototype = new SyntaxUnit();
        Combinator.prototype.constructor = Combinator;
        function MediaFeature(name, value){

            SyntaxUnit.call(this, `(${name}${value !== null ? ":" + value : ""})`, name.startLine, name.startCol, Parser.MEDIA_FEATURE_TYPE);
            this.name = name;
            this.value = value;
        }

        MediaFeature.prototype = new SyntaxUnit();
        MediaFeature.prototype.constructor = MediaFeature;
        function MediaQuery(modifier, mediaType, features, line, col){

            SyntaxUnit.call(this, (modifier ? modifier + " ": "") + (mediaType ? mediaType : "") + (mediaType && features.length > 0 ? " and " : "") + features.join(" and "), line, col, Parser.MEDIA_QUERY_TYPE);
            this.modifier = modifier;
            this.mediaType = mediaType;
            this.features = features;

        }

        MediaQuery.prototype = new SyntaxUnit();
        MediaQuery.prototype.constructor = MediaQuery;
        function Parser(options){
            EventTarget.call(this);


            this.options = options || {};

            this._tokenStream = null;
        }
        Parser.DEFAULT_TYPE = 0;
        Parser.COMBINATOR_TYPE = 1;
        Parser.MEDIA_FEATURE_TYPE = 2;
        Parser.MEDIA_QUERY_TYPE = 3;
        Parser.PROPERTY_NAME_TYPE = 4;
        Parser.PROPERTY_VALUE_TYPE = 5;
        Parser.PROPERTY_VALUE_PART_TYPE = 6;
        Parser.SELECTOR_TYPE = 7;
        Parser.SELECTOR_PART_TYPE = 8;
        Parser.SELECTOR_SUB_PART_TYPE = 9;

        Parser.prototype = (() => {
            const //new prototype
            proto = new EventTarget();

            let prop;

            const additions =  {
                constructor: Parser,
                DEFAULT_TYPE : 0,
                COMBINATOR_TYPE : 1,
                MEDIA_FEATURE_TYPE : 2,
                MEDIA_QUERY_TYPE : 3,
                PROPERTY_NAME_TYPE : 4,
                PROPERTY_VALUE_TYPE : 5,
                PROPERTY_VALUE_PART_TYPE : 6,
                SELECTOR_TYPE : 7,
                SELECTOR_PART_TYPE : 8,
                SELECTOR_SUB_PART_TYPE : 9,

                _stylesheet() {
                    const tokenStream = this._tokenStream;
                    const charset     = null;
                    let count;
                    let token;
                    let tt;

                    this.fire("startstylesheet");
                    this._charset();

                    this._skipCruft();
                    while (tokenStream.peek() == Tokens.IMPORT_SYM){
                        this._import();
                        this._skipCruft();
                    }
                    while (tokenStream.peek() == Tokens.NAMESPACE_SYM){
                        this._namespace();
                        this._skipCruft();
                    }
                    tt = tokenStream.peek();
                    while(tt > Tokens.EOF){

                        try {

                            switch(tt){
                                case Tokens.MEDIA_SYM:
                                    this._media();
                                    this._skipCruft();
                                    break;
                                case Tokens.PAGE_SYM:
                                    this._page();
                                    this._skipCruft();
                                    break;
                                case Tokens.FONT_FACE_SYM:
                                    this._font_face();
                                    this._skipCruft();
                                    break;
                                case Tokens.KEYFRAMES_SYM:
                                    this._keyframes();
                                    this._skipCruft();
                                    break;
                                case Tokens.VIEWPORT_SYM:
                                    this._viewport();
                                    this._skipCruft();
                                    break;
                                case Tokens.UNKNOWN_SYM:  //unknown @ rule
                                    tokenStream.get();
                                    if (!this.options.strict){
                                        this.fire({
                                            type:       "error",
                                            error:      null,
                                            message:    `Unknown @ rule: ${tokenStream.LT(0).value}.`,
                                            line:       tokenStream.LT(0).startLine,
                                            col:        tokenStream.LT(0).startCol
                                        });
                                        count=0;
                                        while (tokenStream.advance([Tokens.LBRACE, Tokens.RBRACE]) == Tokens.LBRACE){
                                            count++;    //keep track of nesting depth
                                        }

                                        while(count){
                                            tokenStream.advance([Tokens.RBRACE]);
                                            count--;
                                        }

                                    } else {
                                        throw new SyntaxError("Unknown @ rule.", tokenStream.LT(0).startLine, tokenStream.LT(0).startCol);
                                    }
                                    break;
                                case Tokens.S:
                                    this._readWhitespace();
                                    break;
                                default:
                                    if(!this._ruleset()){
                                        switch(tt){
                                            case Tokens.CHARSET_SYM:
                                                token = tokenStream.LT(1);
                                                this._charset(false);
                                                throw new SyntaxError("@charset not allowed here.", token.startLine, token.startCol);
                                            case Tokens.IMPORT_SYM:
                                                token = tokenStream.LT(1);
                                                this._import(false);
                                                throw new SyntaxError("@import not allowed here.", token.startLine, token.startCol);
                                            case Tokens.NAMESPACE_SYM:
                                                token = tokenStream.LT(1);
                                                this._namespace(false);
                                                throw new SyntaxError("@namespace not allowed here.", token.startLine, token.startCol);
                                            default:
                                                tokenStream.get();  //get the last token
                                                this._unexpectedToken(tokenStream.token());
                                        }

                                    }
                            }
                        } catch(ex) {
                            if (ex instanceof SyntaxError && !this.options.strict){
                                this.fire({
                                    type:       "error",
                                    error:      ex,
                                    message:    ex.message,
                                    line:       ex.line,
                                    col:        ex.col
                                });
                            } else {
                                throw ex;
                            }
                        }

                        tt = tokenStream.peek();
                    }

                    if (tt != Tokens.EOF){
                        this._unexpectedToken(tokenStream.token());
                    }

                    this.fire("endstylesheet");
                },

                _charset(emit) {
                    const tokenStream = this._tokenStream;
                    let charset;
                    let token;
                    let line;
                    let col;

                    if (tokenStream.match(Tokens.CHARSET_SYM)){
                        line = tokenStream.token().startLine;
                        col = tokenStream.token().startCol;

                        this._readWhitespace();
                        tokenStream.mustMatch(Tokens.STRING);

                        token = tokenStream.token();
                        charset = token.value;

                        this._readWhitespace();
                        tokenStream.mustMatch(Tokens.SEMICOLON);

                        if (emit !== false){
                            this.fire({
                                type:   "charset",
                                charset,
                                line,
                                col
                            });
                        }
                    }
                },

                _import(emit) {
                    const tokenStream = this._tokenStream;
                    let tt;
                    let uri;
                    let importToken;
                    let mediaList   = [];
                    tokenStream.mustMatch(Tokens.IMPORT_SYM);
                    importToken = tokenStream.token();
                    this._readWhitespace();

                    tokenStream.mustMatch([Tokens.STRING, Tokens.URI]);
                    uri = tokenStream.token().value.replace(/^(?:url\()?["']?([^"']+?)["']?\)?$/, "$1");

                    this._readWhitespace();

                    mediaList = this._media_query_list();
                    tokenStream.mustMatch(Tokens.SEMICOLON);
                    this._readWhitespace();

                    if (emit !== false){
                        this.fire({
                            type:   "import",
                            uri,
                            media:  mediaList,
                            line:   importToken.startLine,
                            col:    importToken.startCol
                        });
                    }
                },

                _namespace(emit) {
                    const tokenStream = this._tokenStream;
                    let line;
                    let col;
                    let prefix;
                    let uri;
                    tokenStream.mustMatch(Tokens.NAMESPACE_SYM);
                    line = tokenStream.token().startLine;
                    col = tokenStream.token().startCol;
                    this._readWhitespace();
                    if (tokenStream.match(Tokens.IDENT)){
                        prefix = tokenStream.token().value;
                        this._readWhitespace();
                    }

                    tokenStream.mustMatch([Tokens.STRING, Tokens.URI]);
                    uri = tokenStream.token().value.replace(/(?:url\()?["']([^"']+)["']\)?/, "$1");

                    this._readWhitespace();
                    tokenStream.mustMatch(Tokens.SEMICOLON);
                    this._readWhitespace();

                    if (emit !== false){
                        this.fire({
                            type:   "namespace",
                            prefix,
                            uri,
                            line,
                            col
                        });
                    }
                },

                _media() {
                    const tokenStream     = this._tokenStream;//       = [];
                    let line;
                    let col;
                    let mediaList;
                    tokenStream.mustMatch(Tokens.MEDIA_SYM);
                    line = tokenStream.token().startLine;
                    col = tokenStream.token().startCol;

                    this._readWhitespace();

                    mediaList = this._media_query_list();

                    tokenStream.mustMatch(Tokens.LBRACE);
                    this._readWhitespace();

                    this.fire({
                        type:   "startmedia",
                        media:  mediaList,
                        line,
                        col
                    });

                    while(true) {
                        if (tokenStream.peek() == Tokens.PAGE_SYM){
                            this._page();
                        } else if (tokenStream.peek() == Tokens.FONT_FACE_SYM){
                            this._font_face();
                        } else if (tokenStream.peek() == Tokens.VIEWPORT_SYM){
                            this._viewport();
                        } else if (!this._ruleset()){
                            break;
                        }
                    }

                    tokenStream.mustMatch(Tokens.RBRACE);
                    this._readWhitespace();

                    this.fire({
                        type:   "endmedia",
                        media:  mediaList,
                        line,
                        col
                    });
                },
                _media_query_list() {
                    const tokenStream = this._tokenStream;
                    const mediaList   = [];


                    this._readWhitespace();

                    if (tokenStream.peek() == Tokens.IDENT || tokenStream.peek() == Tokens.LPAREN){
                        mediaList.push(this._media_query());
                    }

                    while(tokenStream.match(Tokens.COMMA)){
                        this._readWhitespace();
                        mediaList.push(this._media_query());
                    }

                    return mediaList;
                },
                _media_query() {
                    const tokenStream = this._tokenStream;
                    let type        = null;
                    let ident       = null;
                    let token       = null;
                    const expressions = [];

                    if (tokenStream.match(Tokens.IDENT)){
                        ident = tokenStream.token().value.toLowerCase();
                        if (ident != "only" && ident != "not"){
                            tokenStream.unget();
                            ident = null;
                        } else {
                            token = tokenStream.token();
                        }
                    }

                    this._readWhitespace();

                    if (tokenStream.peek() == Tokens.IDENT){
                        type = this._media_type();
                        if (token === null){
                            token = tokenStream.token();
                        }
                    } else if (tokenStream.peek() == Tokens.LPAREN){
                        if (token === null){
                            token = tokenStream.LT(1);
                        }
                        expressions.push(this._media_expression());
                    }

                    if (type === null && expressions.length === 0){
                        return null;
                    } else {
                        this._readWhitespace();
                        while (tokenStream.match(Tokens.IDENT)){
                            if (tokenStream.token().value.toLowerCase() != "and"){
                                this._unexpectedToken(tokenStream.token());
                            }

                            this._readWhitespace();
                            expressions.push(this._media_expression());
                        }
                    }

                    return new MediaQuery(ident, type, expressions, token.startLine, token.startCol);
                },
                _media_type() {
                    return this._media_feature();
                },
                _media_expression() {
                    const tokenStream = this._tokenStream;
                    let feature     = null;
                    let token;
                    let expression  = null;

                    tokenStream.mustMatch(Tokens.LPAREN);

                    feature = this._media_feature();
                    this._readWhitespace();

                    if (tokenStream.match(Tokens.COLON)){
                        this._readWhitespace();
                        token = tokenStream.LT(1);
                        expression = this._expression();
                    }

                    tokenStream.mustMatch(Tokens.RPAREN);
                    this._readWhitespace();

                    return new MediaFeature(feature, (expression ? new SyntaxUnit(expression, token.startLine, token.startCol) : null));
                },
                _media_feature() {
                    const tokenStream = this._tokenStream;

                    tokenStream.mustMatch(Tokens.IDENT);

                    return SyntaxUnit.fromToken(tokenStream.token());
                },
                _page() {
                    const tokenStream = this._tokenStream;
                    let line;
                    let col;
                    let identifier  = null;
                    let pseudoPage  = null;
                    tokenStream.mustMatch(Tokens.PAGE_SYM);
                    line = tokenStream.token().startLine;
                    col = tokenStream.token().startCol;

                    this._readWhitespace();

                    if (tokenStream.match(Tokens.IDENT)){
                        identifier = tokenStream.token().value;
                        if (identifier.toLowerCase() === "auto"){
                            this._unexpectedToken(tokenStream.token());
                        }
                    }
                    if (tokenStream.peek() == Tokens.COLON){
                        pseudoPage = this._pseudo_page();
                    }

                    this._readWhitespace();

                    this.fire({
                        type:   "startpage",
                        id:     identifier,
                        pseudo: pseudoPage,
                        line,
                        col
                    });

                    this._readDeclarations(true, true);

                    this.fire({
                        type:   "endpage",
                        id:     identifier,
                        pseudo: pseudoPage,
                        line,
                        col
                    });
                },
                _margin() {
                    const tokenStream = this._tokenStream;
                    let line;
                    let col;
                    const marginSym   = this._margin_sym();

                    if (marginSym){
                        line = tokenStream.token().startLine;
                        col = tokenStream.token().startCol;

                        this.fire({
                            type: "startpagemargin",
                            margin: marginSym,
                            line,
                            col
                        });

                        this._readDeclarations(true);

                        this.fire({
                            type: "endpagemargin",
                            margin: marginSym,
                            line,
                            col
                        });
                        return true;
                    } else {
                        return false;
                    }
                },
                _margin_sym() {

                    const tokenStream = this._tokenStream;

                    if(tokenStream.match([Tokens.TOPLEFTCORNER_SYM, Tokens.TOPLEFT_SYM,
                            Tokens.TOPCENTER_SYM, Tokens.TOPRIGHT_SYM, Tokens.TOPRIGHTCORNER_SYM,
                            Tokens.BOTTOMLEFTCORNER_SYM, Tokens.BOTTOMLEFT_SYM,
                            Tokens.BOTTOMCENTER_SYM, Tokens.BOTTOMRIGHT_SYM,
                            Tokens.BOTTOMRIGHTCORNER_SYM, Tokens.LEFTTOP_SYM,
                            Tokens.LEFTMIDDLE_SYM, Tokens.LEFTBOTTOM_SYM, Tokens.RIGHTTOP_SYM,
                            Tokens.RIGHTMIDDLE_SYM, Tokens.RIGHTBOTTOM_SYM]))
                    {
                        return SyntaxUnit.fromToken(tokenStream.token());
                    } else {
                        return null;
                    }

                },

                _pseudo_page() {

                    const tokenStream = this._tokenStream;

                    tokenStream.mustMatch(Tokens.COLON);
                    tokenStream.mustMatch(Tokens.IDENT);

                    return tokenStream.token().value;
                },

                _font_face() {
                    const tokenStream = this._tokenStream;
                    let line;
                    let col;
                    tokenStream.mustMatch(Tokens.FONT_FACE_SYM);
                    line = tokenStream.token().startLine;
                    col = tokenStream.token().startCol;

                    this._readWhitespace();

                    this.fire({
                        type:   "startfontface",
                        line,
                        col
                    });

                    this._readDeclarations(true);

                    this.fire({
                        type:   "endfontface",
                        line,
                        col
                    });
                },

                _viewport() {
                    const tokenStream = this._tokenStream;
                    let line;
                    let col;

                    tokenStream.mustMatch(Tokens.VIEWPORT_SYM);
                    line = tokenStream.token().startLine;
                    col = tokenStream.token().startCol;

                    this._readWhitespace();

                    this.fire({
                        type:   "startviewport",
                        line,
                        col
                    });

                    this._readDeclarations(true);

                    this.fire({
                        type:   "endviewport",
                        line,
                        col
                    });
                },

                _operator(inFunction) {
                    const tokenStream = this._tokenStream;
                    let token       = null;

                    if (tokenStream.match([Tokens.SLASH, Tokens.COMMA]) ||
                        (inFunction && tokenStream.match([Tokens.PLUS, Tokens.STAR, Tokens.MINUS]))){
                        token =  tokenStream.token();
                        this._readWhitespace();
                    }
                    return token ? PropertyValuePart.fromToken(token) : null;
                },

                _combinator() {
                    const tokenStream = this._tokenStream;
                    let value       = null;
                    let token;

                    if(tokenStream.match([Tokens.PLUS, Tokens.GREATER, Tokens.TILDE])){
                        token = tokenStream.token();
                        value = new Combinator(token.value, token.startLine, token.startCol);
                        this._readWhitespace();
                    }

                    return value;
                },

                _unary_operator() {

                    const tokenStream = this._tokenStream;

                    if (tokenStream.match([Tokens.MINUS, Tokens.PLUS])){
                        return tokenStream.token().value;
                    } else {
                        return null;
                    }
                },

                _property() {
                    const tokenStream = this._tokenStream;
                    let value       = null;
                    let hack        = null;
                    let tokenValue;
                    let token;
                    let line;
                    let col;
                    if (tokenStream.peek() == Tokens.STAR && this.options.starHack){
                        tokenStream.get();
                        token = tokenStream.token();
                        hack = token.value;
                        line = token.startLine;
                        col = token.startCol;
                    }

                    if(tokenStream.match(Tokens.IDENT)){
                        token = tokenStream.token();
                        tokenValue = token.value;
                        if (tokenValue.charAt(0) == "_" && this.options.underscoreHack){
                            hack = "_";
                            tokenValue = tokenValue.substring(1);
                        }

                        value = new PropertyName(tokenValue, hack, (line||token.startLine), (col||token.startCol));
                        this._readWhitespace();
                    }

                    return value;
                },
                _ruleset() {
                    const tokenStream = this._tokenStream;
                    let tt;
                    let selectors;
                    try {
                        selectors = this._selectors_group();
                    } catch (ex){
                        if (ex instanceof SyntaxError && !this.options.strict){
                            this.fire({
                                type:       "error",
                                error:      ex,
                                message:    ex.message,
                                line:       ex.line,
                                col:        ex.col
                            });
                            tt = tokenStream.advance([Tokens.RBRACE]);
                            if (tt == Tokens.RBRACE){
                            } else {
                                throw ex;
                            }

                        } else {
                            throw ex;
                        }
                        return true;
                    }
                    if (selectors){

                        this.fire({
                            type:       "startrule",
                            selectors,
                            line:       selectors[0].line,
                            col:        selectors[0].col
                        });

                        this._readDeclarations(true);

                        this.fire({
                            type:       "endrule",
                            selectors,
                            line:       selectors[0].line,
                            col:        selectors[0].col
                        });

                    }

                    return selectors;
                },
                _selectors_group() {
                    const tokenStream = this._tokenStream;
                    const selectors   = [];
                    let selector;

                    selector = this._selector();
                    if (selector !== null){

                        selectors.push(selector);
                        while(tokenStream.match(Tokens.COMMA)){
                            this._readWhitespace();
                            selector = this._selector();
                            if (selector !== null){
                                selectors.push(selector);
                            } else {
                                this._unexpectedToken(tokenStream.LT(1));
                            }
                        }
                    }

                    return selectors.length ? selectors : null;
                },
                _selector() {
                    const tokenStream = this._tokenStream;
                    const selector    = [];
                    let nextSelector = null;
                    let combinator  = null;
                    let ws          = null;
                    nextSelector = this._simple_selector_sequence();
                    if (nextSelector === null){
                        return null;
                    }

                    selector.push(nextSelector);

                    do {
                        combinator = this._combinator();

                        if (combinator !== null){
                            selector.push(combinator);
                            nextSelector = this._simple_selector_sequence();
                            if (nextSelector === null){
                                this._unexpectedToken(tokenStream.LT(1));
                            } else {
                                selector.push(nextSelector);
                            }
                        } else {
                            if (this._readWhitespace()){
                                ws = new Combinator(tokenStream.token().value, tokenStream.token().startLine, tokenStream.token().startCol);
                                combinator = this._combinator();
                                nextSelector = this._simple_selector_sequence();
                                if (nextSelector === null){
                                    if (combinator !== null){
                                        this._unexpectedToken(tokenStream.LT(1));
                                    }
                                } else {

                                    if (combinator !== null){
                                        selector.push(combinator);
                                    } else {
                                        selector.push(ws);
                                    }

                                    selector.push(nextSelector);
                                }
                            } else {
                                break;
                            }

                        }
                    } while(true);

                    return new Selector(selector, selector[0].line, selector[0].col);
                },
                _simple_selector_sequence() {
                    const tokenStream = this._tokenStream;
                    let elementName = null;
                    const modifiers   = [];
                    let selectorText= "";

                    const components  = [
                        () => tokenStream.match(Tokens.HASH) ?
                                new SelectorSubPart(tokenStream.token().value, "id", tokenStream.token().startLine, tokenStream.token().startCol) :
                                null,
                        this._class,
                        this._attrib,
                        this._pseudo,
                        this._negation
                    ];

                    let i           = 0;
                    const len         = components.length;
                    let component   = null;
                    const found       = false;
                    let line;
                    let col;
                    line = tokenStream.LT(1).startLine;
                    col = tokenStream.LT(1).startCol;

                    elementName = this._type_selector();
                    if (!elementName){
                        elementName = this._universal();
                    }

                    if (elementName !== null){
                        selectorText += elementName;
                    }

                    while(true){
                        if (tokenStream.peek() === Tokens.S){
                            break;
                        }
                        while(i < len && component === null){
                            component = components[i++].call(this);
                        }

                        if (component === null){
                            if (selectorText === ""){
                                return null;
                            } else {
                                break;
                            }
                        } else {
                            i = 0;
                            modifiers.push(component);
                            selectorText += component.toString();
                            component = null;
                        }
                    }


                    return selectorText !== "" ?
                            new SelectorPart(elementName, modifiers, selectorText, line, col) :
                            null;
                },
                _type_selector() {
                    const tokenStream = this._tokenStream;
                    const ns          = this._namespace_prefix();
                    const elementName = this._element_name();

                    if (!elementName){
                        if (ns){
                            tokenStream.unget();
                            if (ns.length > 1){
                                tokenStream.unget();
                            }
                        }

                        return null;
                    } else {
                        if (ns){
                            elementName.text = ns + elementName.text;
                            elementName.col -= ns.length;
                        }
                        return elementName;
                    }
                },
                _class() {
                    const tokenStream = this._tokenStream;
                    let token;

                    if (tokenStream.match(Tokens.DOT)){
                        tokenStream.mustMatch(Tokens.IDENT);
                        token = tokenStream.token();
                        return new SelectorSubPart(`.${token.value}`, "class", token.startLine, token.startCol - 1);
                    } else {
                        return null;
                    }
                },
                _element_name() {
                    const tokenStream = this._tokenStream;
                    let token;

                    if (tokenStream.match(Tokens.IDENT)){
                        token = tokenStream.token();
                        return new SelectorSubPart(token.value, "elementName", token.startLine, token.startCol);

                    } else {
                        return null;
                    }
                },
                _namespace_prefix() {
                    const tokenStream = this._tokenStream;
                    let value       = "";
                    if (tokenStream.LA(1) === Tokens.PIPE || tokenStream.LA(2) === Tokens.PIPE){

                        if(tokenStream.match([Tokens.IDENT, Tokens.STAR])){
                            value += tokenStream.token().value;
                        }

                        tokenStream.mustMatch(Tokens.PIPE);
                        value += "|";

                    }

                    return value.length ? value : null;
                },
                _universal() {
                    const tokenStream = this._tokenStream;
                    let value       = "";
                    let ns;

                    ns = this._namespace_prefix();
                    if(ns){
                        value += ns;
                    }

                    if(tokenStream.match(Tokens.STAR)){
                        value += "*";
                    }

                    return value.length ? value : null;
                },
                _attrib() {
                    const tokenStream = this._tokenStream;
                    let value       = null;
                    let ns;
                    let token;

                    if (tokenStream.match(Tokens.LBRACKET)){
                        token = tokenStream.token();
                        value = token.value;
                        value += this._readWhitespace();

                        ns = this._namespace_prefix();

                        if (ns){
                            value += ns;
                        }

                        tokenStream.mustMatch(Tokens.IDENT);
                        value += tokenStream.token().value;
                        value += this._readWhitespace();

                        if(tokenStream.match([Tokens.PREFIXMATCH, Tokens.SUFFIXMATCH, Tokens.SUBSTRINGMATCH,
                                Tokens.EQUALS, Tokens.INCLUDES, Tokens.DASHMATCH])){

                            value += tokenStream.token().value;
                            value += this._readWhitespace();

                            tokenStream.mustMatch([Tokens.IDENT, Tokens.STRING]);
                            value += tokenStream.token().value;
                            value += this._readWhitespace();
                        }

                        tokenStream.mustMatch(Tokens.RBRACKET);

                        return new SelectorSubPart(`${value}]`, "attribute", token.startLine, token.startCol);
                    } else {
                        return null;
                    }
                },
                _pseudo() {
                    const tokenStream = this._tokenStream;
                    let pseudo      = null;
                    let colons      = ":";
                    let line;
                    let col;

                    if (tokenStream.match(Tokens.COLON)){

                        if (tokenStream.match(Tokens.COLON)){
                            colons += ":";
                        }

                        if (tokenStream.match(Tokens.IDENT)){
                            pseudo = tokenStream.token().value;
                            line = tokenStream.token().startLine;
                            col = tokenStream.token().startCol - colons.length;
                        } else if (tokenStream.peek() == Tokens.FUNCTION){
                            line = tokenStream.LT(1).startLine;
                            col = tokenStream.LT(1).startCol - colons.length;
                            pseudo = this._functional_pseudo();
                        }

                        if (pseudo){
                            pseudo = new SelectorSubPart(colons + pseudo, "pseudo", line, col);
                        }
                    }

                    return pseudo;
                },
                _functional_pseudo() {
                    const tokenStream = this._tokenStream;
                    let value = null;

                    if(tokenStream.match(Tokens.FUNCTION)){
                        value = tokenStream.token().value;
                        value += this._readWhitespace();
                        value += this._expression();
                        tokenStream.mustMatch(Tokens.RPAREN);
                        value += ")";
                    }

                    return value;
                },
                _expression() {
                    const tokenStream = this._tokenStream;
                    let value       = "";

                    while(tokenStream.match([Tokens.PLUS, Tokens.MINUS, Tokens.DIMENSION,
                            Tokens.NUMBER, Tokens.STRING, Tokens.IDENT, Tokens.LENGTH,
                            Tokens.FREQ, Tokens.ANGLE, Tokens.TIME,
                            Tokens.RESOLUTION, Tokens.SLASH])){

                        value += tokenStream.token().value;
                        value += this._readWhitespace();
                    }

                    return value.length ? value : null;
                },
                _negation() {
                    const tokenStream = this._tokenStream;
                    let line;
                    let col;
                    let value       = "";
                    let arg;
                    let subpart     = null;

                    if (tokenStream.match(Tokens.NOT)){
                        value = tokenStream.token().value;
                        line = tokenStream.token().startLine;
                        col = tokenStream.token().startCol;
                        value += this._readWhitespace();
                        arg = this._negation_arg();
                        value += arg;
                        value += this._readWhitespace();
                        tokenStream.match(Tokens.RPAREN);
                        value += tokenStream.token().value;

                        subpart = new SelectorSubPart(value, "not", line, col);
                        subpart.args.push(arg);
                    }

                    return subpart;
                },
                _negation_arg() {
                    const tokenStream = this._tokenStream;

                    const args        = [
                        this._type_selector,
                        this._universal,
                        () => tokenStream.match(Tokens.HASH) ?
                                new SelectorSubPart(tokenStream.token().value, "id", tokenStream.token().startLine, tokenStream.token().startCol) :
                                null,
                        this._class,
                        this._attrib,
                        this._pseudo
                    ];

                    let arg         = null;
                    let i           = 0;
                    const len         = args.length;
                    let elementName;
                    let line;
                    let col;
                    let part;

                    line = tokenStream.LT(1).startLine;
                    col = tokenStream.LT(1).startCol;

                    while(i < len && arg === null){

                        arg = args[i].call(this);
                        i++;
                    }
                    if (arg === null){
                        this._unexpectedToken(tokenStream.LT(1));
                    }
                    if (arg.type == "elementName"){
                        part = new SelectorPart(arg, [], arg.toString(), line, col);
                    } else {
                        part = new SelectorPart(null, [arg], arg.toString(), line, col);
                    }

                    return part;
                },

                _declaration() {
                    const tokenStream = this._tokenStream;
                    let property    = null;
                    let expr        = null;
                    let prio        = null;
                    const error       = null;
                    let invalid     = null;
                    let propertyName= "";

                    property = this._property();
                    if (property !== null){

                        tokenStream.mustMatch(Tokens.COLON);
                        this._readWhitespace();

                        expr = this._expr();
                        if (!expr || expr.length === 0){
                            this._unexpectedToken(tokenStream.LT(1));
                        }

                        prio = this._prio();
                        propertyName = property.toString();
                        if (this.options.starHack && property.hack == "*" ||
                                this.options.underscoreHack && property.hack == "_") {

                            propertyName = property.text;
                        }

                        try {
                            this._validateProperty(propertyName, expr);
                        } catch (ex) {
                            invalid = ex;
                        }

                        this.fire({
                            type:       "property",
                            property,
                            value:      expr,
                            important:  prio,
                            line:       property.line,
                            col:        property.col,
                            invalid
                        });

                        return true;
                    } else {
                        return false;
                    }
                },

                _prio() {
                    const tokenStream = this._tokenStream;
                    const result      = tokenStream.match(Tokens.IMPORTANT_SYM);

                    this._readWhitespace();
                    return result;
                },

                _expr(inFunction) {
                    const tokenStream = this._tokenStream;
                    const values      = [];
                    let value       = null;
                    let operator    = null;

                    value = this._term(inFunction);
                    if (value !== null){

                        values.push(value);

                        do {
                            operator = this._operator(inFunction);
                            if (operator){
                                values.push(operator);
                            } /*else {
                                values.push(new PropertyValue(valueParts, valueParts[0].line, valueParts[0].col));
                                valueParts = [];
                            }*/

                            value = this._term(inFunction);

                            if (value === null){
                                break;
                            } else {
                                values.push(value);
                            }
                        } while(true);
                    }

                    return values.length > 0 ? new PropertyValue(values, values[0].line, values[0].col) : null;
                },

                _term(inFunction) {
                    const tokenStream = this._tokenStream;
                    let unary       = null;
                    let value       = null;
                    let endChar     = null;
                    let token;
                    let line;
                    let col;
                    unary = this._unary_operator();
                    if (unary !== null){
                        line = tokenStream.token().startLine;
                        col = tokenStream.token().startCol;
                    }
                    if (tokenStream.peek() == Tokens.IE_FUNCTION && this.options.ieFilters){

                        value = this._ie_function();
                        if (unary === null){
                            line = tokenStream.token().startLine;
                            col = tokenStream.token().startCol;
                        }
                    } else if (inFunction && tokenStream.match([Tokens.LPAREN, Tokens.LBRACE, Tokens.LBRACKET])){

                        token = tokenStream.token();
                        endChar = token.endChar;
                        value = token.value + this._expr(inFunction).text;
                        if (unary === null){
                            line = tokenStream.token().startLine;
                            col = tokenStream.token().startCol;
                        }
                        tokenStream.mustMatch(Tokens.type(endChar));
                        value += endChar;
                        this._readWhitespace();
                    } else if (tokenStream.match([Tokens.NUMBER, Tokens.PERCENTAGE, Tokens.LENGTH,
                            Tokens.ANGLE, Tokens.TIME,
                            Tokens.FREQ, Tokens.STRING, Tokens.IDENT, Tokens.URI, Tokens.UNICODE_RANGE])){

                        value = tokenStream.token().value;
                        if (unary === null){
                            line = tokenStream.token().startLine;
                            col = tokenStream.token().startCol;
                        }
                        this._readWhitespace();
                    } else {
                        token = this._hexcolor();
                        if (token === null){
                            if (unary === null){
                                line = tokenStream.LT(1).startLine;
                                col = tokenStream.LT(1).startCol;
                            }
                            if (value === null){
                                if (tokenStream.LA(3) == Tokens.EQUALS && this.options.ieFilters){
                                    value = this._ie_function();
                                } else {
                                    value = this._function();
                                }
                            }

                        } else {
                            value = token.value;
                            if (unary === null){
                                line = token.startLine;
                                col = token.startCol;
                            }
                        }

                    }

                    return value !== null ?
                            new PropertyValuePart(unary !== null ? unary + value : value, line, col) :
                            null;
                },

                _function() {
                    const tokenStream = this._tokenStream;
                    let functionText = null;
                    let expr        = null;
                    let lt;

                    if (tokenStream.match(Tokens.FUNCTION)){
                        functionText = tokenStream.token().value;
                        this._readWhitespace();
                        expr = this._expr(true);
                        functionText += expr;
                        if (this.options.ieFilters && tokenStream.peek() == Tokens.EQUALS){
                            do {

                                if (this._readWhitespace()){
                                    functionText += tokenStream.token().value;
                                }
                                if (tokenStream.LA(0) == Tokens.COMMA){
                                    functionText += tokenStream.token().value;
                                }

                                tokenStream.match(Tokens.IDENT);
                                functionText += tokenStream.token().value;

                                tokenStream.match(Tokens.EQUALS);
                                functionText += tokenStream.token().value;
                                lt = tokenStream.peek();
                                while(lt != Tokens.COMMA && lt != Tokens.S && lt != Tokens.RPAREN){
                                    tokenStream.get();
                                    functionText += tokenStream.token().value;
                                    lt = tokenStream.peek();
                                }
                            } while(tokenStream.match([Tokens.COMMA, Tokens.S]));
                        }

                        tokenStream.match(Tokens.RPAREN);
                        functionText += ")";
                        this._readWhitespace();
                    }

                    return functionText;
                },

                _ie_function() {
                    const tokenStream = this._tokenStream;
                    let functionText = null;
                    const expr        = null;
                    let lt;
                    if (tokenStream.match([Tokens.IE_FUNCTION, Tokens.FUNCTION])){
                        functionText = tokenStream.token().value;

                        do {

                            if (this._readWhitespace()){
                                functionText += tokenStream.token().value;
                            }
                            if (tokenStream.LA(0) == Tokens.COMMA){
                                functionText += tokenStream.token().value;
                            }

                            tokenStream.match(Tokens.IDENT);
                            functionText += tokenStream.token().value;

                            tokenStream.match(Tokens.EQUALS);
                            functionText += tokenStream.token().value;
                            lt = tokenStream.peek();
                            while(lt != Tokens.COMMA && lt != Tokens.S && lt != Tokens.RPAREN){
                                tokenStream.get();
                                functionText += tokenStream.token().value;
                                lt = tokenStream.peek();
                            }
                        } while(tokenStream.match([Tokens.COMMA, Tokens.S]));

                        tokenStream.match(Tokens.RPAREN);
                        functionText += ")";
                        this._readWhitespace();
                    }

                    return functionText;
                },

                _hexcolor() {
                    const tokenStream = this._tokenStream;
                    let token = null;
                    let color;

                    if(tokenStream.match(Tokens.HASH)){

                        token = tokenStream.token();
                        color = token.value;
                        if (!/#[a-f0-9]{3,6}/i.test(color)){
                            throw new SyntaxError(`Expected a hex color but found '${color}' at line ${token.startLine}, col ${token.startCol}.`, token.startLine, token.startCol);
                        }
                        this._readWhitespace();
                    }

                    return token;
                },

                _keyframes() {
                    const tokenStream = this._tokenStream;
                    let token;
                    let tt;
                    let name;
                    let prefix = "";

                    tokenStream.mustMatch(Tokens.KEYFRAMES_SYM);
                    token = tokenStream.token();
                    if (/^@\-([^\-]+)\-/.test(token.value)) {
                        prefix = RegExp.$1;
                    }

                    this._readWhitespace();
                    name = this._keyframe_name();

                    this._readWhitespace();
                    tokenStream.mustMatch(Tokens.LBRACE);

                    this.fire({
                        type:   "startkeyframes",
                        name,
                        prefix,
                        line:   token.startLine,
                        col:    token.startCol
                    });

                    this._readWhitespace();
                    tt = tokenStream.peek();
                    while(tt == Tokens.IDENT || tt == Tokens.PERCENTAGE) {
                        this._keyframe_rule();
                        this._readWhitespace();
                        tt = tokenStream.peek();
                    }

                    this.fire({
                        type:   "endkeyframes",
                        name,
                        prefix,
                        line:   token.startLine,
                        col:    token.startCol
                    });

                    this._readWhitespace();
                    tokenStream.mustMatch(Tokens.RBRACE);
                },

                _keyframe_name() {
                    const tokenStream = this._tokenStream;
                    let token;

                    tokenStream.mustMatch([Tokens.IDENT, Tokens.STRING]);
                    return SyntaxUnit.fromToken(tokenStream.token());
                },

                _keyframe_rule() {
                    const tokenStream = this._tokenStream;
                    let token;
                    const keyList = this._key_list();

                    this.fire({
                        type:   "startkeyframerule",
                        keys:   keyList,
                        line:   keyList[0].line,
                        col:    keyList[0].col
                    });

                    this._readDeclarations(true);

                    this.fire({
                        type:   "endkeyframerule",
                        keys:   keyList,
                        line:   keyList[0].line,
                        col:    keyList[0].col
                    });
                },

                _key_list() {
                    const tokenStream = this._tokenStream;
                    let token;
                    let key;
                    const keyList = [];
                    keyList.push(this._key());

                    this._readWhitespace();

                    while(tokenStream.match(Tokens.COMMA)){
                        this._readWhitespace();
                        keyList.push(this._key());
                        this._readWhitespace();
                    }

                    return keyList;
                },

                _key() {
                    const tokenStream = this._tokenStream;
                    let token;

                    if (tokenStream.match(Tokens.PERCENTAGE)){
                        return SyntaxUnit.fromToken(tokenStream.token());
                    } else if (tokenStream.match(Tokens.IDENT)){
                        token = tokenStream.token();

                        if (/from|to/i.test(token.value)){
                            return SyntaxUnit.fromToken(token);
                        }

                        tokenStream.unget();
                    }
                    this._unexpectedToken(tokenStream.LT(1));
                },
                _skipCruft() {
                    while(this._tokenStream.match([Tokens.S, Tokens.CDO, Tokens.CDC])){
                    }
                },
                _readDeclarations(checkStart, readMargins) {
                    const tokenStream = this._tokenStream;
                    let tt;


                    this._readWhitespace();

                    if (checkStart){
                        tokenStream.mustMatch(Tokens.LBRACE);
                    }

                    this._readWhitespace();

                    try {

                        while(true){

                            if (tokenStream.match(Tokens.SEMICOLON) || (readMargins && this._margin())){
                            } else if (this._declaration()){
                                if (!tokenStream.match(Tokens.SEMICOLON)){
                                    break;
                                }
                            } else {
                                break;
                            }
                            this._readWhitespace();
                        }

                        tokenStream.mustMatch(Tokens.RBRACE);
                        this._readWhitespace();

                    } catch (ex) {
                        if (ex instanceof SyntaxError && !this.options.strict){
                            this.fire({
                                type:       "error",
                                error:      ex,
                                message:    ex.message,
                                line:       ex.line,
                                col:        ex.col
                            });
                            tt = tokenStream.advance([Tokens.SEMICOLON, Tokens.RBRACE]);
                            if (tt == Tokens.SEMICOLON){
                                this._readDeclarations(false, readMargins);
                            } else if (tt != Tokens.RBRACE){
                                throw ex;
                            }

                        } else {
                            throw ex;
                        }
                    }
                },
                _readWhitespace() {
                    const tokenStream = this._tokenStream;
                    let ws = "";

                    while(tokenStream.match(Tokens.S)){
                        ws += tokenStream.token().value;
                    }

                    return ws;
                },
                _unexpectedToken(token) {
                    throw new SyntaxError(`Unexpected token '${token.value}' at line ${token.startLine}, col ${token.startCol}.`, token.startLine, token.startCol);
                },
                _verifyEnd() {
                    if (this._tokenStream.LA(1) != Tokens.EOF){
                        this._unexpectedToken(this._tokenStream.LT(1));
                    }
                },
                _validateProperty(property, value) {
                    Validation.validate(property, value);
                },

                parse(input) {
                    this._tokenStream = new TokenStream(input, Tokens);
                    this._stylesheet();
                },

                parseStyleSheet(input) {
                    return this.parse(input);
                },

                parseMediaQuery(input) {
                    this._tokenStream = new TokenStream(input, Tokens);
                    const result = this._media_query();
                    this._verifyEnd();
                    return result;
                },
                parsePropertyValue(input) {

                    this._tokenStream = new TokenStream(input, Tokens);
                    this._readWhitespace();

                    const result = this._expr();
                    this._readWhitespace();
                    this._verifyEnd();
                    return result;
                },
                parseRule(input) {
                    this._tokenStream = new TokenStream(input, Tokens);
                    this._readWhitespace();

                    const result = this._ruleset();
                    this._readWhitespace();
                    this._verifyEnd();
                    return result;
                },
                parseSelector(input) {

                    this._tokenStream = new TokenStream(input, Tokens);
                    this._readWhitespace();

                    const result = this._selector();
                    this._readWhitespace();
                    this._verifyEnd();
                    return result;
                },
                parseStyleAttribute(input) {
                    input += "}"; // for error recovery in _readDeclarations()
                    this._tokenStream = new TokenStream(input, Tokens);
                    this._readDeclarations();
                }
            };

            for (prop in additions){
                if (additions.hasOwnProperty(prop)){
                    proto[prop] = additions[prop];
                }
            }

            return proto;
        })();
        const Properties = {
            "align-items"                   : "flex-start | flex-end | center | baseline | stretch",
            "align-content"                 : "flex-start | flex-end | center | space-between | space-around | stretch",
            "align-self"                    : "auto | flex-start | flex-end | center | baseline | stretch",
            "-webkit-align-items"           : "flex-start | flex-end | center | baseline | stretch",
            "-webkit-align-content"         : "flex-start | flex-end | center | space-between | space-around | stretch",
            "-webkit-align-self"            : "auto | flex-start | flex-end | center | baseline | stretch",
            "alignment-adjust"              : "auto | baseline | before-edge | text-before-edge | middle | central | after-edge | text-after-edge | ideographic | alphabetic | hanging | mathematical | <percentage> | <length>",
            "alignment-baseline"            : "baseline | use-script | before-edge | text-before-edge | after-edge | text-after-edge | central | middle | ideographic | alphabetic | hanging | mathematical",
            "animation"                     : 1,
            "animation-delay"               : { multi: "<time>", comma: true },
            "animation-direction"           : { multi: "normal | reverse | alternate | alternate-reverse", comma: true },
            "animation-duration"            : { multi: "<time>", comma: true },
            "animation-fill-mode"           : { multi: "none | forwards | backwards | both", comma: true },
            "animation-iteration-count"     : { multi: "<number> | infinite", comma: true },
            "animation-name"                : { multi: "none | <ident>", comma: true },
            "animation-play-state"          : { multi: "running | paused", comma: true },
            "animation-timing-function"     : 1,
            "-moz-animation-delay"               : { multi: "<time>", comma: true },
            "-moz-animation-direction"           : { multi: "normal | reverse | alternate | alternate-reverse", comma: true },
            "-moz-animation-duration"            : { multi: "<time>", comma: true },
            "-moz-animation-iteration-count"     : { multi: "<number> | infinite", comma: true },
            "-moz-animation-name"                : { multi: "none | <ident>", comma: true },
            "-moz-animation-play-state"          : { multi: "running | paused", comma: true },

            "-ms-animation-delay"               : { multi: "<time>", comma: true },
            "-ms-animation-direction"           : { multi: "normal | reverse | alternate | alternate-reverse", comma: true },
            "-ms-animation-duration"            : { multi: "<time>", comma: true },
            "-ms-animation-iteration-count"     : { multi: "<number> | infinite", comma: true },
            "-ms-animation-name"                : { multi: "none | <ident>", comma: true },
            "-ms-animation-play-state"          : { multi: "running | paused", comma: true },

            "-webkit-animation-delay"               : { multi: "<time>", comma: true },
            "-webkit-animation-direction"           : { multi: "normal | reverse | alternate | alternate-reverse", comma: true },
            "-webkit-animation-duration"            : { multi: "<time>", comma: true },
            "-webkit-animation-fill-mode"           : { multi: "none | forwards | backwards | both", comma: true },
            "-webkit-animation-iteration-count"     : { multi: "<number> | infinite", comma: true },
            "-webkit-animation-name"                : { multi: "none | <ident>", comma: true },
            "-webkit-animation-play-state"          : { multi: "running | paused", comma: true },

            "-o-animation-delay"               : { multi: "<time>", comma: true },
            "-o-animation-direction"           : { multi: "normal | reverse | alternate | alternate-reverse", comma: true },
            "-o-animation-duration"            : { multi: "<time>", comma: true },
            "-o-animation-iteration-count"     : { multi: "<number> | infinite", comma: true },
            "-o-animation-name"                : { multi: "none | <ident>", comma: true },
            "-o-animation-play-state"          : { multi: "running | paused", comma: true },

            "appearance"                    : "icon | window | desktop | workspace | document | tooltip | dialog | button | push-button | hyperlink | radio-button | checkbox | menu-item | tab | menu | menubar | pull-down-menu | pop-up-menu | list-menu | radio-group | checkbox-group | outline-tree | range | field | combo-box | signature | password | normal | none | inherit",
            "azimuth"(expression) {
                const simple      = "<angle> | leftwards | rightwards | inherit";
                const direction   = "left-side | far-left | left | center-left | center | center-right | right | far-right | right-side";
                let behind      = false;
                let valid       = false;
                let part;

                if (!ValidationTypes.isAny(expression, simple)) {
                    if (ValidationTypes.isAny(expression, "behind")) {
                        behind = true;
                        valid = true;
                    }

                    if (ValidationTypes.isAny(expression, direction)) {
                        valid = true;
                        if (!behind) {
                            ValidationTypes.isAny(expression, "behind");
                        }
                    }
                }

                if (expression.hasNext()) {
                    part = expression.next();
                    if (valid) {
                        throw new ValidationError(`Expected end of value but found '${part}'.`, part.line, part.col);
                    } else {
                        throw new ValidationError(`Expected (<'azimuth'>) but found '${part}'.`, part.line, part.col);
                    }
                }
            },
            "backface-visibility"           : "visible | hidden",
            "background"                    : 1,
            "background-attachment"         : { multi: "<attachment>", comma: true },
            "background-clip"               : { multi: "<box>", comma: true },
            "background-color"              : "<color> | inherit",
            "background-image"              : { multi: "<bg-image>", comma: true },
            "background-origin"             : { multi: "<box>", comma: true },
            "background-position"           : { multi: "<bg-position>", comma: true },
            "background-repeat"             : { multi: "<repeat-style>" },
            "background-size"               : { multi: "<bg-size>", comma: true },
            "baseline-shift"                : "baseline | sub | super | <percentage> | <length>",
            "behavior"                      : 1,
            "binding"                       : 1,
            "bleed"                         : "<length>",
            "bookmark-label"                : "<content> | <attr> | <string>",
            "bookmark-level"                : "none | <integer>",
            "bookmark-state"                : "open | closed",
            "bookmark-target"               : "none | <uri> | <attr>",
            "border"                        : "<border-width> || <border-style> || <color>",
            "border-bottom"                 : "<border-width> || <border-style> || <color>",
            "border-bottom-color"           : "<color> | inherit",
            "border-bottom-left-radius"     :  "<x-one-radius>",
            "border-bottom-right-radius"    :  "<x-one-radius>",
            "border-bottom-style"           : "<border-style>",
            "border-bottom-width"           : "<border-width>",
            "border-collapse"               : "collapse | separate | inherit",
            "border-color"                  : { multi: "<color> | inherit", max: 4 },
            "border-image"                  : 1,
            "border-image-outset"           : { multi: "<length> | <number>", max: 4 },
            "border-image-repeat"           : { multi: "stretch | repeat | round", max: 2 },
            "border-image-slice"(expression) {
                let valid   = false;
                const numeric = "<number> | <percentage>";
                let fill    = false;
                let count   = 0;
                const max     = 4;
                let part;

                if (ValidationTypes.isAny(expression, "fill")) {
                    fill = true;
                    valid = true;
                }

                while (expression.hasNext() && count < max) {
                    valid = ValidationTypes.isAny(expression, numeric);
                    if (!valid) {
                        break;
                    }
                    count++;
                }


                if (!fill) {
                    ValidationTypes.isAny(expression, "fill");
                } else {
                    valid = true;
                }

                if (expression.hasNext()) {
                    part = expression.next();
                    if (valid) {
                        throw new ValidationError(`Expected end of value but found '${part}'.`, part.line, part.col);
                    } else {
                        throw new ValidationError(`Expected ([<number> | <percentage>]{1,4} && fill?) but found '${part}'.`, part.line, part.col);
                    }
                }
            },
            "border-image-source"           : "<image> | none",
            "border-image-width"            : { multi: "<length> | <percentage> | <number> | auto", max: 4 },
            "border-left"                   : "<border-width> || <border-style> || <color>",
            "border-left-color"             : "<color> | inherit",
            "border-left-style"             : "<border-style>",
            "border-left-width"             : "<border-width>",
            "border-radius"(expression) {
                let valid   = false;
                const simple = "<length> | <percentage> | inherit";
                let slash   = false;
                const fill    = false;
                let count   = 0;
                let max     = 8;
                let part;

                while (expression.hasNext() && count < max) {
                    valid = ValidationTypes.isAny(expression, simple);
                    if (!valid) {

                        if (expression.peek() == "/" && count > 0 && !slash) {
                            slash = true;
                            max = count + 5;
                            expression.next();
                        } else {
                            break;
                        }
                    }
                    count++;
                }

                if (expression.hasNext()) {
                    part = expression.next();
                    if (valid) {
                        throw new ValidationError(`Expected end of value but found '${part}'.`, part.line, part.col);
                    } else {
                        throw new ValidationError(`Expected (<'border-radius'>) but found '${part}'.`, part.line, part.col);
                    }
                }
            },
            "border-right"                  : "<border-width> || <border-style> || <color>",
            "border-right-color"            : "<color> | inherit",
            "border-right-style"            : "<border-style>",
            "border-right-width"            : "<border-width>",
            "border-spacing"                : { multi: "<length> | inherit", max: 2 },
            "border-style"                  : { multi: "<border-style>", max: 4 },
            "border-top"                    : "<border-width> || <border-style> || <color>",
            "border-top-color"              : "<color> | inherit",
            "border-top-left-radius"        : "<x-one-radius>",
            "border-top-right-radius"       : "<x-one-radius>",
            "border-top-style"              : "<border-style>",
            "border-top-width"              : "<border-width>",
            "border-width"                  : { multi: "<border-width>", max: 4 },
            "bottom"                        : "<margin-width> | inherit",
            "-moz-box-align"                : "start | end | center | baseline | stretch",
            "-moz-box-decoration-break"     : "slice |clone",
            "-moz-box-direction"            : "normal | reverse | inherit",
            "-moz-box-flex"                 : "<number>",
            "-moz-box-flex-group"           : "<integer>",
            "-moz-box-lines"                : "single | multiple",
            "-moz-box-ordinal-group"        : "<integer>",
            "-moz-box-orient"               : "horizontal | vertical | inline-axis | block-axis | inherit",
            "-moz-box-pack"                 : "start | end | center | justify",
            "-webkit-box-align"             : "start | end | center | baseline | stretch",
            "-webkit-box-decoration-break"  : "slice |clone",
            "-webkit-box-direction"         : "normal | reverse | inherit",
            "-webkit-box-flex"              : "<number>",
            "-webkit-box-flex-group"        : "<integer>",
            "-webkit-box-lines"             : "single | multiple",
            "-webkit-box-ordinal-group"     : "<integer>",
            "-webkit-box-orient"            : "horizontal | vertical | inline-axis | block-axis | inherit",
            "-webkit-box-pack"              : "start | end | center | justify",
            "box-shadow"(expression) {
                const result      = false;
                let part;

                if (!ValidationTypes.isAny(expression, "none")) {
                    Validation.multiProperty("<shadow>", expression, true, Infinity);
                } else {
                    if (expression.hasNext()) {
                        part = expression.next();
                        throw new ValidationError(`Expected end of value but found '${part}'.`, part.line, part.col);
                    }
                }
            },
            "box-sizing"                    : "content-box | border-box | inherit",
            "break-after"                   : "auto | always | avoid | left | right | page | column | avoid-page | avoid-column",
            "break-before"                  : "auto | always | avoid | left | right | page | column | avoid-page | avoid-column",
            "break-inside"                  : "auto | avoid | avoid-page | avoid-column",
            "caption-side"                  : "top | bottom | inherit",
            "clear"                         : "none | right | left | both | inherit",
            "clip"                          : 1,
            "color"                         : "<color> | inherit",
            "color-profile"                 : 1,
            "column-count"                  : "<integer> | auto",                      //http://www.w3.org/TR/css3-multicol/
            "column-fill"                   : "auto | balance",
            "column-gap"                    : "<length> | normal",
            "column-rule"                   : "<border-width> || <border-style> || <color>",
            "column-rule-color"             : "<color>",
            "column-rule-style"             : "<border-style>",
            "column-rule-width"             : "<border-width>",
            "column-span"                   : "none | all",
            "column-width"                  : "<length> | auto",
            "columns"                       : 1,
            "content"                       : 1,
            "counter-increment"             : 1,
            "counter-reset"                 : 1,
            "crop"                          : "<shape> | auto",
            "cue"                           : "cue-after | cue-before | inherit",
            "cue-after"                     : 1,
            "cue-before"                    : 1,
            "cursor"                        : 1,
            "direction"                     : "ltr | rtl | inherit",
            "display"                       : "inline | block | list-item | inline-block | table | inline-table | table-row-group | table-header-group | table-footer-group | table-row | table-column-group | table-column | table-cell | table-caption | grid | inline-grid | none | inherit | -moz-box | -moz-inline-block | -moz-inline-box | -moz-inline-grid | -moz-inline-stack | -moz-inline-table | -moz-grid | -moz-grid-group | -moz-grid-line | -moz-groupbox | -moz-deck | -moz-popup | -moz-stack | -moz-marker | -webkit-box | -webkit-inline-box | -ms-flexbox | -ms-inline-flexbox | flex | -webkit-flex | inline-flex | -webkit-inline-flex",
            "dominant-baseline"             : 1,
            "drop-initial-after-adjust"     : "central | middle | after-edge | text-after-edge | ideographic | alphabetic | mathematical | <percentage> | <length>",
            "drop-initial-after-align"      : "baseline | use-script | before-edge | text-before-edge | after-edge | text-after-edge | central | middle | ideographic | alphabetic | hanging | mathematical",
            "drop-initial-before-adjust"    : "before-edge | text-before-edge | central | middle | hanging | mathematical | <percentage> | <length>",
            "drop-initial-before-align"     : "caps-height | baseline | use-script | before-edge | text-before-edge | after-edge | text-after-edge | central | middle | ideographic | alphabetic | hanging | mathematical",
            "drop-initial-size"             : "auto | line | <length> | <percentage>",
            "drop-initial-value"            : "initial | <integer>",
            "elevation"                     : "<angle> | below | level | above | higher | lower | inherit",
            "empty-cells"                   : "show | hide | inherit",
            "filter"                        : 1,
            "fit"                           : "fill | hidden | meet | slice",
            "fit-position"                  : 1,
            "flex"                          : "<flex>",
            "flex-basis"                    : "<width>",
            "flex-direction"                : "row | row-reverse | column | column-reverse",
            "flex-flow"                     : "<flex-direction> || <flex-wrap>",
            "flex-grow"                     : "<number>",
            "flex-shrink"                   : "<number>",
            "flex-wrap"                     : "nowrap | wrap | wrap-reverse",
            "-webkit-flex"                  : "<flex>",
            "-webkit-flex-basis"            : "<width>",
            "-webkit-flex-direction"        : "row | row-reverse | column | column-reverse",
            "-webkit-flex-flow"             : "<flex-direction> || <flex-wrap>",
            "-webkit-flex-grow"             : "<number>",
            "-webkit-flex-shrink"           : "<number>",
            "-webkit-flex-wrap"             : "nowrap | wrap | wrap-reverse",
            "-ms-flex"                      : "<flex>",
            "-ms-flex-align"                : "start | end | center | stretch | baseline",
            "-ms-flex-direction"            : "row | row-reverse | column | column-reverse | inherit",
            "-ms-flex-order"                : "<number>",
            "-ms-flex-pack"                 : "start | end | center | justify",
            "-ms-flex-wrap"                 : "nowrap | wrap | wrap-reverse",
            "float"                         : "left | right | none | inherit",
            "float-offset"                  : 1,
            "font"                          : 1,
            "font-family"                   : 1,
            "font-size"                     : "<absolute-size> | <relative-size> | <length> | <percentage> | inherit",
            "font-size-adjust"              : "<number> | none | inherit",
            "font-stretch"                  : "normal | ultra-condensed | extra-condensed | condensed | semi-condensed | semi-expanded | expanded | extra-expanded | ultra-expanded | inherit",
            "font-style"                    : "normal | italic | oblique | inherit",
            "font-variant"                  : "normal | small-caps | inherit",
            "font-weight"                   : "normal | bold | bolder | lighter | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | inherit",
            "grid-cell-stacking"            : "columns | rows | layer",
            "grid-column"                   : 1,
            "grid-columns"                  : 1,
            "grid-column-align"             : "start | end | center | stretch",
            "grid-column-sizing"            : 1,
            "grid-column-span"              : "<integer>",
            "grid-flow"                     : "none | rows | columns",
            "grid-layer"                    : "<integer>",
            "grid-row"                      : 1,
            "grid-rows"                     : 1,
            "grid-row-align"                : "start | end | center | stretch",
            "grid-row-span"                 : "<integer>",
            "grid-row-sizing"               : 1,
            "hanging-punctuation"           : 1,
            "height"                        : "<margin-width> | <content-sizing> | inherit",
            "hyphenate-after"               : "<integer> | auto",
            "hyphenate-before"              : "<integer> | auto",
            "hyphenate-character"           : "<string> | auto",
            "hyphenate-lines"               : "no-limit | <integer>",
            "hyphenate-resource"            : 1,
            "hyphens"                       : "none | manual | auto",
            "icon"                          : 1,
            "image-orientation"             : "angle | auto",
            "image-rendering"               : 1,
            "image-resolution"              : 1,
            "inline-box-align"              : "initial | last | <integer>",
            "justify-content"               : "flex-start | flex-end | center | space-between | space-around",
            "-webkit-justify-content"       : "flex-start | flex-end | center | space-between | space-around",
            "left"                          : "<margin-width> | inherit",
            "letter-spacing"                : "<length> | normal | inherit",
            "line-height"                   : "<number> | <length> | <percentage> | normal | inherit",
            "line-break"                    : "auto | loose | normal | strict",
            "line-stacking"                 : 1,
            "line-stacking-ruby"            : "exclude-ruby | include-ruby",
            "line-stacking-shift"           : "consider-shifts | disregard-shifts",
            "line-stacking-strategy"        : "inline-line-height | block-line-height | max-height | grid-height",
            "list-style"                    : 1,
            "list-style-image"              : "<uri> | none | inherit",
            "list-style-position"           : "inside | outside | inherit",
            "list-style-type"               : "disc | circle | square | decimal | decimal-leading-zero | lower-roman | upper-roman | lower-greek | lower-latin | upper-latin | armenian | georgian | lower-alpha | upper-alpha | none | inherit",
            "margin"                        : { multi: "<margin-width> | inherit", max: 4 },
            "margin-bottom"                 : "<margin-width> | inherit",
            "margin-left"                   : "<margin-width> | inherit",
            "margin-right"                  : "<margin-width> | inherit",
            "margin-top"                    : "<margin-width> | inherit",
            "mark"                          : 1,
            "mark-after"                    : 1,
            "mark-before"                   : 1,
            "marks"                         : 1,
            "marquee-direction"             : 1,
            "marquee-play-count"            : 1,
            "marquee-speed"                 : 1,
            "marquee-style"                 : 1,
            "max-height"                    : "<length> | <percentage> | <content-sizing> | none | inherit",
            "max-width"                     : "<length> | <percentage> | <content-sizing> | none | inherit",
            "min-height"                    : "<length> | <percentage> | <content-sizing> | contain-floats | -moz-contain-floats | -webkit-contain-floats | inherit",
            "min-width"                     : "<length> | <percentage> | <content-sizing> | contain-floats | -moz-contain-floats | -webkit-contain-floats | inherit",
            "move-to"                       : 1,
            "nav-down"                      : 1,
            "nav-index"                     : 1,
            "nav-left"                      : 1,
            "nav-right"                     : 1,
            "nav-up"                        : 1,
            "opacity"                       : "<number> | inherit",
            "order"                         : "<integer>",
            "-webkit-order"                 : "<integer>",
            "orphans"                       : "<integer> | inherit",
            "outline"                       : 1,
            "outline-color"                 : "<color> | invert | inherit",
            "outline-offset"                : 1,
            "outline-style"                 : "<border-style> | inherit",
            "outline-width"                 : "<border-width> | inherit",
            "overflow"                      : "visible | hidden | scroll | auto | inherit",
            "overflow-style"                : 1,
            "overflow-wrap"                 : "normal | break-word",
            "overflow-x"                    : 1,
            "overflow-y"                    : 1,
            "padding"                       : { multi: "<padding-width> | inherit", max: 4 },
            "padding-bottom"                : "<padding-width> | inherit",
            "padding-left"                  : "<padding-width> | inherit",
            "padding-right"                 : "<padding-width> | inherit",
            "padding-top"                   : "<padding-width> | inherit",
            "page"                          : 1,
            "page-break-after"              : "auto | always | avoid | left | right | inherit",
            "page-break-before"             : "auto | always | avoid | left | right | inherit",
            "page-break-inside"             : "auto | avoid | inherit",
            "page-policy"                   : 1,
            "pause"                         : 1,
            "pause-after"                   : 1,
            "pause-before"                  : 1,
            "perspective"                   : 1,
            "perspective-origin"            : 1,
            "phonemes"                      : 1,
            "pitch"                         : 1,
            "pitch-range"                   : 1,
            "play-during"                   : 1,
            "pointer-events"                : "auto | none | visiblePainted | visibleFill | visibleStroke | visible | painted | fill | stroke | all | inherit",
            "position"                      : "static | relative | absolute | fixed | inherit",
            "presentation-level"            : 1,
            "punctuation-trim"              : 1,
            "quotes"                        : 1,
            "rendering-intent"              : 1,
            "resize"                        : 1,
            "rest"                          : 1,
            "rest-after"                    : 1,
            "rest-before"                   : 1,
            "richness"                      : 1,
            "right"                         : "<margin-width> | inherit",
            "rotation"                      : 1,
            "rotation-point"                : 1,
            "ruby-align"                    : 1,
            "ruby-overhang"                 : 1,
            "ruby-position"                 : 1,
            "ruby-span"                     : 1,
            "size"                          : 1,
            "speak"                         : "normal | none | spell-out | inherit",
            "speak-header"                  : "once | always | inherit",
            "speak-numeral"                 : "digits | continuous | inherit",
            "speak-punctuation"             : "code | none | inherit",
            "speech-rate"                   : 1,
            "src"                           : 1,
            "stress"                        : 1,
            "string-set"                    : 1,

            "table-layout"                  : "auto | fixed | inherit",
            "tab-size"                      : "<integer> | <length>",
            "target"                        : 1,
            "target-name"                   : 1,
            "target-new"                    : 1,
            "target-position"               : 1,
            "text-align"                    : "left | right | center | justify | inherit" ,
            "text-align-last"               : 1,
            "text-decoration"               : 1,
            "text-emphasis"                 : 1,
            "text-height"                   : 1,
            "text-indent"                   : "<length> | <percentage> | inherit",
            "text-justify"                  : "auto | none | inter-word | inter-ideograph | inter-cluster | distribute | kashida",
            "text-outline"                  : 1,
            "text-overflow"                 : 1,
            "text-rendering"                : "auto | optimizeSpeed | optimizeLegibility | geometricPrecision | inherit",
            "text-shadow"                   : 1,
            "text-transform"                : "capitalize | uppercase | lowercase | none | inherit",
            "text-wrap"                     : "normal | none | avoid",
            "top"                           : "<margin-width> | inherit",
            "-ms-touch-action"              : "auto | none | pan-x | pan-y",
            "touch-action"                  : "auto | none | pan-x | pan-y",
            "transform"                     : 1,
            "transform-origin"              : 1,
            "transform-style"               : 1,
            "transition"                    : 1,
            "transition-delay"              : 1,
            "transition-duration"           : 1,
            "transition-property"           : 1,
            "transition-timing-function"    : 1,
            "unicode-bidi"                  : "normal | embed | isolate | bidi-override | isolate-override | plaintext | inherit",
            "user-modify"                   : "read-only | read-write | write-only | inherit",
            "user-select"                   : "none | text | toggle | element | elements | all | inherit",
            "vertical-align"                : "auto | use-script | baseline | sub | super | top | text-top | central | middle | bottom | text-bottom | <percentage> | <length>",
            "visibility"                    : "visible | hidden | collapse | inherit",
            "voice-balance"                 : 1,
            "voice-duration"                : 1,
            "voice-family"                  : 1,
            "voice-pitch"                   : 1,
            "voice-pitch-range"             : 1,
            "voice-rate"                    : 1,
            "voice-stress"                  : 1,
            "voice-volume"                  : 1,
            "volume"                        : 1,
            "white-space"                   : "normal | pre | nowrap | pre-wrap | pre-line | inherit | -pre-wrap | -o-pre-wrap | -moz-pre-wrap | -hp-pre-wrap", //http://perishablepress.com/wrapping-content/
            "white-space-collapse"          : 1,
            "widows"                        : "<integer> | inherit",
            "width"                         : "<length> | <percentage> | <content-sizing> | auto | inherit",
            "word-break"                    : "normal | keep-all | break-all",
            "word-spacing"                  : "<length> | normal | inherit",
            "word-wrap"                     : "normal | break-word",
            "writing-mode"                  : "horizontal-tb | vertical-rl | vertical-lr | lr-tb | rl-tb | tb-rl | bt-rl | tb-lr | bt-lr | lr-bt | rl-bt | lr | rl | tb | inherit",
            "z-index"                       : "<integer> | auto | inherit",
            "zoom"                          : "<number> | <percentage> | normal"
        };

        class PropertyName {
            constructor(text, hack, line, col) {

                SyntaxUnit.call(this, text, line, col, Parser.PROPERTY_NAME_TYPE);
                this.hack = hack;

            }

            toString() {
                return (this.hack ? this.hack : "") + this.text;
            }
        }

        PropertyName.prototype = new SyntaxUnit();
        PropertyName.prototype.constructor = PropertyName;
        function PropertyValue(parts, line, col){

            SyntaxUnit.call(this, parts.join(" "), line, col, Parser.PROPERTY_VALUE_TYPE);
            this.parts = parts;

        }

        PropertyValue.prototype = new SyntaxUnit();
        PropertyValue.prototype.constructor = PropertyValue;

        class PropertyValueIterator {
            constructor(value) {
                this._i = 0;
                this._parts = value.parts;
                this._marks = [];
                this.value = value;

            }

            count() {
                return this._parts.length;
            }

            isFirst() {
                return this._i === 0;
            }

            hasNext() {
                return (this._i < this._parts.length);
            }

            mark() {
                this._marks.push(this._i);
            }

            peek(count) {
                return this.hasNext() ? this._parts[this._i + (count || 0)] : null;
            }

            next() {
                return this.hasNext() ? this._parts[this._i++] : null;
            }

            previous() {
                return this._i > 0 ? this._parts[--this._i] : null;
            }

            restore() {
                if (this._marks.length){
                    this._i = this._marks.pop();
                }
            }
        }

        class PropertyValuePart {
            constructor(text, line, col) {

                SyntaxUnit.call(this, text, line, col, Parser.PROPERTY_VALUE_PART_TYPE);
                this.type = "unknown";

                let temp;
                if (/^([+\-]?[\d\.]+)([a-z]+)$/i.test(text)){  //dimension
                    this.type = "dimension";
                    this.value = +RegExp.$1;
                    this.units = RegExp.$2;
                    switch(this.units.toLowerCase()){

                        case "em":
                        case "rem":
                        case "ex":
                        case "px":
                        case "cm":
                        case "mm":
                        case "in":
                        case "pt":
                        case "pc":
                        case "ch":
                        case "vh":
                        case "vw":
                        case "vmax":
                        case "vmin":
                            this.type = "length";
                            break;

                        case "deg":
                        case "rad":
                        case "grad":
                            this.type = "angle";
                            break;

                        case "ms":
                        case "s":
                            this.type = "time";
                            break;

                        case "hz":
                        case "khz":
                            this.type = "frequency";
                            break;

                        case "dpi":
                        case "dpcm":
                            this.type = "resolution";
                            break;

                    }

                } else if (/^([+\-]?[\d\.]+)%$/i.test(text)){  //percentage
                    this.type = "percentage";
                    this.value = +RegExp.$1;
                } else if (/^([+\-]?\d+)$/i.test(text)){  //integer
                    this.type = "integer";
                    this.value = +RegExp.$1;
                } else if (/^([+\-]?[\d\.]+)$/i.test(text)){  //number
                    this.type = "number";
                    this.value = +RegExp.$1;

                } else if (/^#([a-f0-9]{3,6})/i.test(text)){  //hexcolor
                    this.type = "color";
                    temp = RegExp.$1;
                    if (temp.length == 3){
                        this.red    = parseInt(temp.charAt(0)+temp.charAt(0),16);
                        this.green  = parseInt(temp.charAt(1)+temp.charAt(1),16);
                        this.blue   = parseInt(temp.charAt(2)+temp.charAt(2),16);
                    } else {
                        this.red    = parseInt(temp.substring(0,2),16);
                        this.green  = parseInt(temp.substring(2,4),16);
                        this.blue   = parseInt(temp.substring(4,6),16);
                    }
                } else if (/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i.test(text)){ //rgb() color with absolute numbers
                    this.type   = "color";
                    this.red    = +RegExp.$1;
                    this.green  = +RegExp.$2;
                    this.blue   = +RegExp.$3;
                } else if (/^rgb\(\s*(\d+)%\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/i.test(text)){ //rgb() color with percentages
                    this.type   = "color";
                    this.red    = +RegExp.$1 * 255 / 100;
                    this.green  = +RegExp.$2 * 255 / 100;
                    this.blue   = +RegExp.$3 * 255 / 100;
                } else if (/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d\.]+)\s*\)/i.test(text)){ //rgba() color with absolute numbers
                    this.type   = "color";
                    this.red    = +RegExp.$1;
                    this.green  = +RegExp.$2;
                    this.blue   = +RegExp.$3;
                    this.alpha  = +RegExp.$4;
                } else if (/^rgba\(\s*(\d+)%\s*,\s*(\d+)%\s*,\s*(\d+)%\s*,\s*([\d\.]+)\s*\)/i.test(text)){ //rgba() color with percentages
                    this.type   = "color";
                    this.red    = +RegExp.$1 * 255 / 100;
                    this.green  = +RegExp.$2 * 255 / 100;
                    this.blue   = +RegExp.$3 * 255 / 100;
                    this.alpha  = +RegExp.$4;
                } else if (/^hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/i.test(text)){ //hsl()
                    this.type   = "color";
                    this.hue    = +RegExp.$1;
                    this.saturation = +RegExp.$2 / 100;
                    this.lightness  = +RegExp.$3 / 100;
                } else if (/^hsla\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*,\s*([\d\.]+)\s*\)/i.test(text)){ //hsla() color with percentages
                    this.type   = "color";
                    this.hue    = +RegExp.$1;
                    this.saturation = +RegExp.$2 / 100;
                    this.lightness  = +RegExp.$3 / 100;
                    this.alpha  = +RegExp.$4;
                } else if (/^url\(["']?([^\)"']+)["']?\)/i.test(text)){ //URI
                    this.type   = "uri";
                    this.uri    = RegExp.$1;
                } else if (/^([^\(]+)\(/i.test(text)){
                    this.type   = "function";
                    this.name   = RegExp.$1;
                    this.value  = text;
                } else if (/^["'][^"']*["']/.test(text)){    //string
                    this.type   = "string";
                    this.value  = eval(text);
                } else if (Colors[text.toLowerCase()]){  //named color
                    this.type   = "color";
                    temp        = Colors[text.toLowerCase()].substring(1);
                    this.red    = parseInt(temp.substring(0,2),16);
                    this.green  = parseInt(temp.substring(2,4),16);
                    this.blue   = parseInt(temp.substring(4,6),16);
                } else if (/^[\,\/]$/.test(text)){
                    this.type   = "operator";
                    this.value  = text;
                } else if (/^[a-z\-_\u0080-\uFFFF][a-z0-9\-_\u0080-\uFFFF]*$/i.test(text)){
                    this.type   = "identifier";
                    this.value  = text;
                }

            }

            static fromToken(token) {
                return new PropertyValuePart(token.value, token.startLine, token.startCol);
            }
        }

        PropertyValuePart.prototype = new SyntaxUnit();
        PropertyValuePart.prototype.constructor = PropertyValuePart;
        const Pseudos = {
            ":first-letter": 1,
            ":first-line":   1,
            ":before":       1,
            ":after":        1
        };

        Pseudos.ELEMENT = 1;
        Pseudos.CLASS = 2;

        Pseudos.isElement = pseudo => pseudo.indexOf("::") === 0 || Pseudos[pseudo.toLowerCase()] == Pseudos.ELEMENT;
        function Selector(parts, line, col){

            SyntaxUnit.call(this, parts.join(" "), line, col, Parser.SELECTOR_TYPE);
            this.parts = parts;
            this.specificity = Specificity.calculate(this);

        }

        Selector.prototype = new SyntaxUnit();
        Selector.prototype.constructor = Selector;
        function SelectorPart(elementName, modifiers, text, line, col){

            SyntaxUnit.call(this, text, line, col, Parser.SELECTOR_PART_TYPE);
            this.elementName = elementName;
            this.modifiers = modifiers;

        }

        SelectorPart.prototype = new SyntaxUnit();
        SelectorPart.prototype.constructor = SelectorPart;
        function SelectorSubPart(text, type, line, col){

            SyntaxUnit.call(this, text, line, col, Parser.SELECTOR_SUB_PART_TYPE);
            this.type = type;
            this.args = [];

        }

        SelectorSubPart.prototype = new SyntaxUnit();
        SelectorSubPart.prototype.constructor = SelectorSubPart;

        class Specificity {
            constructor(a, b, c, d) {
                this.a = a;
                this.b = b;
                this.c = c;
                this.d = d;
            }

            static calculate(selector) {
                let i;
                let len;
                let part;
                let b=0;
                let c=0;
                let d=0;

                function updateValues(part){
                    let i;
                    let j;
                    let len;
                    let num;
                    const elementName = part.elementName ? part.elementName.text : "";
                    let modifier;

                    if (elementName && elementName.charAt(elementName.length-1) != "*") {
                        d++;
                    }

                    for (i=0, len=part.modifiers.length; i < len; i++){
                        modifier = part.modifiers[i];
                        switch(modifier.type){
                            case "class":
                            case "attribute":
                                c++;
                                break;

                            case "id":
                                b++;
                                break;

                            case "pseudo":
                                if (Pseudos.isElement(modifier.text)){
                                    d++;
                                } else {
                                    c++;
                                }
                                break;

                            case "not":
                                for (j=0, num=modifier.args.length; j < num; j++){
                                    updateValues(modifier.args[j]);
                                }
                        }
                     }
                }

                for (i=0, len=selector.parts.length; i < len; i++){
                    part = selector.parts[i];

                    if (part instanceof SelectorPart){
                        updateValues(part);
                    }
                }

                return new Specificity(0, b, c, d);
            }
        }

        Specificity.prototype = {
            constructor: Specificity,
            compare(other) {
                const comps = ["a", "b", "c", "d"];
                let i;
                let len;

                for (i=0, len=comps.length; i < len; i++){
                    if (this[comps[i]] < other[comps[i]]){
                        return -1;
                    } else if (this[comps[i]] > other[comps[i]]){
                        return 1;
                    }
                }

                return 0;
            },
            valueOf() {
                return (this.a * 1000) + (this.b * 100) + (this.c * 10) + this.d;
            },
            toString() {
                return `${this.a},${this.b},${this.c},${this.d}`;
            }

        };
        const h = /^[0-9a-fA-F]$/;
        const nonascii = /^[\u0080-\uFFFF]$/;
        const nl = /\n|\r\n|\r|\f/;


        function isHexDigit(c){
            return c !== null && h.test(c);
        }

        function isDigit(c){
            return c !== null && /\d/.test(c);
        }

        function isWhitespace(c){
            return c !== null && /\s/.test(c);
        }

        function isNewLine(c){
            return c !== null && nl.test(c);
        }

        function isNameStart(c){
            return c !== null && (/[a-z_\u0080-\uFFFF\\]/i.test(c));
        }

        function isNameChar(c){
            return c !== null && (isNameStart(c) || /[0-9\-\\]/.test(c));
        }

        function isIdentStart(c){
            return c !== null && (isNameStart(c) || /\-\\/.test(c));
        }

        function mix(receiver, supplier){
            for (const prop in supplier){
                if (supplier.hasOwnProperty(prop)){
                    receiver[prop] = supplier[prop];
                }
            }
            return receiver;
        }
        function TokenStream(input){
            TokenStreamBase.call(this, input, Tokens);
        }

        TokenStream.prototype = mix(new TokenStreamBase(), {
            _getToken(channel) {
                let c;
                const reader = this._reader;
                let token   = null;
                const startLine   = reader.getLine();
                const startCol    = reader.getCol();

                c = reader.read();


                while(c){
                    switch(c){
                        case "/":

                            if(reader.peek() == "*"){
                                token = this.commentToken(c, startLine, startCol);
                            } else {
                                token = this.charToken(c, startLine, startCol);
                            }
                            break;
                        case "|":
                        case "~":
                        case "^":
                        case "$":
                        case "*":
                            if(reader.peek() == "="){
                                token = this.comparisonToken(c, startLine, startCol);
                            } else {
                                token = this.charToken(c, startLine, startCol);
                            }
                            break;
                        case "\"":
                        case "'":
                            token = this.stringToken(c, startLine, startCol);
                            break;
                        case "#":
                            if (isNameChar(reader.peek())){
                                token = this.hashToken(c, startLine, startCol);
                            } else {
                                token = this.charToken(c, startLine, startCol);
                            }
                            break;
                        case ".":
                            if (isDigit(reader.peek())){
                                token = this.numberToken(c, startLine, startCol);
                            } else {
                                token = this.charToken(c, startLine, startCol);
                            }
                            break;
                        case "-":
                            if (reader.peek() == "-"){  //could be closing HTML-style comment
                                token = this.htmlCommentEndToken(c, startLine, startCol);
                            } else if (isNameStart(reader.peek())){
                                token = this.identOrFunctionToken(c, startLine, startCol);
                            } else {
                                token = this.charToken(c, startLine, startCol);
                            }
                            break;
                        case "!":
                            token = this.importantToken(c, startLine, startCol);
                            break;
                        case "@":
                            token = this.atRuleToken(c, startLine, startCol);
                            break;
                        case ":":
                            token = this.notToken(c, startLine, startCol);
                            break;
                        case "<":
                            token = this.htmlCommentStartToken(c, startLine, startCol);
                            break;
                        case "U":
                        case "u":
                            if (reader.peek() == "+"){
                                token = this.unicodeRangeToken(c, startLine, startCol);
                                break;
                            }
                        default:
                            if (isDigit(c)){
                                token = this.numberToken(c, startLine, startCol);
                            } else
                            if (isWhitespace(c)){
                                token = this.whitespaceToken(c, startLine, startCol);
                            } else
                            if (isIdentStart(c)){
                                token = this.identOrFunctionToken(c, startLine, startCol);
                            } else
                            {
                                token = this.charToken(c, startLine, startCol);
                            }






                    }
                    break;
                }

                if (!token && c === null){
                    token = this.createToken(Tokens.EOF,null,startLine,startCol);
                }

                return token;
            },
            createToken(tt, value, startLine, startCol, options) {
                const reader = this._reader;
                options = options || {};

                return {
                    value,
                    type:       tt,
                    channel:    options.channel,
                    endChar:    options.endChar,
                    hide:       options.hide || false,
                    startLine,
                    startCol,
                    endLine:    reader.getLine(),
                    endCol:     reader.getCol()
                };
            },
            atRuleToken(first, startLine, startCol) {
                let rule    = first;
                const reader  = this._reader;
                let tt      = Tokens.CHAR;
                const valid   = false;
                let ident;
                let c;
                reader.mark();
                ident = this.readName();
                rule = first + ident;
                tt = Tokens.type(rule.toLowerCase());
                if (tt == Tokens.CHAR || tt == Tokens.UNKNOWN){
                    if (rule.length > 1){
                        tt = Tokens.UNKNOWN_SYM;
                    } else {
                        tt = Tokens.CHAR;
                        rule = first;
                        reader.reset();
                    }
                }

                return this.createToken(tt, rule, startLine, startCol);
            },
            charToken(c, startLine, startCol) {
                let tt = Tokens.type(c);
                const opts = {};

                if (tt == -1){
                    tt = Tokens.CHAR;
                } else {
                    opts.endChar = Tokens[tt].endChar;
                }

                return this.createToken(tt, c, startLine, startCol, opts);
            },
            commentToken(first, startLine, startCol) {
                const reader  = this._reader;
                const comment = this.readComment(first);

                return this.createToken(Tokens.COMMENT, comment, startLine, startCol);
            },
            comparisonToken(c, startLine, startCol) {
                const reader  = this._reader;
                const comparison  = c + reader.read();
                const tt      = Tokens.type(comparison) || Tokens.CHAR;

                return this.createToken(tt, comparison, startLine, startCol);
            },
            hashToken(first, startLine, startCol) {
                const reader  = this._reader;
                const name    = this.readName(first);

                return this.createToken(Tokens.HASH, name, startLine, startCol);
            },
            htmlCommentStartToken(first, startLine, startCol) {
                const reader      = this._reader;
                let text        = first;

                reader.mark();
                text += reader.readCount(3);

                if (text == "<!--"){
                    return this.createToken(Tokens.CDO, text, startLine, startCol);
                } else {
                    reader.reset();
                    return this.charToken(first, startLine, startCol);
                }
            },
            htmlCommentEndToken(first, startLine, startCol) {
                const reader      = this._reader;
                let text        = first;

                reader.mark();
                text += reader.readCount(2);

                if (text == "-->"){
                    return this.createToken(Tokens.CDC, text, startLine, startCol);
                } else {
                    reader.reset();
                    return this.charToken(first, startLine, startCol);
                }
            },
            identOrFunctionToken(first, startLine, startCol) {
                const reader  = this._reader;
                let ident   = this.readName(first);
                let tt      = Tokens.IDENT;
                if (reader.peek() == "("){
                    ident += reader.read();
                    if (ident.toLowerCase() == "url("){
                        tt = Tokens.URI;
                        ident = this.readURI(ident);
                        if (ident.toLowerCase() == "url("){
                            tt = Tokens.FUNCTION;
                        }
                    } else {
                        tt = Tokens.FUNCTION;
                    }
                } else if (reader.peek() == ":"){  //might be an IE function
                    if (ident.toLowerCase() == "progid"){
                        ident += reader.readTo("(");
                        tt = Tokens.IE_FUNCTION;
                    }
                }

                return this.createToken(tt, ident, startLine, startCol);
            },
            importantToken(first, startLine, startCol) {
                const reader      = this._reader;
                let important   = first;
                let tt          = Tokens.CHAR;
                let temp;
                let c;

                reader.mark();
                c = reader.read();

                while(c){
                    if (c == "/"){
                        if (reader.peek() != "*"){
                            break;
                        } else {
                            temp = this.readComment(c);
                            if (temp === ""){    //broken!
                                break;
                            }
                        }
                    } else if (isWhitespace(c)){
                        important += c + this.readWhitespace();
                    } else if (/i/i.test(c)){
                        temp = reader.readCount(8);
                        if (/mportant/i.test(temp)){
                            important += c + temp;
                            tt = Tokens.IMPORTANT_SYM;

                        }
                        break;  //we're done
                    } else {
                        break;
                    }

                    c = reader.read();
                }

                if (tt == Tokens.CHAR){
                    reader.reset();
                    return this.charToken(first, startLine, startCol);
                } else {
                    return this.createToken(tt, important, startLine, startCol);
                }
            },
            notToken(first, startLine, startCol) {
                const reader      = this._reader;
                let text        = first;

                reader.mark();
                text += reader.readCount(4);

                if (text.toLowerCase() == ":not("){
                    return this.createToken(Tokens.NOT, text, startLine, startCol);
                } else {
                    reader.reset();
                    return this.charToken(first, startLine, startCol);
                }
            },
            numberToken(first, startLine, startCol) {
                const reader  = this._reader;
                let value   = this.readNumber(first);
                let ident;
                let tt      = Tokens.NUMBER;
                const c       = reader.peek();

                if (isIdentStart(c)){
                    ident = this.readName(reader.read());
                    value += ident;

                    if (/^em$|^ex$|^px$|^gd$|^rem$|^vw$|^vh$|^vmax$|^vmin$|^ch$|^cm$|^mm$|^in$|^pt$|^pc$/i.test(ident)){
                        tt = Tokens.LENGTH;
                    } else if (/^deg|^rad$|^grad$/i.test(ident)){
                        tt = Tokens.ANGLE;
                    } else if (/^ms$|^s$/i.test(ident)){
                        tt = Tokens.TIME;
                    } else if (/^hz$|^khz$/i.test(ident)){
                        tt = Tokens.FREQ;
                    } else if (/^dpi$|^dpcm$/i.test(ident)){
                        tt = Tokens.RESOLUTION;
                    } else {
                        tt = Tokens.DIMENSION;
                    }

                } else if (c == "%"){
                    value += reader.read();
                    tt = Tokens.PERCENTAGE;
                }

                return this.createToken(tt, value, startLine, startCol);
            },
            stringToken(first, startLine, startCol) {
                const delim   = first;
                let string  = first;
                const reader  = this._reader;
                let prev    = first;
                let tt      = Tokens.STRING;
                let c       = reader.read();

                while(c){
                    string += c;
                    if (c == delim && prev != "\\"){
                        break;
                    }
                    if (isNewLine(reader.peek()) && c != "\\"){
                        tt = Tokens.INVALID;
                        break;
                    }
                    prev = c;
                    c = reader.read();
                }
                if (c === null){
                    tt = Tokens.INVALID;
                }

                return this.createToken(tt, string, startLine, startCol);
            },

            unicodeRangeToken(first, startLine, startCol) {
                const reader  = this._reader;
                let value   = first;
                let temp;
                let tt      = Tokens.CHAR;
                if (reader.peek() == "+"){
                    reader.mark();
                    value += reader.read();
                    value += this.readUnicodeRangePart(true);
                    if (value.length == 2){
                        reader.reset();
                    } else {

                        tt = Tokens.UNICODE_RANGE;
                        if (!value.includes("?")){

                            if (reader.peek() == "-"){
                                reader.mark();
                                temp = reader.read();
                                temp += this.readUnicodeRangePart(false);
                                if (temp.length == 1){
                                    reader.reset();
                                } else {
                                    value += temp;
                                }
                            }

                        }
                    }
                }

                return this.createToken(tt, value, startLine, startCol);
            },
            whitespaceToken(first, startLine, startCol) {
                const reader  = this._reader;
                const value   = first + this.readWhitespace();
                return this.createToken(Tokens.S, value, startLine, startCol);
            },

            readUnicodeRangePart(allowQuestionMark) {
                const reader  = this._reader;
                let part = "";
                let c       = reader.peek();
                while(isHexDigit(c) && part.length < 6){
                    reader.read();
                    part += c;
                    c = reader.peek();
                }
                if (allowQuestionMark){
                    while(c == "?" && part.length < 6){
                        reader.read();
                        part += c;
                        c = reader.peek();
                    }
                }

                return part;
            },

            readWhitespace() {
                const reader  = this._reader;
                let whitespace = "";
                let c       = reader.peek();

                while(isWhitespace(c)){
                    reader.read();
                    whitespace += c;
                    c = reader.peek();
                }

                return whitespace;
            },
            readNumber(first) {
                const reader  = this._reader;
                let number  = first;
                let hasDot  = (first == ".");
                let c       = reader.peek();


                while(c){
                    if (isDigit(c)){
                        number += reader.read();
                    } else if (c == "."){
                        if (hasDot){
                            break;
                        } else {
                            hasDot = true;
                            number += reader.read();
                        }
                    } else {
                        break;
                    }

                    c = reader.peek();
                }

                return number;
            },
            readString() {
                const reader  = this._reader;
                const delim   = reader.read();
                let string  = delim;
                let prev    = delim;
                let c       = reader.peek();

                while(c){
                    c = reader.read();
                    string += c;
                    if (c == delim && prev != "\\"){
                        break;
                    }
                    if (isNewLine(reader.peek()) && c != "\\"){
                        string = "";
                        break;
                    }
                    prev = c;
                    c = reader.peek();
                }
                if (c === null){
                    string = "";
                }

                return string;
            },
            readURI(first) {
                const reader  = this._reader;
                let uri     = first;
                let inner   = "";
                let c       = reader.peek();

                reader.mark();
                while(c && isWhitespace(c)){
                    reader.read();
                    c = reader.peek();
                }
                if (c == "'" || c == "\""){
                    inner = this.readString();
                } else {
                    inner = this.readURL();
                }

                c = reader.peek();
                while(c && isWhitespace(c)){
                    reader.read();
                    c = reader.peek();
                }
                if (inner === "" || c != ")"){
                    uri = first;
                    reader.reset();
                } else {
                    uri += inner + reader.read();
                }

                return uri;
            },
            readURL() {
                const reader  = this._reader;
                let url     = "";
                let c       = reader.peek();
                while (/^[!#$%&\\*-~]$/.test(c)){
                    url += reader.read();
                    c = reader.peek();
                }

                return url;
            },
            readName(first) {
                const reader  = this._reader;
                let ident   = first || "";
                let c       = reader.peek();

                while(true){
                    if (c == "\\"){
                        ident += this.readEscape(reader.read());
                        c = reader.peek();
                    } else if(c && isNameChar(c)){
                        ident += reader.read();
                        c = reader.peek();
                    } else {
                        break;
                    }
                }

                return ident;
            },

            readEscape(first) {
                const reader  = this._reader;
                let cssEscape = first || "";
                let i       = 0;
                let c       = reader.peek();

                if (isHexDigit(c)){
                    do {
                        cssEscape += reader.read();
                        c = reader.peek();
                    } while(c && isHexDigit(c) && ++i < 6);
                }

                if (cssEscape.length == 3 && /\s/.test(c) ||
                    cssEscape.length == 7 || cssEscape.length == 1){
                        reader.read();
                } else {
                    c = "";
                }

                return cssEscape + c;
            },

            readComment(first) {
                const reader  = this._reader;
                let comment = first || "";
                let c       = reader.read();

                if (c == "*"){
                    while(c){
                        comment += c;
                        if (comment.length > 2 && c == "*" && reader.peek() == "/"){
                            comment += reader.read();
                            break;
                        }

                        c = reader.read();
                    }

                    return comment;
                } else {
                    return "";
                }
            }
        });

        var Tokens  = [
            { name: "CDO"},
            { name: "CDC"},
            { name: "S", whitespace: true/*, channel: "ws"*/},
            { name: "COMMENT", comment: true, hide: true, channel: "comment" },
            { name: "INCLUDES", text: "~="},
            { name: "DASHMATCH", text: "|="},
            { name: "PREFIXMATCH", text: "^="},
            { name: "SUFFIXMATCH", text: "$="},
            { name: "SUBSTRINGMATCH", text: "*="},
            { name: "STRING"},
            { name: "IDENT"},
            { name: "HASH"},
            { name: "IMPORT_SYM", text: "@import"},
            { name: "PAGE_SYM", text: "@page"},
            { name: "MEDIA_SYM", text: "@media"},
            { name: "FONT_FACE_SYM", text: "@font-face"},
            { name: "CHARSET_SYM", text: "@charset"},
            { name: "NAMESPACE_SYM", text: "@namespace"},
            { name: "VIEWPORT_SYM", text: ["@viewport", "@-ms-viewport"]},
            { name: "UNKNOWN_SYM" },
            { name: "KEYFRAMES_SYM", text: [ "@keyframes", "@-webkit-keyframes", "@-moz-keyframes", "@-o-keyframes" ] },
            { name: "IMPORTANT_SYM"},
            { name: "LENGTH"},
            { name: "ANGLE"},
            { name: "TIME"},
            { name: "FREQ"},
            { name: "DIMENSION"},
            { name: "PERCENTAGE"},
            { name: "NUMBER"},
            { name: "URI"},
            { name: "FUNCTION"},
            { name: "UNICODE_RANGE"},
            { name: "INVALID"},
            { name: "PLUS", text: "+" },
            { name: "GREATER", text: ">"},
            { name: "COMMA", text: ","},
            { name: "TILDE", text: "~"},
            { name: "NOT"},
            { name: "TOPLEFTCORNER_SYM", text: "@top-left-corner"},
            { name: "TOPLEFT_SYM", text: "@top-left"},
            { name: "TOPCENTER_SYM", text: "@top-center"},
            { name: "TOPRIGHT_SYM", text: "@top-right"},
            { name: "TOPRIGHTCORNER_SYM", text: "@top-right-corner"},
            { name: "BOTTOMLEFTCORNER_SYM", text: "@bottom-left-corner"},
            { name: "BOTTOMLEFT_SYM", text: "@bottom-left"},
            { name: "BOTTOMCENTER_SYM", text: "@bottom-center"},
            { name: "BOTTOMRIGHT_SYM", text: "@bottom-right"},
            { name: "BOTTOMRIGHTCORNER_SYM", text: "@bottom-right-corner"},
            { name: "LEFTTOP_SYM", text: "@left-top"},
            { name: "LEFTMIDDLE_SYM", text: "@left-middle"},
            { name: "LEFTBOTTOM_SYM", text: "@left-bottom"},
            { name: "RIGHTTOP_SYM", text: "@right-top"},
            { name: "RIGHTMIDDLE_SYM", text: "@right-middle"},
            { name: "RIGHTBOTTOM_SYM", text: "@right-bottom"},
            { name: "RESOLUTION", state: "media"},
            { name: "IE_FUNCTION" },
            { name: "CHAR" },
            {
                name: "PIPE",
                text: "|"
            },
            {
                name: "SLASH",
                text: "/"
            },
            {
                name: "MINUS",
                text: "-"
            },
            {
                name: "STAR",
                text: "*"
            },

            {
                name: "LBRACE",
                endChar: "}",
                text: "{"
            },
            {
                name: "RBRACE",
                text: "}"
            },
            {
                name: "LBRACKET",
                endChar: "]",
                text: "["
            },
            {
                name: "RBRACKET",
                text: "]"
            },
            {
                name: "EQUALS",
                text: "="
            },
            {
                name: "COLON",
                text: ":"
            },
            {
                name: "SEMICOLON",
                text: ";"
            },

            {
                name: "LPAREN",
                endChar: ")",
                text: "("
            },
            {
                name: "RPAREN",
                text: ")"
            },
            {
                name: "DOT",
                text: "."
            }
        ];

        ((() => {
            const nameMap = [];
            const typeMap = {};

            Tokens.UNKNOWN = -1;
            Tokens.unshift({name:"EOF"});
            for (let i=0, len = Tokens.length; i < len; i++){
                nameMap.push(Tokens[i].name);
                Tokens[Tokens[i].name] = i;
                if (Tokens[i].text){
                    if (Tokens[i].text instanceof Array){
                        for (let j=0; j < Tokens[i].text.length; j++){
                            typeMap[Tokens[i].text[j]] = i;
                        }
                    } else {
                        typeMap[Tokens[i].text] = i;
                    }
                }
            }

            Tokens.name = tt => nameMap[tt];

            Tokens.type = c => typeMap[c] || -1;
        }))();
        var Validation = {

            validate(property, value) {
                const name        = property.toString().toLowerCase();
                const parts       = value.parts;
                const expression  = new PropertyValueIterator(value);
                const spec        = Properties[name];
                let part;
                let valid;
                let j;
                let count;
                let msg;
                let types;
                let last;
                let literals;
                let max;
                let multi;
                let group;

                if (!spec) {
                    if (name.indexOf("-") !== 0){    //vendor prefixed are ok
                        throw new ValidationError(`Unknown property '${property}'.`, property.line, property.col);
                    }
                } else if (typeof spec != "number"){
                    if (typeof spec == "string"){
                        if (spec.includes("||")) {
                            this.groupProperty(spec, expression);
                        } else {
                            this.singleProperty(spec, expression, 1);
                        }

                    } else if (spec.multi) {
                        this.multiProperty(spec.multi, expression, spec.comma, spec.max || Infinity);
                    } else if (typeof spec == "function") {
                        spec(expression);
                    }

                }
            },

            singleProperty(types, expression, max, partial) {
                let result      = false;
                const value       = expression.value;
                let count       = 0;
                let part;

                while (expression.hasNext() && count < max) {
                    result = ValidationTypes.isAny(expression, types);
                    if (!result) {
                        break;
                    }
                    count++;
                }

                if (!result) {
                    if (expression.hasNext() && !expression.isFirst()) {
                        part = expression.peek();
                        throw new ValidationError(`Expected end of value but found '${part}'.`, part.line, part.col);
                    } else {
                         throw new ValidationError(`Expected (${types}) but found '${value}'.`, value.line, value.col);
                    }
                } else if (expression.hasNext()) {
                    part = expression.next();
                    throw new ValidationError(`Expected end of value but found '${part}'.`, part.line, part.col);
                }
            },

            multiProperty(types, expression, comma, max) {
                let result      = false;
                const value       = expression.value;
                let count       = 0;
                const sep         = false;
                let part;

                while(expression.hasNext() && !result && count < max) {
                    if (ValidationTypes.isAny(expression, types)) {
                        count++;
                        if (!expression.hasNext()) {
                            result = true;

                        } else if (comma) {
                            if (expression.peek() == ",") {
                                part = expression.next();
                            } else {
                                break;
                            }
                        }
                    } else {
                        break;

                    }
                }

                if (!result) {
                    if (expression.hasNext() && !expression.isFirst()) {
                        part = expression.peek();
                        throw new ValidationError(`Expected end of value but found '${part}'.`, part.line, part.col);
                    } else {
                        part = expression.previous();
                        if (comma && part == ",") {
                            throw new ValidationError(`Expected end of value but found '${part}'.`, part.line, part.col);
                        } else {
                            throw new ValidationError(`Expected (${types}) but found '${value}'.`, value.line, value.col);
                        }
                    }

                } else if (expression.hasNext()) {
                    part = expression.next();
                    throw new ValidationError(`Expected end of value but found '${part}'.`, part.line, part.col);
                }
            },

            groupProperty(types, expression, comma) {
                let result      = false;
                const value       = expression.value;
                const typeCount   = types.split("||").length;
                const groups      = { count: 0 };
                let partial     = false;
                let name;
                let part;

                while(expression.hasNext() && !result) {
                    name = ValidationTypes.isAnyOfGroup(expression, types);
                    if (name) {
                        if (groups[name]) {
                            break;
                        } else {
                            groups[name] = 1;
                            groups.count++;
                            partial = true;

                            if (groups.count == typeCount || !expression.hasNext()) {
                                result = true;
                            }
                        }
                    } else {
                        break;
                    }
                }

                if (!result) {
                    if (partial && expression.hasNext()) {
                            part = expression.peek();
                            throw new ValidationError(`Expected end of value but found '${part}'.`, part.line, part.col);
                    } else {
                        throw new ValidationError(`Expected (${types}) but found '${value}'.`, value.line, value.col);
                    }
                } else if (expression.hasNext()) {
                    part = expression.next();
                    throw new ValidationError(`Expected end of value but found '${part}'.`, part.line, part.col);
                }
            }



        };
        function ValidationError(message, line, col){
            this.col = col;
            this.line = line;
            this.message = message;

        }
        ValidationError.prototype = new Error();
        var ValidationTypes = {

            isLiteral(part, literals) {
                const text = part.text.toString().toLowerCase();
                const args = literals.split(" | ");
                let i;
                let len;
                let found = false;

                for (i=0,len=args.length; i < len && !found; i++){
                    if (text == args[i].toLowerCase()){
                        found = true;
                    }
                }

                return found;
            },

            isSimple(type) {
                return !!this.simple[type];
            },

            isComplex(type) {
                return !!this.complex[type];
            },
            isAny(expression, types) {
                const args = types.split(" | ");
                let i;
                let len;
                let found = false;

                for (i=0,len=args.length; i < len && !found && expression.hasNext(); i++){
                    found = this.isType(expression, args[i]);
                }

                return found;
            },
            isAnyOfGroup(expression, types) {
                const args = types.split(" || ");
                let i;
                let len;
                let found = false;

                for (i=0,len=args.length; i < len && !found; i++){
                    found = this.isType(expression, args[i]);
                }

                return found ? args[i-1] : false;
            },
            isType(expression, type) {
                const part = expression.peek();
                let result = false;

                if (type.charAt(0) != "<") {
                    result = this.isLiteral(part, type);
                    if (result) {
                        expression.next();
                    }
                } else if (this.simple[type]) {
                    result = this.simple[type](part);
                    if (result) {
                        expression.next();
                    }
                } else {
                    result = this.complex[type](expression);
                }

                return result;
            },



            simple: {

                "<absolute-size>"(part) {
                    return ValidationTypes.isLiteral(part, "xx-small | x-small | small | medium | large | x-large | xx-large");
                },

                "<attachment>"(part) {
                    return ValidationTypes.isLiteral(part, "scroll | fixed | local");
                },

                "<attr>"(part) {
                    return part.type == "function" && part.name == "attr";
                },

                "<bg-image>"(part) {
                    return this["<image>"](part) || this["<gradient>"](part) ||  part == "none";
                },

                "<gradient>"(part) {
                    return part.type == "function" && /^(?:\-(?:ms|moz|o|webkit)\-)?(?:repeating\-)?(?:radial\-|linear\-)?gradient/i.test(part);
                },

                "<box>"(part) {
                    return ValidationTypes.isLiteral(part, "padding-box | border-box | content-box");
                },

                "<content>"(part) {
                    return part.type == "function" && part.name == "content";
                },

                "<relative-size>"(part) {
                    return ValidationTypes.isLiteral(part, "smaller | larger");
                },
                "<ident>"(part) {
                    return part.type == "identifier";
                },

                "<length>"(part) {
                    if (part.type == "function" && /^(?:\-(?:ms|moz|o|webkit)\-)?calc/i.test(part)){
                        return true;
                    }else{
                        return part.type == "length" || part.type == "number" || part.type == "integer" || part == "0";
                    }
                },

                "<color>"(part) {
                    return part.type == "color" || part == "transparent";
                },

                "<number>"(part) {
                    return part.type == "number" || this["<integer>"](part);
                },

                "<integer>"(part) {
                    return part.type == "integer";
                },

                "<line>"(part) {
                    return part.type == "integer";
                },

                "<angle>"(part) {
                    return part.type == "angle";
                },

                "<uri>"(part) {
                    return part.type == "uri";
                },

                "<image>"(part) {
                    return this["<uri>"](part);
                },

                "<percentage>"(part) {
                    return part.type == "percentage" || part == "0";
                },

                "<border-width>"(part) {
                    return this["<length>"](part) || ValidationTypes.isLiteral(part, "thin | medium | thick");
                },

                "<border-style>"(part) {
                    return ValidationTypes.isLiteral(part, "none | hidden | dotted | dashed | solid | double | groove | ridge | inset | outset");
                },

                "<content-sizing>"(part) { // http://www.w3.org/TR/css3-sizing/#width-height-keywords
                    return ValidationTypes.isLiteral(part, "fill-available | -moz-available | -webkit-fill-available | max-content | -moz-max-content | -webkit-max-content | min-content | -moz-min-content | -webkit-min-content | fit-content | -moz-fit-content | -webkit-fit-content");
                },

                "<margin-width>"(part) {
                    return this["<length>"](part) || this["<percentage>"](part) || ValidationTypes.isLiteral(part, "auto");
                },

                "<padding-width>"(part) {
                    return this["<length>"](part) || this["<percentage>"](part);
                },

                "<shape>"(part) {
                    return part.type == "function" && (part.name == "rect" || part.name == "inset-rect");
                },

                "<time>"(part) {
                    return part.type == "time";
                },

                "<flex-grow>"(part) {
                    return this["<number>"](part);
                },

                "<flex-shrink>"(part) {
                    return this["<number>"](part);
                },

                "<width>"(part) {
                    return this["<margin-width>"](part);
                },

                "<flex-basis>"(part) {
                    return this["<width>"](part);
                },

                "<flex-direction>"(part) {
                    return ValidationTypes.isLiteral(part, "row | row-reverse | column | column-reverse");
                },

                "<flex-wrap>"(part) {
                    return ValidationTypes.isLiteral(part, "nowrap | wrap | wrap-reverse");
                }
            },

            complex: {

                "<bg-position>"(expression) {
                    const types   = this;
                    let result  = false;
                    const numeric = "<percentage> | <length>";
                    const xDir    = "left | right";
                    const yDir    = "top | bottom";
                    let count = 0;
                    const hasNext = () => expression.hasNext() && expression.peek() != ",";

                    while (expression.peek(count) && expression.peek(count) != ",") {
                        count++;
                    }

                    if (count < 3) {
                        if (ValidationTypes.isAny(expression, `${xDir} | center | ${numeric}`)) {
                                result = true;
                                ValidationTypes.isAny(expression, `${yDir} | center | ${numeric}`);
                        } else if (ValidationTypes.isAny(expression, yDir)) {
                                result = true;
                                ValidationTypes.isAny(expression, `${xDir} | center`);
                        }
                    } else {
                        if (ValidationTypes.isAny(expression, xDir)) {
                            if (ValidationTypes.isAny(expression, yDir)) {
                                result = true;
                                ValidationTypes.isAny(expression, numeric);
                            } else if (ValidationTypes.isAny(expression, numeric)) {
                                if (ValidationTypes.isAny(expression, yDir)) {
                                    result = true;
                                    ValidationTypes.isAny(expression, numeric);
                                } else if (ValidationTypes.isAny(expression, "center")) {
                                    result = true;
                                }
                            }
                        } else if (ValidationTypes.isAny(expression, yDir)) {
                            if (ValidationTypes.isAny(expression, xDir)) {
                                result = true;
                                ValidationTypes.isAny(expression, numeric);
                            } else if (ValidationTypes.isAny(expression, numeric)) {
                                if (ValidationTypes.isAny(expression, xDir)) {
                                        result = true;
                                        ValidationTypes.isAny(expression, numeric);
                                } else if (ValidationTypes.isAny(expression, "center")) {
                                    result = true;
                                }
                            }
                        } else if (ValidationTypes.isAny(expression, "center")) {
                            if (ValidationTypes.isAny(expression, `${xDir} | ${yDir}`)) {
                                result = true;
                                ValidationTypes.isAny(expression, numeric);
                            }
                        }
                    }

                    return result;
                },

                "<bg-size>"(expression) {
                    const types   = this;
                    let result  = false;
                    const numeric = "<percentage> | <length> | auto";
                    let part;
                    let i;
                    let len;

                    if (ValidationTypes.isAny(expression, "cover | contain")) {
                        result = true;
                    } else if (ValidationTypes.isAny(expression, numeric)) {
                        result = true;
                        ValidationTypes.isAny(expression, numeric);
                    }

                    return result;
                },

                "<repeat-style>"(expression) {
                    let result  = false;
                    const values  = "repeat | space | round | no-repeat";
                    let part;

                    if (expression.hasNext()){
                        part = expression.next();

                        if (ValidationTypes.isLiteral(part, "repeat-x | repeat-y")) {
                            result = true;
                        } else if (ValidationTypes.isLiteral(part, values)) {
                            result = true;

                            if (expression.hasNext() && ValidationTypes.isLiteral(expression.peek(), values)) {
                                expression.next();
                            }
                        }
                    }

                    return result;
                },

                "<shadow>"(expression) {
                    let result  = false;
                    let count   = 0;
                    let inset   = false;
                    let color   = false;
                    let part;

                    if (expression.hasNext()) {

                        if (ValidationTypes.isAny(expression, "inset")){
                            inset = true;
                        }

                        if (ValidationTypes.isAny(expression, "<color>")) {
                            color = true;
                        }

                        while (ValidationTypes.isAny(expression, "<length>") && count < 4) {
                            count++;
                        }


                        if (expression.hasNext()) {
                            if (!color) {
                                ValidationTypes.isAny(expression, "<color>");
                            }

                            if (!inset) {
                                ValidationTypes.isAny(expression, "inset");
                            }

                        }

                        result = (count >= 2 && count <= 4);

                    }

                    return result;
                },

                "<x-one-radius>"(expression) {
                    let result  = false;
                    const simple = "<length> | <percentage> | inherit";

                    if (ValidationTypes.isAny(expression, simple)){
                        result = true;
                        ValidationTypes.isAny(expression, simple);
                    }

                    return result;
                },

                "<flex>"(expression) {
                    let part;
                    let result = false;
                    if (ValidationTypes.isAny(expression, "none | inherit")) {
                        result = true;
                    } else {
                        if (ValidationTypes.isType(expression, "<flex-grow>")) {
                            if (expression.peek()) {
                                if (ValidationTypes.isType(expression, "<flex-shrink>")) {
                                    if (expression.peek()) {
                                        result = ValidationTypes.isType(expression, "<flex-basis>");
                                    } else {
                                        result = true;
                                    }
                                } else if (ValidationTypes.isType(expression, "<flex-basis>")) {
                                    result = expression.peek() === null;
                                }
                            } else {
                                result = true;
                            }
                        } else if (ValidationTypes.isType(expression, "<flex-basis>")) {
                            result = true;
                        }
                    }

                    if (!result) {
                        part = expression.peek();
                        throw new ValidationError(`Expected (none | [ <flex-grow> <flex-shrink>? || <flex-basis> ]) but found '${expression.value.text}'.`, part.line, part.col);
                    }

                    return result;
                }
            }
        };

        parserlib.css = {
        Colors,
        Combinator,
        Parser,
        PropertyName,
        PropertyValue,
        PropertyValuePart,
        MediaFeature,
        MediaQuery,
        Selector,
        SelectorPart,
        SelectorSubPart,
        Specificity,
        TokenStream,
        Tokens,
        ValidationError
        };
    }))();

    ((() => {
    for(const prop in parserlib){
    exports[prop] = parserlib[prop];
    }
    }))();


    function objectToString(o) {
      return Object.prototype.toString.call(o);
    }
    const util = {
      isArray(ar) {
        return Array.isArray(ar) || (typeof ar === 'object' && objectToString(ar) === '[object Array]');
      },
      isDate(d) {
        return typeof d === 'object' && objectToString(d) === '[object Date]';
      },
      isRegExp(re) {
        return typeof re === 'object' && objectToString(re) === '[object RegExp]';
      },
      getRegExpFlags(re) {
        let flags = '';
        re.global && (flags += 'g');
        re.ignoreCase && (flags += 'i');
        re.multiline && (flags += 'm');
        return flags;
      }
    };


    if (typeof module === 'object')
      module.exports = clone;

    class clone {
        constructor(parent, circular, depth, prototype) {
          const allParents = [];
          const allChildren = [];

          const useBuffer = typeof Buffer != 'undefined';

          if (typeof circular == 'undefined')
            circular = true;

          if (typeof depth == 'undefined')
            depth = Infinity;
          function _clone(parent, depth) {
            if (parent === null)
              return null;

            if (depth == 0)
              return parent;

            let child;
            if (typeof parent != 'object') {
              return parent;
            }

            if (util.isArray(parent)) {
              child = [];
            } else if (util.isRegExp(parent)) {
              child = new RegExp(parent.source, util.getRegExpFlags(parent));
              if (parent.lastIndex) child.lastIndex = parent.lastIndex;
            } else if (util.isDate(parent)) {
              child = new Date(parent.getTime());
            } else if (useBuffer && Buffer.isBuffer(parent)) {
              child = new Buffer(parent.length);
              parent.copy(child);
              return child;
            } else {
              if (typeof prototype == 'undefined') child = Object.create(Object.getPrototypeOf(parent));
              else child = Object.create(prototype);
            }

            if (circular) {
              const index = allParents.indexOf(parent);

              if (index != -1) {
                return allChildren[index];
              }
              allParents.push(parent);
              allChildren.push(child);
            }

            for (const i in parent) {
              child[i] = _clone(parent[i], depth - 1);
            }

            return child;
          }

          return _clone(parent, depth);
        }

        static clonePrototype(parent) {
          if (parent === null)
            return null;

          const c = () => {};
          c.prototype = parent;
          return new c();
        }
    }

    const CSSLint = ((() => {
        let rules           = [];
        const formatters      = [];
        const embeddedRuleset = /\/\*csslint([^\*]*)\*\//;
        const api             = new parserlib.util.EventTarget();

        api.version = "@VERSION@";
        api.addRule = rule => {
            rules.push(rule);
            rules[rule.id] = rule;
        };
        api.clearRules = () => {
            rules = [];
        };
        api.getRules = () => [].concat(rules).sort((a, b) => a.id > b.id ? 1 : 0);
        api.getRuleset = () => {
            const ruleset = {};
            let i = 0;
            const len = rules.length;

            while (i < len){
                ruleset[rules[i++].id] = 1;    //by default, everything is a warning
            }

            return ruleset;
        };
        function applyEmbeddedRuleset(text, ruleset){
            let valueMap;
            const embedded = text && text.match(embeddedRuleset);
            const rules = embedded && embedded[1];

            if (rules) {
                valueMap = {
                    "true": 2,  // true is error
                    "": 1,      // blank is warning
                    "false": 0, // false is ignore

                    "2": 2,     // explicit error
                    "1": 1,     // explicit warning
                    "0": 0      // explicit ignore
                };

                rules.toLowerCase().split(",").forEach(rule => {
                    const pair = rule.split(":");
                    const property = pair[0] || "";
                    const value = pair[1] || "";

                    ruleset[property.trim()] = valueMap[value.trim()];
                });
            }

            return ruleset;
        }
        api.addFormatter = formatter => {
            formatters[formatter.id] = formatter;
        };
        api.getFormatter = formatId => formatters[formatId];
        api.format = function(results, filename, formatId, options) {
            const formatter = this.getFormatter(formatId);
            let result = null;

            if (formatter){
                result = formatter.startFormat();
                result += formatter.formatResults(results, filename, options || {});
                result += formatter.endFormat();
            }

            return result;
        };
        api.hasFormat = formatId => formatters.hasOwnProperty(formatId);
        api.verify = function(text, ruleset){
            const i = 0;
            let reporter;
            let lines;
            let report;

            const parser = new parserlib.css.Parser({ starHack: true, ieFilters: true,
                                                underscoreHack: true, strict: false });

            lines = text.replace(/\n\r?/g, "$split$").split("$split$");

            if (!ruleset){
                ruleset = this.getRuleset();
            }

            if (embeddedRuleset.test(text)){
                ruleset = clone(ruleset);
                ruleset = applyEmbeddedRuleset(text, ruleset);
            }

            reporter = new Reporter(lines, ruleset);

            ruleset.errors = 2;       //always report parsing errors as errors
            for (i in ruleset){
                if(ruleset.hasOwnProperty(i) && ruleset[i]){
                    if (rules[i]){
                        rules[i].init(parser, reporter);
                    }
                }
            }
            try {
                parser.parse(text);
            } catch (ex) {
                reporter.error(`Fatal error, cannot continue: ${ex.message}`, ex.line, ex.col, {});
            }

            report = {
                messages    : reporter.messages,
                stats       : reporter.stats,
                ruleset     : reporter.ruleset
            };
            report.messages.sort((a, b) => {
                if (a.rollup && !b.rollup){
                    return 1;
                } else if (!a.rollup && b.rollup){
                    return -1;
                } else {
                    return a.line - b.line;
                }
            });

            return report;
        };

        return api;
    }))();
    function Reporter(lines, ruleset){
        this.messages = [];
        this.stats = [];
        this.lines = lines;
        this.ruleset = ruleset;
    }

    Reporter.prototype = {
        constructor: Reporter,
        error(message, line, col, rule) {
            this.messages.push({
                type    : "error",
                line,
                col,
                message,
                evidence: this.lines[line-1],
                rule    : rule || {}
            });
        },
        warn(message, line, col, rule) {
            this.report(message, line, col, rule);
        },
        report(message, line, col, rule) {
            this.messages.push({
                type    : this.ruleset[rule.id] === 2 ? "error" : "warning",
                line,
                col,
                message,
                evidence: this.lines[line-1],
                rule
            });
        },
        info(message, line, col, rule) {
            this.messages.push({
                type    : "info",
                line,
                col,
                message,
                evidence: this.lines[line-1],
                rule
            });
        },
        rollupError(message, rule) {
            this.messages.push({
                type    : "error",
                rollup  : true,
                message,
                rule
            });
        },
        rollupWarn(message, rule) {
            this.messages.push({
                type    : "warning",
                rollup  : true,
                message,
                rule
            });
        },
        stat(name, value) {
            this.stats[name] = value;
        }
    };
    CSSLint._Reporter = Reporter;
    CSSLint.Util = {
        mix(receiver, supplier) {
            let prop;

            for (prop in supplier){
                if (supplier.hasOwnProperty(prop)){
                    receiver[prop] = supplier[prop];
                }
            }

            return prop;
        },
        indexOf(values, value) {
            if (values.indexOf){
                return values.indexOf(value);
            } else {
                for (let i=0, len=values.length; i < len; i++){
                    if (values[i] === value){
                        return i;
                    }
                }
                return -1;
            }
        },
        forEach(values, func) {
            if (values.forEach){
                return values.forEach(func);
            } else {
                for (let i=0, len=values.length; i < len; i++){
                    func(values[i], i, values);
                }
            }
        }
    };

    CSSLint.addRule({
        id: "adjoining-classes",
        name: "Disallow adjoining classes",
        desc: "Don't use adjoining classes.",
        browsers: "IE6",
        init(parser, reporter) {
            const rule = this;
            parser.addListener("startrule", event => {
                const selectors = event.selectors;
                let selector;
                let part;
                let modifier;
                let classCount;
                let i;
                let j;
                let k;

                for (i=0; i < selectors.length; i++){
                    selector = selectors[i];
                    for (j=0; j < selector.parts.length; j++){
                        part = selector.parts[j];
                        if (part.type === parser.SELECTOR_PART_TYPE){
                            classCount = 0;
                            for (k=0; k < part.modifiers.length; k++){
                                modifier = part.modifiers[k];
                                if (modifier.type === "class"){
                                    classCount++;
                                }
                                if (classCount > 1){
                                    reporter.report("Don't use adjoining classes.", part.line, part.col, rule);
                                }
                            }
                        }
                    }
                }
            });
        }

    });
    CSSLint.addRule({
        id: "box-model",
        name: "Beware of broken box size",
        desc: "Don't use width or height when using padding or border.",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;

            const widthProperties = {
                border: 1,
                "border-left": 1,
                "border-right": 1,
                padding: 1,
                "padding-left": 1,
                "padding-right": 1
            };

            const heightProperties = {
                border: 1,
                "border-bottom": 1,
                "border-top": 1,
                padding: 1,
                "padding-bottom": 1,
                "padding-top": 1
            };

            let properties;
            let boxSizing = false;

            function startRule(){
                properties = {};
                boxSizing = false;
            }

            function endRule(){
                let prop;
                let value;

                if (!boxSizing) {
                    if (properties.height){
                        for (prop in heightProperties){
                            if (heightProperties.hasOwnProperty(prop) && properties[prop]){
                                value = properties[prop].value;
                                if (!(prop === "padding" && value.parts.length === 2 && value.parts[0].value === 0)){
                                    reporter.report(`Using height with ${prop} can sometimes make elements larger than you expect.`, properties[prop].line, properties[prop].col, rule);
                                }
                            }
                        }
                    }

                    if (properties.width){
                        for (prop in widthProperties){
                            if (widthProperties.hasOwnProperty(prop) && properties[prop]){
                                value = properties[prop].value;

                                if (!(prop === "padding" && value.parts.length === 2 && value.parts[1].value === 0)){
                                    reporter.report(`Using width with ${prop} can sometimes make elements larger than you expect.`, properties[prop].line, properties[prop].col, rule);
                                }
                            }
                        }
                    }
                }
            }

            parser.addListener("startrule", startRule);
            parser.addListener("startfontface", startRule);
            parser.addListener("startpage", startRule);
            parser.addListener("startpagemargin", startRule);
            parser.addListener("startkeyframerule", startRule);

            parser.addListener("property", event => {
                const name = event.property.text.toLowerCase();

                if (heightProperties[name] || widthProperties[name]){
                    if (!/^0\S*$/.test(event.value) && !(name === "border" && event.value.toString() === "none")){
                        properties[name] = { line: event.property.line, col: event.property.col, value: event.value };
                    }
                } else {
                    if (/^(width|height)/i.test(name) && /^(length|percentage)/.test(event.value.parts[0].type)){
                        properties[name] = 1;
                    } else if (name === "box-sizing") {
                        boxSizing = true;
                    }
                }

            });

            parser.addListener("endrule", endRule);
            parser.addListener("endfontface", endRule);
            parser.addListener("endpage", endRule);
            parser.addListener("endpagemargin", endRule);
            parser.addListener("endkeyframerule", endRule);
        }

    });

    CSSLint.addRule({
        id: "box-sizing",
        name: "Disallow use of box-sizing",
        desc: "The box-sizing properties isn't supported in IE6 and IE7.",
        browsers: "IE6, IE7",
        tags: ["Compatibility"],
        init(parser, reporter) {
            const rule = this;

            parser.addListener("property", event => {
                const name = event.property.text.toLowerCase();

                if (name === "box-sizing"){
                    reporter.report("The box-sizing property isn't supported in IE6 and IE7.", event.line, event.col, rule);
                }
            });
        }

    });

    CSSLint.addRule({
        id: "bulletproof-font-face",
        name: "Use the bulletproof @font-face syntax",
        desc: "Use the bulletproof @font-face syntax to avoid 404's in old IE (http://www.fontspring.com/blog/the-new-bulletproof-font-face-syntax).",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;
            let fontFaceRule = false;
            let firstSrc     = true;
            let ruleFailed    = false;
            let line;
            let col;
            parser.addListener("startfontface", () => {
                fontFaceRule = true;
            });

            parser.addListener("property", event => {
                if (!fontFaceRule) {
                    return;
                }

                const propertyName = event.property.toString().toLowerCase();
                const value        = event.value.toString();
                line = event.line;
                col  = event.col;
                if (propertyName === "src") {
                    const regex = /^\s?url\(['"].+\.eot\?.*['"]\)\s*format\(['"]embedded-opentype['"]\).*$/i;
                    if (!value.match(regex) && firstSrc) {
                        ruleFailed = true;
                        firstSrc = false;
                    } else if (value.match(regex) && !firstSrc) {
                        ruleFailed = false;
                    }
                }
            });
            parser.addListener("endfontface", () => {
                fontFaceRule = false;

                if (ruleFailed) {
                    reporter.report("@font-face declaration doesn't follow the fontspring bulletproof syntax.", line, col, rule);
                }
            });
        }
    });

    CSSLint.addRule({
        id: "compatible-vendor-prefixes",
        name: "Require compatible vendor prefixes",
        desc: "Include all compatible vendor prefixes to reach a wider range of users.",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;
            let compatiblePrefixes;
            let properties;
            let prop;
            let variations;
            let prefixed;
            let i;
            let len;
            let inKeyFrame = false;
            const arrayPush = Array.prototype.push;
            const applyTo = [];
            compatiblePrefixes = {
                "animation"                  : "webkit moz",
                "animation-delay"            : "webkit moz",
                "animation-direction"        : "webkit moz",
                "animation-duration"         : "webkit moz",
                "animation-fill-mode"        : "webkit moz",
                "animation-iteration-count"  : "webkit moz",
                "animation-name"             : "webkit moz",
                "animation-play-state"       : "webkit moz",
                "animation-timing-function"  : "webkit moz",
                "appearance"                 : "webkit moz",
                "border-end"                 : "webkit moz",
                "border-end-color"           : "webkit moz",
                "border-end-style"           : "webkit moz",
                "border-end-width"           : "webkit moz",
                "border-image"               : "webkit moz o",
                "border-radius"              : "webkit",
                "border-start"               : "webkit moz",
                "border-start-color"         : "webkit moz",
                "border-start-style"         : "webkit moz",
                "border-start-width"         : "webkit moz",
                "box-align"                  : "webkit moz ms",
                "box-direction"              : "webkit moz ms",
                "box-flex"                   : "webkit moz ms",
                "box-lines"                  : "webkit ms",
                "box-ordinal-group"          : "webkit moz ms",
                "box-orient"                 : "webkit moz ms",
                "box-pack"                   : "webkit moz ms",
                "box-sizing"                 : "webkit moz",
                "box-shadow"                 : "webkit moz",
                "column-count"               : "webkit moz ms",
                "column-gap"                 : "webkit moz ms",
                "column-rule"                : "webkit moz ms",
                "column-rule-color"          : "webkit moz ms",
                "column-rule-style"          : "webkit moz ms",
                "column-rule-width"          : "webkit moz ms",
                "column-width"               : "webkit moz ms",
                "hyphens"                    : "epub moz",
                "line-break"                 : "webkit ms",
                "margin-end"                 : "webkit moz",
                "margin-start"               : "webkit moz",
                "marquee-speed"              : "webkit wap",
                "marquee-style"              : "webkit wap",
                "padding-end"                : "webkit moz",
                "padding-start"              : "webkit moz",
                "tab-size"                   : "moz o",
                "text-size-adjust"           : "webkit ms",
                "transform"                  : "webkit moz ms o",
                "transform-origin"           : "webkit moz ms o",
                "transition"                 : "webkit moz o",
                "transition-delay"           : "webkit moz o",
                "transition-duration"        : "webkit moz o",
                "transition-property"        : "webkit moz o",
                "transition-timing-function" : "webkit moz o",
                "user-modify"                : "webkit moz",
                "user-select"                : "webkit moz ms",
                "word-break"                 : "epub ms",
                "writing-mode"               : "epub ms"
            };


            for (prop in compatiblePrefixes) {
                if (compatiblePrefixes.hasOwnProperty(prop)) {
                    variations = [];
                    prefixed = compatiblePrefixes[prop].split(" ");
                    for (i = 0, len = prefixed.length; i < len; i++) {
                        variations.push(`-${prefixed[i]}-${prop}`);
                    }
                    compatiblePrefixes[prop] = variations;
                    arrayPush.apply(applyTo, variations);
                }
            }

            parser.addListener("startrule", () => {
                properties = [];
            });

            parser.addListener("startkeyframes", event => {
                inKeyFrame = event.prefix || true;
            });

            parser.addListener("endkeyframes", () => {
                inKeyFrame = false;
            });

            parser.addListener("property", event => {
                const name = event.property;
                if (CSSLint.Util.indexOf(applyTo, name.text) > -1) {
                    if (!inKeyFrame || typeof inKeyFrame !== "string" ||
                            name.text.indexOf(`-${inKeyFrame}-`) !== 0) {
                        properties.push(name);
                    }
                }
            });

            parser.addListener("endrule", () => {
                if (!properties.length) {
                    return;
                }

                const propertyGroups = {};
                let i;
                let len;
                let name;
                let prop;
                let variations;
                let value;
                let full;
                let actual;
                let item;
                let propertiesSpecified;

                for (i = 0, len = properties.length; i < len; i++) {
                    name = properties[i];

                    for (prop in compatiblePrefixes) {
                        if (compatiblePrefixes.hasOwnProperty(prop)) {
                            variations = compatiblePrefixes[prop];
                            if (CSSLint.Util.indexOf(variations, name.text) > -1) {
                                if (!propertyGroups[prop]) {
                                    propertyGroups[prop] = {
                                        full : variations.slice(0),
                                        actual : [],
                                        actualNodes: []
                                    };
                                }
                                if (CSSLint.Util.indexOf(propertyGroups[prop].actual, name.text) === -1) {
                                    propertyGroups[prop].actual.push(name.text);
                                    propertyGroups[prop].actualNodes.push(name);
                                }
                            }
                        }
                    }
                }

                for (prop in propertyGroups) {
                    if (propertyGroups.hasOwnProperty(prop)) {
                        value = propertyGroups[prop];
                        full = value.full;
                        actual = value.actual;

                        if (full.length > actual.length) {
                            for (i = 0, len = full.length; i < len; i++) {
                                item = full[i];
                                if (CSSLint.Util.indexOf(actual, item) === -1) {
                                    propertiesSpecified = (actual.length === 1) ? actual[0] : (actual.length === 2) ? actual.join(" and ") : actual.join(", ");
                                    reporter.report(`The property ${item} is compatible with ${propertiesSpecified} and should be included as well.`, value.actualNodes[0].line, value.actualNodes[0].col, rule);
                                }
                            }

                        }
                    }
                }
            });
        }
    });

    CSSLint.addRule({
        id: "display-property-grouping",
        name: "Require properties appropriate for display",
        desc: "Certain properties shouldn't be used with certain display property values.",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;

            const propertiesToCheck = {
                    display: 1,
                    "float": "none",
                    height: 1,
                    width: 1,
                    margin: 1,
                    "margin-left": 1,
                    "margin-right": 1,
                    "margin-bottom": 1,
                    "margin-top": 1,
                    padding: 1,
                    "padding-left": 1,
                    "padding-right": 1,
                    "padding-bottom": 1,
                    "padding-top": 1,
                    "vertical-align": 1
                };

            let properties;

            function reportProperty(name, display, msg){
                if (properties[name]){
                    if (typeof propertiesToCheck[name] !== "string" || properties[name].value.toLowerCase() !== propertiesToCheck[name]){
                        reporter.report(msg || `${name} can't be used with display: ${display}.`, properties[name].line, properties[name].col, rule);
                    }
                }
            }

            function startRule(){
                properties = {};
            }

            function endRule(){

                const display = properties.display ? properties.display.value : null;
                if (display){
                    switch(display){

                        case "inline":
                            reportProperty("height", display);
                            reportProperty("width", display);
                            reportProperty("margin", display);
                            reportProperty("margin-top", display);
                            reportProperty("margin-bottom", display);
                            reportProperty("float", display, "display:inline has no effect on floated elements (but may be used to fix the IE6 double-margin bug).");
                            break;

                        case "block":
                            reportProperty("vertical-align", display);
                            break;

                        case "inline-block":
                            reportProperty("float", display);
                            break;

                        default:
                            if (display.indexOf("table-") === 0){
                                reportProperty("margin", display);
                                reportProperty("margin-left", display);
                                reportProperty("margin-right", display);
                                reportProperty("margin-top", display);
                                reportProperty("margin-bottom", display);
                                reportProperty("float", display);
                            }
                    }
                }

            }

            parser.addListener("startrule", startRule);
            parser.addListener("startfontface", startRule);
            parser.addListener("startkeyframerule", startRule);
            parser.addListener("startpagemargin", startRule);
            parser.addListener("startpage", startRule);

            parser.addListener("property", event => {
                const name = event.property.text.toLowerCase();

                if (propertiesToCheck[name]){
                    properties[name] = { value: event.value.text, line: event.property.line, col: event.property.col };
                }
            });

            parser.addListener("endrule", endRule);
            parser.addListener("endfontface", endRule);
            parser.addListener("endkeyframerule", endRule);
            parser.addListener("endpagemargin", endRule);
            parser.addListener("endpage", endRule);
        }

    });

    CSSLint.addRule({
        id: "duplicate-background-images",
        name: "Disallow duplicate background images",
        desc: "Every background-image should be unique. Use a common class for e.g. sprites.",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;
            const stack = {};

            parser.addListener("property", event => {
                const name = event.property.text;
                const value = event.value;
                let i;
                let len;

                if (name.match(/background/i)) {
                    for (i=0, len=value.parts.length; i < len; i++) {
                        if (value.parts[i].type === "uri") {
                            if (typeof stack[value.parts[i].uri] === "undefined") {
                                stack[value.parts[i].uri] = event;
                            }
                            else {
                                reporter.report(`Background image '${value.parts[i].uri}' was used multiple times, first declared at line ${stack[value.parts[i].uri].line}, col ${stack[value.parts[i].uri].col}.`, event.line, event.col, rule);
                            }
                        }
                    }
                }
            });
        }
    });

    CSSLint.addRule({
        id: "duplicate-properties",
        name: "Disallow duplicate properties",
        desc: "Duplicate properties must appear one after the other.",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;
            let properties;
            let lastProperty;

            function startRule(){
                properties = {};
            }

            parser.addListener("startrule", startRule);
            parser.addListener("startfontface", startRule);
            parser.addListener("startpage", startRule);
            parser.addListener("startpagemargin", startRule);
            parser.addListener("startkeyframerule", startRule);

            parser.addListener("property", event => {
                const property = event.property;
                const name = property.text.toLowerCase();

                if (properties[name] && (lastProperty !== name || properties[name] === event.value.text)){
                    reporter.report(`Duplicate property '${event.property}' found.`, event.line, event.col, rule);
                }

                properties[name] = event.value.text;
                lastProperty = name;
            });
        }

    });

    CSSLint.addRule({
        id: "empty-rules",
        name: "Disallow empty rules",
        desc: "Rules without any properties specified should be removed.",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;
            let count = 0;

            parser.addListener("startrule", () => {
                count=0;
            });

            parser.addListener("property", () => {
                count++;
            });

            parser.addListener("endrule", event => {
                const selectors = event.selectors;
                if (count === 0){
                    reporter.report("Rule is empty.", selectors[0].line, selectors[0].col, rule);
                }
            });
        }

    });

    CSSLint.addRule({
        id: "errors",
        name: "Parsing Errors",
        desc: "This rule looks for recoverable syntax errors.",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;

            parser.addListener("error", event => {
                reporter.error(event.message, event.line, event.col, rule);
            });

        }

    });

    CSSLint.addRule({
        id: "fallback-colors",
        name: "Require fallback colors",
        desc: "For older browsers that don't support RGBA, HSL, or HSLA, provide a fallback color.",
        browsers: "IE6,IE7,IE8",
        init(parser, reporter) {
            const rule = this;
            let lastProperty;

            const propertiesToCheck = {
                color: 1,
                background: 1,
                "border-color": 1,
                "border-top-color": 1,
                "border-right-color": 1,
                "border-bottom-color": 1,
                "border-left-color": 1,
                border: 1,
                "border-top": 1,
                "border-right": 1,
                "border-bottom": 1,
                "border-left": 1,
                "background-color": 1
            };

            let properties;

            function startRule(){
                properties = {};
                lastProperty = null;
            }

            parser.addListener("startrule", startRule);
            parser.addListener("startfontface", startRule);
            parser.addListener("startpage", startRule);
            parser.addListener("startpagemargin", startRule);
            parser.addListener("startkeyframerule", startRule);

            parser.addListener("property", event => {
                const property = event.property;
                const name = property.text.toLowerCase();
                const parts = event.value.parts;
                let i = 0;
                let colorType = "";
                const len = parts.length;

                if(propertiesToCheck[name]){
                    while(i < len){
                        if (parts[i].type === "color"){
                            if ("alpha" in parts[i] || "hue" in parts[i]){

                                if (/([^\)]+)\(/.test(parts[i])){
                                    colorType = RegExp.$1.toUpperCase();
                                }

                                if (!lastProperty || (lastProperty.property.text.toLowerCase() !== name || lastProperty.colorType !== "compat")){
                                    reporter.report(`Fallback ${name} (hex or RGB) should precede ${colorType} ${name}.`, event.line, event.col, rule);
                                }
                            } else {
                                event.colorType = "compat";
                            }
                        }

                        i++;
                    }
                }

                lastProperty = event;
            });
        }

    });

    CSSLint.addRule({
        id: "floats",
        name: "Disallow too many floats",
        desc: "This rule tests if the float property is used too many times",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;
            let count = 0;
            parser.addListener("property", event => {
                if (event.property.text.toLowerCase() === "float" &&
                        event.value.text.toLowerCase() !== "none"){
                    count++;
                }
            });
            parser.addListener("endstylesheet", () => {
                reporter.stat("floats", count);
                if (count >= 10){
                    reporter.rollupWarn(`Too many floats (${count}), you're probably using them for layout. Consider using a grid system instead.`, rule);
                }
            });
        }

    });

    CSSLint.addRule({
        id: "font-faces",
        name: "Don't use too many web fonts",
        desc: "Too many different web fonts in the same stylesheet.",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;
            let count = 0;


            parser.addListener("startfontface", () => {
                count++;
            });

            parser.addListener("endstylesheet", () => {
                if (count > 5){
                    reporter.rollupWarn(`Too many @font-face declarations (${count}).`, rule);
                }
            });
        }

    });

    CSSLint.addRule({
        id: "font-sizes",
        name: "Disallow too many font sizes",
        desc: "Checks the number of font-size declarations.",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;
            let count = 0;
            parser.addListener("property", event => {
                if (event.property.toString() === "font-size"){
                    count++;
                }
            });
            parser.addListener("endstylesheet", () => {
                reporter.stat("font-sizes", count);
                if (count >= 10){
                    reporter.rollupWarn(`Too many font-size declarations (${count}), abstraction needed.`, rule);
                }
            });
        }

    });

    CSSLint.addRule({
        id: "gradients",
        name: "Require all gradient definitions",
        desc: "When using a vendor-prefixed gradient, make sure to use them all.",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;
            let gradients;

            parser.addListener("startrule", () => {
                gradients = {
                    moz: 0,
                    webkit: 0,
                    oldWebkit: 0,
                    o: 0
                };
            });

            parser.addListener("property", event => {

                if (/\-(moz|o|webkit)(?:\-(?:linear|radial))\-gradient/i.test(event.value)){
                    gradients[RegExp.$1] = 1;
                } else if (/\-webkit\-gradient/i.test(event.value)){
                    gradients.oldWebkit = 1;
                }

            });

            parser.addListener("endrule", event => {
                const missing = [];

                if (!gradients.moz){
                    missing.push("Firefox 3.6+");
                }

                if (!gradients.webkit){
                    missing.push("Webkit (Safari 5+, Chrome)");
                }

                if (!gradients.oldWebkit){
                    missing.push("Old Webkit (Safari 4+, Chrome)");
                }

                if (!gradients.o){
                    missing.push("Opera 11.1+");
                }

                if (missing.length && missing.length < 4){
                    reporter.report(`Missing vendor-prefixed CSS gradients for ${missing.join(", ")}.`, event.selectors[0].line, event.selectors[0].col, rule);
                }

            });
        }

    });

    CSSLint.addRule({
        id: "ids",
        name: "Disallow IDs in selectors",
        desc: "Selectors should not contain IDs.",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;
            parser.addListener("startrule", event => {
                const selectors = event.selectors;
                let selector;
                let part;
                let modifier;
                let idCount;
                let i;
                let j;
                let k;

                for (i=0; i < selectors.length; i++){
                    selector = selectors[i];
                    idCount = 0;

                    for (j=0; j < selector.parts.length; j++){
                        part = selector.parts[j];
                        if (part.type === parser.SELECTOR_PART_TYPE){
                            for (k=0; k < part.modifiers.length; k++){
                                modifier = part.modifiers[k];
                                if (modifier.type === "id"){
                                    idCount++;
                                }
                            }
                        }
                    }

                    if (idCount === 1){
                        reporter.report("Don't use IDs in selectors.", selector.line, selector.col, rule);
                    } else if (idCount > 1){
                        reporter.report(`${idCount} IDs in the selector, really?`, selector.line, selector.col, rule);
                    }
                }
            });
        }

    });

    CSSLint.addRule({
        id: "import",
        name: "Disallow @import",
        desc: "Don't use @import, use <link> instead.",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;

            parser.addListener("import", event => {
                reporter.report("@import prevents parallel downloads, use <link> instead.", event.line, event.col, rule);
            });

        }

    });

    CSSLint.addRule({
        id: "important",
        name: "Disallow !important",
        desc: "Be careful when using !important declaration",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;
            let count = 0;
            parser.addListener("property", event => {
                if (event.important === true){
                    count++;
                    reporter.report("Use of !important", event.line, event.col, rule);
                }
            });
            parser.addListener("endstylesheet", () => {
                reporter.stat("important", count);
                if (count >= 10){
                    reporter.rollupWarn(`Too many !important declarations (${count}), try to use less than 10 to avoid specificity issues.`, rule);
                }
            });
        }

    });

    CSSLint.addRule({
        id: "known-properties",
        name: "Require use of known properties",
        desc: "Properties should be known (listed in CSS3 specification) or be a vendor-prefixed property.",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;

            parser.addListener("property", event => {
                if (event.invalid) {
                    reporter.report(event.invalid.message, event.line, event.col, rule);
                }

            });
        }

    });
    CSSLint.addRule({
        id: "order-alphabetical",
        name: "Alphabetical order",
        desc: "Assure properties are in alphabetical order",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;
            let properties;

            const startRule = () => {
                properties = [];
            };

            parser.addListener("startrule", startRule);
            parser.addListener("startfontface", startRule);
            parser.addListener("startpage", startRule);
            parser.addListener("startpagemargin", startRule);
            parser.addListener("startkeyframerule", startRule);

            parser.addListener("property", event => {
                const name = event.property.text;
                const lowerCasePrefixLessName = name.toLowerCase().replace(/^-.*?-/, "");

                properties.push(lowerCasePrefixLessName);
            });

            parser.addListener("endrule", event => {
                const currentProperties = properties.join(",");
                const expectedProperties = properties.sort().join(",");

                if (currentProperties !== expectedProperties){
                    reporter.report("Rule doesn't have all its properties in alphabetical ordered.", event.line, event.col, rule);
                }
            });
        }

    });

    CSSLint.addRule({
        id: "outline-none",
        name: "Disallow outline: none",
        desc: "Use of outline: none or outline: 0 should be limited to :focus rules.",
        browsers: "All",
        tags: ["Accessibility"],
        init(parser, reporter) {
            const rule = this;
            let lastRule;

            function startRule(event){
                if (event.selectors){
                    lastRule = {
                        line: event.line,
                        col: event.col,
                        selectors: event.selectors,
                        propCount: 0,
                        outline: false
                    };
                } else {
                    lastRule = null;
                }
            }

            function endRule(){
                if (lastRule){
                    if (lastRule.outline){
                        if (!lastRule.selectors.toString().toLowerCase().includes(":focus")){
                            reporter.report("Outlines should only be modified using :focus.", lastRule.line, lastRule.col, rule);
                        } else if (lastRule.propCount === 1) {
                            reporter.report("Outlines shouldn't be hidden unless other visual changes are made.", lastRule.line, lastRule.col, rule);
                        }
                    }
                }
            }

            parser.addListener("startrule", startRule);
            parser.addListener("startfontface", startRule);
            parser.addListener("startpage", startRule);
            parser.addListener("startpagemargin", startRule);
            parser.addListener("startkeyframerule", startRule);

            parser.addListener("property", event => {
                const name = event.property.text.toLowerCase();
                const value = event.value;

                if (lastRule){
                    lastRule.propCount++;
                    if (name === "outline" && (value.toString() === "none" || value.toString() === "0")){
                        lastRule.outline = true;
                    }
                }
            });

            parser.addListener("endrule", endRule);
            parser.addListener("endfontface", endRule);
            parser.addListener("endpage", endRule);
            parser.addListener("endpagemargin", endRule);
            parser.addListener("endkeyframerule", endRule);
        }

    });

    CSSLint.addRule({
        id: "overqualified-elements",
        name: "Disallow overqualified elements",
        desc: "Don't use classes or IDs with elements (a.foo or a#foo).",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;
            const classes = {};

            parser.addListener("startrule", event => {
                const selectors = event.selectors;
                let selector;
                let part;
                let modifier;
                let i;
                let j;
                let k;

                for (i=0; i < selectors.length; i++){
                    selector = selectors[i];

                    for (j=0; j < selector.parts.length; j++){
                        part = selector.parts[j];
                        if (part.type === parser.SELECTOR_PART_TYPE){
                            for (k=0; k < part.modifiers.length; k++){
                                modifier = part.modifiers[k];
                                if (part.elementName && modifier.type === "id"){
                                    reporter.report(`Element (${part}) is overqualified, just use ${modifier} without element name.`, part.line, part.col, rule);
                                } else if (modifier.type === "class"){

                                    if (!classes[modifier]){
                                        classes[modifier] = [];
                                    }
                                    classes[modifier].push({ modifier, part });
                                }
                            }
                        }
                    }
                }
            });

            parser.addListener("endstylesheet", () => {

                let prop;
                for (prop in classes){
                    if (classes.hasOwnProperty(prop)){
                        if (classes[prop].length === 1 && classes[prop][0].part.elementName){
                            reporter.report(`Element (${classes[prop][0].part}) is overqualified, just use ${classes[prop][0].modifier} without element name.`, classes[prop][0].part.line, classes[prop][0].part.col, rule);
                        }
                    }
                }
            });
        }

    });

    CSSLint.addRule({
        id: "qualified-headings",
        name: "Disallow qualified headings",
        desc: "Headings should not be qualified (namespaced).",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;

            parser.addListener("startrule", event => {
                const selectors = event.selectors;
                let selector;
                let part;
                let i;
                let j;

                for (i=0; i < selectors.length; i++){
                    selector = selectors[i];

                    for (j=0; j < selector.parts.length; j++){
                        part = selector.parts[j];
                        if (part.type === parser.SELECTOR_PART_TYPE){
                            if (part.elementName && /h[1-6]/.test(part.elementName.toString()) && j > 0){
                                reporter.report(`Heading (${part.elementName}) should not be qualified.`, part.line, part.col, rule);
                            }
                        }
                    }
                }
            });
        }

    });

    CSSLint.addRule({
        id: "regex-selectors",
        name: "Disallow selectors that look like regexs",
        desc: "Selectors that look like regular expressions are slow and should be avoided.",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;

            parser.addListener("startrule", event => {
                const selectors = event.selectors;
                let selector;
                let part;
                let modifier;
                let i;
                let j;
                let k;

                for (i=0; i < selectors.length; i++){
                    selector = selectors[i];
                    for (j=0; j < selector.parts.length; j++){
                        part = selector.parts[j];
                        if (part.type === parser.SELECTOR_PART_TYPE){
                            for (k=0; k < part.modifiers.length; k++){
                                modifier = part.modifiers[k];
                                if (modifier.type === "attribute"){
                                    if (/([\~\|\^\$\*]=)/.test(modifier)){
                                        reporter.report(`Attribute selectors with ${RegExp.$1} are slow!`, modifier.line, modifier.col, rule);
                                    }
                                }

                            }
                        }
                    }
                }
            });
        }

    });

    CSSLint.addRule({
        id: "rules-count",
        name: "Rules Count",
        desc: "Track how many rules there are.",
        browsers: "All",
        init(parser, reporter) {
            let count = 0;
            parser.addListener("startrule", () => {
                count++;
            });

            parser.addListener("endstylesheet", () => {
                reporter.stat("rule-count", count);
            });
        }

    });

    CSSLint.addRule({
        id: "selector-max-approaching",
        name: "Warn when approaching the 4095 selector limit for IE",
        desc: "Will warn when selector count is >= 3800 selectors.",
        browsers: "IE",
        init(parser, reporter) {
            const rule = this;
            let count = 0;

            parser.addListener("startrule", event => {
                count += event.selectors.length;
            });

            parser.addListener("endstylesheet", () => {
                if (count >= 3800) {
                    reporter.report(`You have ${count} selectors. Internet Explorer supports a maximum of 4095 selectors per stylesheet. Consider refactoring.`,0,0,rule);
                }
            });
        }

    });

    CSSLint.addRule({
        id: "selector-max",
        name: "Error when past the 4095 selector limit for IE",
        desc: "Will error when selector count is > 4095.",
        browsers: "IE",
        init(parser, reporter) {
            const rule = this;
            let count = 0;

            parser.addListener("startrule", event => {
                count += event.selectors.length;
            });

            parser.addListener("endstylesheet", () => {
                if (count > 4095) {
                    reporter.report(`You have ${count} selectors. Internet Explorer supports a maximum of 4095 selectors per stylesheet. Consider refactoring.`,0,0,rule);
                }
            });
        }

    });

    CSSLint.addRule({
        id: "selector-newline",
        name: "Disallow new-line characters in selectors",
        desc: "New-line characters in selectors are usually a forgotten comma and not a descendant combinator.",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;

            function startRule(event) {
                let i;
                let len;
                let selector;
                let p;
                let n;
                let pLen;
                let part;
                let part2;
                let type;
                let currentLine;
                let nextLine;
                const selectors = event.selectors;

                for (i = 0, len = selectors.length; i < len; i++) {
                    selector = selectors[i];
                    for (p = 0, pLen = selector.parts.length; p < pLen; p++) {
                        for (n = p + 1; n < pLen; n++) {
                            part = selector.parts[p];
                            part2 = selector.parts[n];
                            type = part.type;
                            currentLine = part.line;
                            nextLine = part2.line;

                            if (type === "descendant" && nextLine > currentLine) {
                                reporter.report("newline character found in selector (forgot a comma?)", currentLine, selectors[i].parts[0].col, rule);
                            }
                        }
                    }

                }
            }

            parser.addListener("startrule", startRule);

        }
    });

    CSSLint.addRule({
        id: "shorthand",
        name: "Require shorthand properties",
        desc: "Use shorthand properties where possible.",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;
            let prop;
            let i;
            let len;
            const propertiesToCheck = {};
            let properties;

            const mapping = {
                "margin": [
                    "margin-top",
                    "margin-bottom",
                    "margin-left",
                    "margin-right"
                ],
                "padding": [
                    "padding-top",
                    "padding-bottom",
                    "padding-left",
                    "padding-right"
                ]
            };

            for (prop in mapping){
                if (mapping.hasOwnProperty(prop)){
                    for (i=0, len=mapping[prop].length; i < len; i++){
                        propertiesToCheck[mapping[prop][i]] = prop;
                    }
                }
            }

            function startRule(){
                properties = {};
            }
            function endRule(event){
                let prop;
                let i;
                let len;
                let total;
                for (prop in mapping){
                    if (mapping.hasOwnProperty(prop)){
                        total=0;

                        for (i=0, len=mapping[prop].length; i < len; i++){
                            total += properties[mapping[prop][i]] ? 1 : 0;
                        }

                        if (total === mapping[prop].length){
                            reporter.report(`The properties ${mapping[prop].join(", ")} can be replaced by ${prop}.`, event.line, event.col, rule);
                        }
                    }
                }
            }

            parser.addListener("startrule", startRule);
            parser.addListener("startfontface", startRule);
            parser.addListener("property", event => {
                const name = event.property.toString().toLowerCase();

                if (propertiesToCheck[name]){
                    properties[name] = 1;
                }
            });

            parser.addListener("endrule", endRule);
            parser.addListener("endfontface", endRule);
        }

    });

    CSSLint.addRule({
        id: "star-property-hack",
        name: "Disallow properties with a star prefix",
        desc: "Checks for the star property hack (targets IE6/7)",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;
            parser.addListener("property", event => {
                const property = event.property;

                if (property.hack === "*") {
                    reporter.report("Property with star prefix found.", event.property.line, event.property.col, rule);
                }
            });
        }
    });

    CSSLint.addRule({
        id: "text-indent",
        name: "Disallow negative text-indent",
        desc: "Checks for text indent less than -99px",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;
            let textIndent;
            let direction;


            function startRule(){
                textIndent = false;
                direction = "inherit";
            }
            function endRule(){
                if (textIndent && direction !== "ltr"){
                    reporter.report("Negative text-indent doesn't work well with RTL. If you use text-indent for image replacement explicitly set direction for that item to ltr.", textIndent.line, textIndent.col, rule);
                }
            }

            parser.addListener("startrule", startRule);
            parser.addListener("startfontface", startRule);
            parser.addListener("property", event => {
                const name = event.property.toString().toLowerCase();
                const value = event.value;

                if (name === "text-indent" && value.parts[0].value < -99){
                    textIndent = event.property;
                } else if (name === "direction" && value.toString() === "ltr"){
                    direction = "ltr";
                }
            });

            parser.addListener("endrule", endRule);
            parser.addListener("endfontface", endRule);
        }

    });

    CSSLint.addRule({
        id: "underscore-property-hack",
        name: "Disallow properties with an underscore prefix",
        desc: "Checks for the underscore property hack (targets IE6)",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;
            parser.addListener("property", event => {
                const property = event.property;

                if (property.hack === "_") {
                    reporter.report("Property with underscore prefix found.", event.property.line, event.property.col, rule);
                }
            });
        }
    });

    CSSLint.addRule({
        id: "unique-headings",
        name: "Headings should only be defined once",
        desc: "Headings should be defined only once.",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;

            const headings = {
                    h1: 0,
                    h2: 0,
                    h3: 0,
                    h4: 0,
                    h5: 0,
                    h6: 0
                };

            parser.addListener("startrule", event => {
                const selectors = event.selectors;
                let selector;
                let part;
                let pseudo;
                let i;
                let j;

                for (i=0; i < selectors.length; i++){
                    selector = selectors[i];
                    part = selector.parts[selector.parts.length-1];

                    if (part.elementName && /(h[1-6])/i.test(part.elementName.toString())){

                        for (j=0; j < part.modifiers.length; j++){
                            if (part.modifiers[j].type === "pseudo"){
                                pseudo = true;
                                break;
                            }
                        }

                        if (!pseudo){
                            headings[RegExp.$1]++;
                            if (headings[RegExp.$1] > 1) {
                                reporter.report(`Heading (${part.elementName}) has already been defined.`, part.line, part.col, rule);
                            }
                        }
                    }
                }
            });

            parser.addListener("endstylesheet", () => {
                let prop;
                const messages = [];

                for (prop in headings){
                    if (headings.hasOwnProperty(prop)){
                        if (headings[prop] > 1){
                            messages.push(`${headings[prop]} ${prop}s`);
                        }
                    }
                }

                if (messages.length){
                    reporter.rollupWarn(`You have ${messages.join(", ")} defined in this stylesheet.`, rule);
                }
            });
        }

    });

    CSSLint.addRule({
        id: "universal-selector",
        name: "Disallow universal selector",
        desc: "The universal selector (*) is known to be slow.",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;

            parser.addListener("startrule", event => {
                const selectors = event.selectors;
                let selector;
                let part;
                let i;

                for (i=0; i < selectors.length; i++){
                    selector = selectors[i];

                    part = selector.parts[selector.parts.length-1];
                    if (part.elementName === "*"){
                        reporter.report(rule.desc, part.line, part.col, rule);
                    }
                }
            });
        }

    });

    CSSLint.addRule({
        id: "unqualified-attributes",
        name: "Disallow unqualified attribute selectors",
        desc: "Unqualified attribute selectors are known to be slow.",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;

            parser.addListener("startrule", event => {
                const selectors = event.selectors;
                let selector;
                let part;
                let modifier;
                let i;
                let k;

                for (i=0; i < selectors.length; i++){
                    selector = selectors[i];

                    part = selector.parts[selector.parts.length-1];
                    if (part.type === parser.SELECTOR_PART_TYPE){
                        for (k=0; k < part.modifiers.length; k++){
                            modifier = part.modifiers[k];
                            if (modifier.type === "attribute" && (!part.elementName || part.elementName === "*")){
                                reporter.report(rule.desc, part.line, part.col, rule);
                            }
                        }
                    }

                }
            });
        }

    });

    CSSLint.addRule({
        id: "vendor-prefix",
        name: "Require standard property with vendor prefix",
        desc: "When using a vendor-prefixed property, make sure to include the standard one.",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;
            let properties;
            let num;

            const propertiesToCheck = {
                "-webkit-border-radius": "border-radius",
                "-webkit-border-top-left-radius": "border-top-left-radius",
                "-webkit-border-top-right-radius": "border-top-right-radius",
                "-webkit-border-bottom-left-radius": "border-bottom-left-radius",
                "-webkit-border-bottom-right-radius": "border-bottom-right-radius",

                "-o-border-radius": "border-radius",
                "-o-border-top-left-radius": "border-top-left-radius",
                "-o-border-top-right-radius": "border-top-right-radius",
                "-o-border-bottom-left-radius": "border-bottom-left-radius",
                "-o-border-bottom-right-radius": "border-bottom-right-radius",

                "-moz-border-radius": "border-radius",
                "-moz-border-radius-topleft": "border-top-left-radius",
                "-moz-border-radius-topright": "border-top-right-radius",
                "-moz-border-radius-bottomleft": "border-bottom-left-radius",
                "-moz-border-radius-bottomright": "border-bottom-right-radius",

                "-moz-column-count": "column-count",
                "-webkit-column-count": "column-count",

                "-moz-column-gap": "column-gap",
                "-webkit-column-gap": "column-gap",

                "-moz-column-rule": "column-rule",
                "-webkit-column-rule": "column-rule",

                "-moz-column-rule-style": "column-rule-style",
                "-webkit-column-rule-style": "column-rule-style",

                "-moz-column-rule-color": "column-rule-color",
                "-webkit-column-rule-color": "column-rule-color",

                "-moz-column-rule-width": "column-rule-width",
                "-webkit-column-rule-width": "column-rule-width",

                "-moz-column-width": "column-width",
                "-webkit-column-width": "column-width",

                "-webkit-column-span": "column-span",
                "-webkit-columns": "columns",

                "-moz-box-shadow": "box-shadow",
                "-webkit-box-shadow": "box-shadow",

                "-moz-transform" : "transform",
                "-webkit-transform" : "transform",
                "-o-transform" : "transform",
                "-ms-transform" : "transform",

                "-moz-transform-origin" : "transform-origin",
                "-webkit-transform-origin" : "transform-origin",
                "-o-transform-origin" : "transform-origin",
                "-ms-transform-origin" : "transform-origin",

                "-moz-box-sizing" : "box-sizing",
                "-webkit-box-sizing" : "box-sizing"
            };

            function startRule(){
                properties = {};
                num = 1;
            }
            function endRule(){
                let prop;
                let i;
                let len;
                let needed;
                let actual;
                const needsStandard = [];

                for (prop in properties){
                    if (propertiesToCheck[prop]){
                        needsStandard.push({ actual: prop, needed: propertiesToCheck[prop]});
                    }
                }

                for (i=0, len=needsStandard.length; i < len; i++){
                    needed = needsStandard[i].needed;
                    actual = needsStandard[i].actual;

                    if (!properties[needed]){
                        reporter.report(`Missing standard property '${needed}' to go along with '${actual}'.`, properties[actual][0].name.line, properties[actual][0].name.col, rule);
                    } else {
                        if (properties[needed][0].pos < properties[actual][0].pos){
                            reporter.report(`Standard property '${needed}' should come after vendor-prefixed property '${actual}'.`, properties[actual][0].name.line, properties[actual][0].name.col, rule);
                        }
                    }
                }
            }

            parser.addListener("startrule", startRule);
            parser.addListener("startfontface", startRule);
            parser.addListener("startpage", startRule);
            parser.addListener("startpagemargin", startRule);
            parser.addListener("startkeyframerule", startRule);

            parser.addListener("property", event => {
                const name = event.property.text.toLowerCase();

                if (!properties[name]){
                    properties[name] = [];
                }

                properties[name].push({ name: event.property, value : event.value, pos:num++ });
            });

            parser.addListener("endrule", endRule);
            parser.addListener("endfontface", endRule);
            parser.addListener("endpage", endRule);
            parser.addListener("endpagemargin", endRule);
            parser.addListener("endkeyframerule", endRule);
        }

    });

    CSSLint.addRule({
        id: "zero-units",
        name: "Disallow units for 0 values",
        desc: "You don't need to specify units when a value is 0.",
        browsers: "All",
        init(parser, reporter) {
            const rule = this;
            parser.addListener("property", event => {
                const parts = event.value.parts;
                let i = 0;
                const len = parts.length;

                while(i < len){
                    if ((parts[i].units || parts[i].type === "percentage") && parts[i].value === 0 && parts[i].type !== "time"){
                        reporter.report("Values of 0 shouldn't have units specified.", parts[i].line, parts[i].col, rule);
                    }
                    i++;
                }
            });

        }

    });

    ((() => {
        const xmlEscape = str => {
            if (!str || str.constructor !== String) {
                return "";
            }

            return str.replace(/[\"&><]/g, match => {
                switch (match) {
                    case "\"":
                        return "&quot;";
                    case "&":
                        return "&amp;";
                    case "<":
                        return "&lt;";
                    case ">":
                        return "&gt;";
                }
            });
        };

        CSSLint.addFormatter({
            id: "checkstyle-xml",
            name: "Checkstyle XML format",
            startFormat() {
                return "<?xml version=\"1.0\" encoding=\"utf-8\"?><checkstyle>";
            },
            endFormat() {
                return "</checkstyle>";
            },
            readError(filename, message) {
                return `<file name="${xmlEscape(filename)}"><error line="0" column="0" severty="error" message="${xmlEscape(message)}"></error></file>`;
            },
            formatResults(results, filename/*, options*/) {
                const messages = results.messages;
                const output = [];
                const generateSource = rule => {
                    if (!rule || !("name" in rule)) {
                        return "";
                    }
                    return `net.csslint.${rule.name.replace(/\s/g,"")}`;
                };



                if (messages.length > 0) {
                    output.push(`<file name="${filename}">`);
                    CSSLint.Util.forEach(messages, message => {
                        if (!message.rollup) {
                            output.push(`<error line="${message.line}" column="${message.col}" severity="${message.type}" message="${xmlEscape(message.message)}" source="${generateSource(message.rule)}"/>`);
                        }
                    });
                    output.push("</file>");
                }

                return output.join("");
            }
        });

    })());

    CSSLint.addFormatter({
        id: "compact",
        name: "Compact, 'porcelain' format",
        startFormat() {
            return "";
        },
        endFormat() {
            return "";
        },
        formatResults(results, filename, options) {
            const messages = results.messages;
            let output = "";
            options = options || {};
            const capitalize = str => str.charAt(0).toUpperCase() + str.slice(1);

            if (messages.length === 0) {
                  return options.quiet ? "" : `${filename}: Lint Free!`;
            }

            CSSLint.Util.forEach(messages, message => {
                if (message.rollup) {
                    output += `${filename}: ${capitalize(message.type)} - ${message.message}\n`;
                } else {
                    output += `${filename}: line ${message.line}, col ${message.col}, ${capitalize(message.type)} - ${message.message} (${message.rule.id})\n`;
                }
            });

            return output;
        }
    });

    CSSLint.addFormatter({
        id: "csslint-xml",
        name: "CSSLint XML format",
        startFormat() {
            return "<?xml version=\"1.0\" encoding=\"utf-8\"?><csslint>";
        },
        endFormat() {
            return "</csslint>";
        },
        formatResults(results, filename/*, options*/) {
            const messages = results.messages;
            const output = [];
            const escapeSpecialCharacters = str => {
                if (!str || str.constructor !== String) {
                    return "";
                }
                return str.replace(/\"/g, "'").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            };

            if (messages.length > 0) {
                output.push(`<file name="${filename}">`);
                CSSLint.Util.forEach(messages, message => {
                    if (message.rollup) {
                        output.push(`<issue severity="${message.type}" reason="${escapeSpecialCharacters(message.message)}" evidence="${escapeSpecialCharacters(message.evidence)}"/>`);
                    } else {
                        output.push(`<issue line="${message.line}" char="${message.col}" severity="${message.type}" reason="${escapeSpecialCharacters(message.message)}" evidence="${escapeSpecialCharacters(message.evidence)}"/>`);
                    }
                });
                output.push("</file>");
            }

            return output.join("");
        }
    });

    CSSLint.addFormatter({
        id: "junit-xml",
        name: "JUNIT XML format",
        startFormat() {
            return "<?xml version=\"1.0\" encoding=\"utf-8\"?><testsuites>";
        },
        endFormat() {
            return "</testsuites>";
        },
        formatResults(results, filename/*, options*/) {
            const messages = results.messages;
            const output = [];

            const tests = {
                "error": 0,
                "failure": 0
            };

            const generateSource = rule => {
                if (!rule || !("name" in rule)) {
                    return "";
                }
                return `net.csslint.${rule.name.replace(/\s/g,"")}`;
            };
            const escapeSpecialCharacters = str => {

                if (!str || str.constructor !== String) {
                    return "";
                }

                return str.replace(/\"/g, "'").replace(/</g, "&lt;").replace(/>/g, "&gt;");

            };

            if (messages.length > 0) {

                messages.forEach(message => {
                    const type = message.type === "warning" ? "error" : message.type;
                    if (!message.rollup) {
                        output.push(`<testcase time="0" name="${generateSource(message.rule)}">`);
                        output.push(`<${type} message="${escapeSpecialCharacters(message.message)}"><![CDATA[${message.line}:${message.col}:${escapeSpecialCharacters(message.evidence)}]]></${type}>`);
                        output.push("</testcase>");

                        tests[type] += 1;

                    }

                });

                output.unshift(`<testsuite time="0" tests="${messages.length}" skipped="0" errors="${tests.error}" failures="${tests.failure}" package="net.csslint" name="${filename}">`);
                output.push("</testsuite>");

            }

            return output.join("");
        }
    });

    CSSLint.addFormatter({
        id: "lint-xml",
        name: "Lint XML format",
        startFormat() {
            return "<?xml version=\"1.0\" encoding=\"utf-8\"?><lint>";
        },
        endFormat() {
            return "</lint>";
        },
        formatResults(results, filename/*, options*/) {
            const messages = results.messages;
            const output = [];
            const escapeSpecialCharacters = str => {
                if (!str || str.constructor !== String) {
                    return "";
                }
                return str.replace(/\"/g, "'").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            };

            if (messages.length > 0) {

                output.push(`<file name="${filename}">`);
                CSSLint.Util.forEach(messages, message => {
                    if (message.rollup) {
                        output.push(`<issue severity="${message.type}" reason="${escapeSpecialCharacters(message.message)}" evidence="${escapeSpecialCharacters(message.evidence)}"/>`);
                    } else {
                        output.push(`<issue line="${message.line}" char="${message.col}" severity="${message.type}" reason="${escapeSpecialCharacters(message.message)}" evidence="${escapeSpecialCharacters(message.evidence)}"/>`);
                    }
                });
                output.push("</file>");
            }

            return output.join("");
        }
    });

    CSSLint.addFormatter({
        id: "text",
        name: "Plain Text",
        startFormat() {
            return "";
        },
        endFormat() {
            return "";
        },
        formatResults(results, filename, options) {
            const messages = results.messages;
            let output = "";
            options = options || {};

            if (messages.length === 0) {
                return options.quiet ? "" : `\n\ncsslint: No errors in ${filename}.`;
            }

            output = "\n\ncsslint: There ";
            if (messages.length === 1) {
                output += "is 1 problem";
            } else {
                output += `are ${messages.length} problems`;
            }
            output += ` in ${filename}.`;

            let pos = filename.lastIndexOf("/");
            let shortFilename = filename;

            if (pos === -1){
                pos = filename.lastIndexOf("\\");
            }
            if (pos > -1){
                shortFilename = filename.substring(pos+1);
            }

            CSSLint.Util.forEach(messages, (message, i) => {
                output = `${output}\n\n${shortFilename}`;
                if (message.rollup) {
                    output += `\n${i+1}: ${message.type}`;
                    output += `\n${message.message}`;
                } else {
                    output += `\n${i+1}: ${message.type} at line ${message.line}, col ${message.col}`;
                    output += `\n${message.message}`;
                    output += `\n${message.evidence}`;
                }
            });

            return output;
        }
    });

    module.exports.CSSLint = CSSLint;
});

ace.define("ace/mode/css_worker",["require","exports","module","ace/lib/oop","ace/lib/lang","ace/worker/mirror","ace/mode/css/csslint"], (require, exports, module) => {
    const oop = require("../lib/oop");
    const lang = require("../lib/lang");
    const Mirror = require("../worker/mirror").Mirror;
    const CSSLint = require("./css/csslint").CSSLint;

    const Worker = exports.Worker = function(sender) {
        Mirror.call(this, sender);
        this.setTimeout(400);
        this.ruleset = null;
        this.setDisabledRules("ids|order-alphabetical");
        this.setInfoRules(
          "adjoining-classes|qualified-headings|zero-units|gradients|" +
          "import|outline-none|vendor-prefix"
        );
    };

    oop.inherits(Worker, Mirror);

    (function() {
        this.setInfoRules = function(ruleNames) {
            if (typeof ruleNames == "string")
                ruleNames = ruleNames.split("|");
            this.infoRules = lang.arrayToMap(ruleNames);
            this.doc.getValue() && this.deferredUpdate.schedule(100);
        };

        this.setDisabledRules = function(ruleNames) {
            if (!ruleNames) {
                this.ruleset = null;
            } else {
                if (typeof ruleNames == "string")
                    ruleNames = ruleNames.split("|");
                const all = {};

                CSSLint.getRules().forEach(x => {
                    all[x.id] = true;
                });
                ruleNames.forEach(x => {
                    delete all[x];
                });
                
                this.ruleset = all;
            }
            this.doc.getValue() && this.deferredUpdate.schedule(100);
        };

        this.onUpdate = function() {
            const value = this.doc.getValue();
            if (!value)
                return this.sender.emit("annotate", []);
            const infoRules = this.infoRules;

            const result = CSSLint.verify(value, this.ruleset);
            this.sender.emit("annotate", result.messages.map(msg => ({
                row: msg.line - 1,
                column: msg.col - 1,
                text: msg.message,
                type: infoRules[msg.rule.id] ? "info" : msg.type,
                rule: msg.rule.name
            })));
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
