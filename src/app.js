var app = require('electron').remote;
var dialog = app.dialog;
var fs = require('fs');
var Retro = new Retro();

function Retro() {
  // normal, insert, visual
  var modes = {
    "I": "INSERT",
    "<ESC>": "NORMAL",
    "V": "VISUAL"
  };
  var currentMode = 0;

  var editor = document.getElementById("editor"),
    editorMode = document.getElementById('editor-mode'),
    editorSyntax = document.getElementById('editor-syntax');

  var code = CodeMirror.fromTextArea(editor, {
    lineNumbers: true,
    mode: "text/javascript",
    keyMap: "vim",
    theme: "monokai",
    matchBrackets: true,
    showCursorWhenSelecting: true
  });

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