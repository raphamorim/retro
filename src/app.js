const app = require('electron').remote;
const dialog = app.dialog;
const fs = require('fs');
const retro = new Retro();

function unfocusTabs() {
  const tabs = document.querySelector('.tabs');
  tabs.classList.add('unfocus');
}

function toggleTabs() {
  const tabs = document.querySelector('.tabs');
  tabs.classList.toggle('unfocus');
}

function merge(obj1, obj2) {
  var obj3 = {};
  for (var attrname in obj1) {
    obj3[attrname] = obj1[attrname];
  }
  for (var attrname in obj2) {
    obj3[attrname] = obj2[attrname];
  }
  return obj3;
}

function Retro() {
  // normal, insert, visual
  const modes = {
    "I": "INSERT",
    "<ESC>": "NORMAL",
    "V": "VISUAL"
  };
  const def = {
    lineNumbers: true,
    mode: "text/javascript",
    keyMap: "vim",
    theme: "monokai",
    matchBrackets: true,
    showCursorWhenSelecting: true,
    styleActiveLine: true
  };

  const editor = document.getElementById("editor"),
    editorFile = document.getElementById("editor-file"),
    editorMode = document.getElementById('editor-mode'),
    editorSyntax = document.getElementById('editor-syntax');

  const code = CodeMirror.fromTextArea(editor, def);

  const tabs = document.querySelector(".tabs");
  // this.tabs = {};

  code.setOption("extraKeys", {
    Tab: function(cm) {
      var spaces = Array(cm.getOption("indentUnit") + 1).join(" ");
      cm.replaceSelection(spaces);
    },
    "Cmd-E": function(cm) {
      toggleTabs();
    },
    "Cmd-O": function(cm) {
      openFiles();
    }
  });

  CodeMirror.commands.save = function() {
    alert("Saving");
  };

  CodeMirror.on(code, 'vim-keypress', (key) => {
    var mode = modes[key.toUpperCase()]
    unfocusTabs();

    if (mode === 'NORMAL') {
      editorMode.textContent = mode;
      toggleTabs();
    }

    if (mode) {
      editorMode.className = "";
      editorMode.classList.add(mode.toLowerCase())
      editorMode.textContent = mode;
    }
  });

  // CodeMirror.on(code, 'vim-command-done', function(e) {
  //   document.body.focus();
  // });

  this.setTabs = function(file, asActive) {
    var tab = document.createElement("div");
    tab.classList.add("tabs-item");
    if (asActive) {
      tab.classList.add("active");
    }

    tab.textContent = file;
    tabs.innerHTML = '';
    tabs.appendChild(tab);
  }

  this.openFile = function(file, tab) {
    function changeSyntax(filepath) {
      filepath = filepath.split('/').pop();
      console.log(filepath)
      filepath = filepath.split('.');
      console.log(filepath.length)
      if (filepath.length <= 1) {
        editorFile.textContent = '';
        return;
      }

      const syntax = filepath.pop();
      editorSyntax.textContent = syntax;
      code.setOption(merge(def, syntaxes[syntax]));
    }

    function setCurrentFile(filepath) {
      filepath = filepath.split('/').pop();
      filepath = filepath.split('.').shift();
      editorFile.textContent = filepath;
      this.setTabs(filepath, true);
    }

    setCurrentFile = setCurrentFile.bind(this)

    fs.readFile(file, 'utf8', function(err, data) {
      if (err) {
        return alert(err);
      }

      code.setValue(data);
      changeSyntax(file);
      setCurrentFile(file);
    });
  }
}

document.ondragover = document.ondrop = (ev) => {
  ev.preventDefault()
}

document.body.ondrop = (ev) => {
  var filepath = ev.dataTransfer.files[0].path;
  retro.openFile(filepath);
  ev.preventDefault()
}

function openFiles() {
  dialog.showOpenDialog(function(fileNames) {
    if (fileNames && fileNames.length)
      retro.openFile(fileNames[0]);
  });
}

key('⌘+o', function(event, handler) {
  // TODO: Multiple files and diretory
  openFiles();
});

key('⌘+e', function(event, handler) {
  toggleTabs();
});

key('⌘+,', function(event, handler) {
  // TODO: Preferences
  console.log("Preferences")
});