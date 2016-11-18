var fs = require('fs'),
  Editor;

CodeMirror.commands.save = function() {
  alert("Saving");
};

Editor = CodeMirror.fromTextArea(document.getElementById("editor") , {
  lineNumbers: true,
  mode: "text/javascript",
  keyMap: "vim",
  theme: "monokai",
  matchBrackets: true,
  showCursorWhenSelecting: true
});

document.ondragover = document.ondrop = (ev) => {
  ev.preventDefault()
}

document.body.ondrop = (ev) => {
  var filepath = ev.dataTransfer.files[0].path;
  fs.readFile(filepath, 'utf8', function (err, data) {
    if (err) {
      return alert(err);
    }

  Editor.setValue(data);
  });
  ev.preventDefault()
}

// var commandDisplay = document.getElementById('command-display');

// var keys = '';
// CodeMirror.on(editor, 'vim-keypress', function(key) {
//   keys = keys + key;
//   commandDisplay.innerHTML = keys;
// });
// CodeMirror.on(editor, 'vim-command-done', function(e) {
//   keys = '';
//   commandDisplay.innerHTML = keys;
// });