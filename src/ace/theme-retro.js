var fs = require('fs');
ace.define("ace/theme/retro",["require","exports","module","ace/lib/dom"], function(require, exports, module) {
exports.isDark = true;
exports.cssClass = "ace-retro";
exports.cssText = fs.readFileSync(__dirname + '/src/themes/retro.css');
var dom = require("../lib/dom");
dom.importCssString(exports.cssText, exports.cssClass);
});
