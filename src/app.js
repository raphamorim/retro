var app = require('electron').remote;
var dialog = app.dialog;
var fs = require('fs');
var Retro = new Retro();

function merge(obj1, obj2) {
    var obj3 = {};
    for (var attrname in obj1) { obj3[attrname] = obj1[attrname]; }
    for (var attrname in obj2) { obj3[attrname] = obj2[attrname]; }
    return obj3;
}

function Retro() {
  // normal, insert, visual
  var modes = {
    "I": "INSERT",
    "<ESC>": "NORMAL",
    "V": "VISUAL"
  };
  var currentMode = 0;
  var def = {
    lineNumbers: true,
    mode: "text/javascript",
    keyMap: "vim",
    theme: "monokai",
    matchBrackets: true,
    showCursorWhenSelecting: true
  };

  var syntaxes = {
    "js": {
      mode: "text/javascript"
    },
    "json": {
      mode: "text/javascript"
    },
    "md": {
      mode: 'markdown',
    },
    "markdown": {
      mode: 'markdown',
    },
    "ts": {
      mode: "text/typescript"
    },
    "py": {
      mode: {
        name: "python",
        version: 3,
        singleLineStringErrors: false
      },
      indentUnit: 4
    },
    "pyx": {
      mode: {
        name: "text/x-cython",
        version: 2,
        singleLineStringErrors: false
      },
      indentUnit: 4
    }
  }

  var editor = document.getElementById("editor"),
    editorMode = document.getElementById('editor-mode'),
    editorSyntax = document.getElementById('editor-syntax');

  var code = CodeMirror.fromTextArea(editor, def);

  CodeMirror.commands.save = function() {
    alert("Saving");
  };

  CodeMirror.on(code, 'vim-keypress', (key) => {
    var mode = modes[key.toUpperCase()]
    if (mode) {
      editorMode.className = "";
      editorMode.classList.add(mode.toLowerCase())
      editorMode.textContent = mode;
    }
  });

  // CodeMirror.on(code, 'vim-command-done', function(e) {
  //   editorMode.innerHTML = keys;
  // });

  // this.newTab = function() {

  //   },

  function changeSyntax(filepath) {
    var syntax = filepath.split('.').pop();
    editorSyntax.textContent = syntax;
    code = CodeMirror.fromTextArea(editor, merge(def, syntaxes[syntax]));
  }

  this.setValue = function(file, tab) {
    fs.readFile(file, 'utf8', function(err, data) {
      if (err) {
        return alert(err);
      }

      code.setValue(data);
      changeSyntax(file);
    });
  }
}

document.ondragover = document.ondrop = (ev) => {
  ev.preventDefault()
}

document.body.ondrop = (ev) => {
  var filepath = ev.dataTransfer.files[0].path;
  Retro.setValue(filepath);
  ev.preventDefault()
}

key('⌘+o', function(event, handler) {
  // TODO: Multiple files and diretory
  dialog.showOpenDialog(function(fileNames) {
    if (fileNames.length)
      Retro.setValue(fileNames[0]);
  });
});

key('⌘+,', function(event, handler) {
  // TODO: Preferences
  console.log("Preferences")
});