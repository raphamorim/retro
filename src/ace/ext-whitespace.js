ace.define("ace/ext/whitespace",["require","exports","module","ace/lib/lang"], (require, exports, module) => {
    const lang = require("../lib/lang");
    exports.$detectIndentation = (lines, fallback) => {
        const stats = [];
        const changes = [];
        let tabIndents = 0;
        let prevSpaces = 0;
        const max = Math.min(lines.length, 1000);
        for (var i = 0; i < max; i++) {
            let line = lines[i];
            if (!/^\s*[^*+\-\s]/.test(line))
                continue;

            if (line[0] == "\t") {
                tabIndents++;
                prevSpaces = -Number.MAX_VALUE;
            } else {
                const spaces = line.match(/^ */)[0].length;
                if (spaces && line[spaces] != "\t") {
                    const diff = spaces - prevSpaces;
                    if (diff > 0 && !(prevSpaces%diff) && !(spaces%diff))
                        changes[diff] = (changes[diff] || 0) + 1;
        
                    stats[spaces] = (stats[spaces] || 0) + 1;
                }
                prevSpaces = spaces;
            }
            while (i < max && line[line.length - 1] == "\\")
                line = lines[i++];
        }
        
        function getScore(indent) {
            let score = 0;
            for (let i = indent; i < stats.length; i += indent)
                score += stats[i] || 0;
            return score;
        }

        const changesTotal = changes.reduce((a, b) => a+b, 0);

        let first = {score: 0, length: 0};
        let spaceIndents = 0;
        for (var i = 1; i < 12; i++) {
            let score = getScore(i);
            if (i == 1) {
                spaceIndents = score;
                score = stats[1] ? 0.9 : 0.8;
                if (!stats.length)
                    score = 0;
            } else
                score /= spaceIndents;

            if (changes[i])
                score += changes[i] / changesTotal;

            if (score > first.score)
                first = {score, length: i};
        }

        if (first.score && first.score > 1.4)
            let tabLength = first.length;

        if (tabIndents > spaceIndents + 1) {
            if (tabLength == 1 || spaceIndents < tabIndents / 4 || first.score < 1.8)
                tabLength = undefined;
            return {ch: "\t", length: tabLength};
        }
        if (spaceIndents > tabIndents + 1)
            return {ch: " ", length: tabLength};
    };

    exports.detectIndentation = session => {
        const lines = session.getLines(0, 1000);
        const indent = exports.$detectIndentation(lines) || {};

        if (indent.ch)
            session.setUseSoftTabs(indent.ch == " ");

        if (indent.length)
            session.setTabSize(indent.length);
        return indent;
    };

    exports.trimTrailingSpace = (session, trimEmpty) => {
        const doc = session.getDocument();
        const lines = doc.getAllLines();
        
        const min = trimEmpty ? -1 : 0;

        for (let i = 0, l=lines.length; i < l; i++) {
            const line = lines[i];
            const index = line.search(/\s+$/);

            if (index > min)
                doc.removeInLine(i, index, line.length);
        }
    };

    exports.convertIndentation = (session, ch, len) => {
        const oldCh = session.getTabString()[0];
        const oldLen = session.getTabSize();
        if (!len) len = oldLen;
        if (!ch) ch = oldCh;

        const tab = ch == "\t" ? ch: lang.stringRepeat(ch, len);

        const doc = session.doc;
        const lines = doc.getAllLines();

        const cache = {};
        const spaceCache = {};
        for (let i = 0, l=lines.length; i < l; i++) {
            const line = lines[i];
            const match = line.match(/^\s*/)[0];
            if (match) {
                const w = session.$getStringScreenWidth(match)[0];
                const tabCount = Math.floor(w/oldLen);
                const reminder = w%oldLen;
                let toInsert = cache[tabCount] || (cache[tabCount] = lang.stringRepeat(tab, tabCount));
                toInsert += spaceCache[reminder] || (spaceCache[reminder] = lang.stringRepeat(" ", reminder));

                if (toInsert != match) {
                    doc.removeInLine(i, 0, match.length);
                    doc.insertInLine({row: i, column: 0}, toInsert);
                }
            }
        }
        session.setTabSize(len);
        session.setUseSoftTabs(ch == " ");
    };

    exports.$parseStringArg = text => {
        const indent = {};
        if (/t/.test(text))
            indent.ch = "\t";
        else if (/s/.test(text))
            indent.ch = " ";
        const m = text.match(/\d+/);
        if (m)
            indent.length = parseInt(m[0], 10);
        return indent;
    };

    exports.$parseArg = arg => {
        if (!arg)
            return {};
        if (typeof arg == "string")
            return exports.$parseStringArg(arg);
        if (typeof arg.text == "string")
            return exports.$parseStringArg(arg.text);
        return arg;
    };

    exports.commands = [{
        name: "detectIndentation",
        exec(editor) {
            exports.detectIndentation(editor.session);
        }
    }, {
        name: "trimTrailingSpace",
        exec(editor) {
            exports.trimTrailingSpace(editor.session);
        }
    }, {
        name: "convertIndentation",
        exec(editor, arg) {
            const indent = exports.$parseArg(arg);
            exports.convertIndentation(editor.session, indent.ch, indent.length);
        }
    }, {
        name: "setIndentation",
        exec(editor, arg) {
            const indent = exports.$parseArg(arg);
            indent.length && editor.session.setTabSize(indent.length);
            indent.ch && editor.session.setUseSoftTabs(indent.ch == " ");
        }
    }];
});
                ((() => {
                    ace.require(["ace/ext/whitespace"], () => {});
                }))();
            