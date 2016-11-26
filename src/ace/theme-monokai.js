var fs = require('fs');
ace.define("ace/theme/monokai",["require","exports","module","ace/lib/dom"], function(require, exports, module) {
exports.isDark = true;
exports.cssClass = "ace-monokai";
exports.cssText = fs.readFileSync('src/themes/monokai.css');
var dom = require("../lib/dom");
dom.importCssString(exports.cssText, exports.cssClass);
});
