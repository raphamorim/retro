ace.define("ace/ext/elastic_tabstops_lite",["require","exports","module","ace/editor","ace/config"], (require, exports, module) => {
    const ElasticTabstopsLite = function(editor) {
        this.$editor = editor;
        const self = this;
        let changedRows = [];
        let recordChanges = false;
        this.onAfterExec = () => {
            recordChanges = false;
            self.processRows(changedRows);
            changedRows = [];
        };
        this.onExec = () => {
            recordChanges = true;
        };
        this.onChange = delta => {
            if (recordChanges) {
                if (!changedRows.includes(delta.start.row))
                    changedRows.push(delta.start.row);
                if (delta.end.row != delta.start.row)
                    changedRows.push(delta.end.row);
            }
        };
    };

    (function() {
        this.processRows = function(rows) {
            this.$inChange = true;
            const checkedRows = [];

            for (let r = 0, rowCount = rows.length; r < rowCount; r++) {
                const row = rows[r];

                if (checkedRows.includes(row))
                    continue;

                const cellWidthObj = this.$findCellWidthsForBlock(row);
                const cellWidths = this.$setBlockCellWidthsToMax(cellWidthObj.cellWidths);
                let rowIndex = cellWidthObj.firstRow;

                for (let w = 0, l = cellWidths.length; w < l; w++) {
                    const widths = cellWidths[w];
                    checkedRows.push(rowIndex);
                    this.$adjustRow(rowIndex, widths);
                    rowIndex++;
                }
            }
            this.$inChange = false;
        };

        this.$findCellWidthsForBlock = function(row) {
            const cellWidths = [];
            let widths;
            let rowIter = row;
            while (rowIter >= 0) {
                widths = this.$cellWidthsForRow(rowIter);
                if (widths.length == 0)
                    break;

                cellWidths.unshift(widths);
                rowIter--;
            }
            const firstRow = rowIter + 1;
            rowIter = row;
            const numRows = this.$editor.session.getLength();

            while (rowIter < numRows - 1) {
                rowIter++;

                widths = this.$cellWidthsForRow(rowIter);
                if (widths.length == 0)
                    break;

                cellWidths.push(widths);
            }

            return { cellWidths, firstRow };
        };

        this.$cellWidthsForRow = function(row) {
            const selectionColumns = this.$selectionColumnsForRow(row);

            const tabs = [-1].concat(this.$tabsForRow(row));
            const widths = tabs.map(el => 0 ).slice(1);
            const line = this.$editor.session.getLine(row);

            for (let i = 0, len = tabs.length - 1; i < len; i++) {
                const leftEdge = tabs[i]+1;
                const rightEdge = tabs[i+1];

                const rightmostSelection = this.$rightmostSelectionInCell(selectionColumns, rightEdge);
                const cell = line.substring(leftEdge, rightEdge);
                widths[i] = Math.max(cell.replace(/\s+$/g,'').length, rightmostSelection - leftEdge);
            }

            return widths;
        };

        this.$selectionColumnsForRow = function(row) {
            const selections = [];
            const cursor = this.$editor.getCursorPosition();
            if (this.$editor.session.getSelection().isEmpty()) {
                if (row == cursor.row)
                    selections.push(cursor.column);
            }

            return selections;
        };

        this.$setBlockCellWidthsToMax = function(cellWidths) {
            let startingNewBlock = true;
            let blockStartRow;
            let blockEndRow;
            let maxWidth;
            const columnInfo = this.$izip_longest(cellWidths);

            for (let c = 0, l = columnInfo.length; c < l; c++) {
                const column = columnInfo[c];
                if (!column.push) {
                    console.error(column);
                    continue;
                }
                column.push(NaN);

                for (let r = 0, s = column.length; r < s; r++) {
                    const width = column[r];
                    if (startingNewBlock) {
                        blockStartRow = r;
                        maxWidth = 0;
                        startingNewBlock = false;
                    }
                    if (isNaN(width)) {
                        blockEndRow = r;

                        for (let j = blockStartRow; j < blockEndRow; j++) {
                            cellWidths[j][c] = maxWidth;
                        }
                        startingNewBlock = true;
                    }

                    maxWidth = Math.max(maxWidth, width);
                }
            }

            return cellWidths;
        };

        this.$rightmostSelectionInCell = (selectionColumns, cellRightEdge) => {
            let rightmost = 0;

            if (selectionColumns.length) {
                const lengths = [];
                for (let s = 0, length = selectionColumns.length; s < length; s++) {
                    if (selectionColumns[s] <= cellRightEdge)
                        lengths.push(s);
                    else
                        lengths.push(0);
                }
                rightmost = Math.max(...lengths);
            }

            return rightmost;
        };

        this.$tabsForRow = function(row) {
            const rowTabs = [];
            const line = this.$editor.session.getLine(row);
            const re = /\t/g;
            let match;

            while ((match = re.exec(line)) != null) {
                rowTabs.push(match.index);
            }

            return rowTabs;
        };

        this.$adjustRow = function(row, widths) {
            const rowTabs = this.$tabsForRow(row);

            if (rowTabs.length == 0)
                return;

            let bias = 0;
            let location = -1;
            const expandedSet = this.$izip(widths, rowTabs);

            for (let i = 0, l = expandedSet.length; i < l; i++) {
                const w = expandedSet[i][0];
                let it = expandedSet[i][1];
                location += 1 + w;
                it += bias;
                const difference = location - it;

                if (difference == 0)
                    continue;

                const partialLine = this.$editor.session.getLine(row).substr(0, it );
                const strippedPartialLine = partialLine.replace(/\s*$/g, "");
                const ispaces = partialLine.length - strippedPartialLine.length;

                if (difference > 0) {
                    this.$editor.session.getDocument().insertInLine({row, column: it + 1}, `${Array(difference + 1).join(" ")}\t`);
                    this.$editor.session.getDocument().removeInLine(row, it, it + 1);

                    bias += difference;
                }

                if (difference < 0 && ispaces >= -difference) {
                    this.$editor.session.getDocument().removeInLine(row, it + difference, it);
                    bias += difference;
                }
            }
        };
        this.$izip_longest = iterables => {
            if (!iterables[0])
                return [];
            let longest = iterables[0].length;
            const iterablesLength = iterables.length;

            for (var i = 1; i < iterablesLength; i++) {
                const iLength = iterables[i].length;
                if (iLength > longest)
                    longest = iLength;
            }

            const expandedSet = [];

            for (let l = 0; l < longest; l++) {
                const set = [];
                for (var i = 0; i < iterablesLength; i++) {
                    if (iterables[i][l] === "")
                        set.push(NaN);
                    else
                        set.push(iterables[i][l]);
                }

                expandedSet.push(set);
            }


            return expandedSet;
        };
        this.$izip = (widths, tabs) => {
            const size = widths.length >= tabs.length ? tabs.length : widths.length;

            const expandedSet = [];
            for (let i = 0; i < size; i++) {
                const set = [ widths[i], tabs[i] ];
                expandedSet.push(set);
            }
            return expandedSet;
        };

    }).call(ElasticTabstopsLite.prototype);

    exports.ElasticTabstopsLite = ElasticTabstopsLite;

    const Editor = require("../editor").Editor;
    require("../config").defineOptions(Editor.prototype, "editor", {
        useElasticTabstops: {
            set(val) {
                if (val) {
                    if (!this.elasticTabstops)
                        this.elasticTabstops = new ElasticTabstopsLite(this);
                    this.commands.on("afterExec", this.elasticTabstops.onAfterExec);
                    this.commands.on("exec", this.elasticTabstops.onExec);
                    this.on("change", this.elasticTabstops.onChange);
                } else if (this.elasticTabstops) {
                    this.commands.removeListener("afterExec", this.elasticTabstops.onAfterExec);
                    this.commands.removeListener("exec", this.elasticTabstops.onExec);
                    this.removeListener("change", this.elasticTabstops.onChange);
                }
            }
        }
    });
});
                ((() => {
                    ace.require(["ace/ext/elastic_tabstops_lite"], () => {});
                }))();
            