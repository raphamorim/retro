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
    showCursorWhenSelecting: true,
    styleActiveLine: true
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
    },
    "rb": {
      mode: "text/x-ruby",
      indentUnit: 4
    },
    "rs": {
      lineWrapping: true,
      indentUnit: 4,
      mode: "rust"
    },
    "rpm": {
      mode: {
        name: "rpm-spec"
      },
      indentUnit: 4
    },
    "sh": {
      mode: 'shell'
    },
    "c": {
      mode: "text/x-csrc"
    },
    "cpp": {
      mode: "text/x-c++src"
    },
    "cpp": {
      mode: "text/x-c++src"
    },
    "java": {
      mode: "text/x-java"
    },
    "m": {
      mode: "text/x-objectivec"
    },
    "h": {
      mode: "text/x-objectivec"
    },
    "scala": {
      mode: "text/x-scala"
    },
    "sc": {
      mode: "text/x-scala"
    },
    "kt": {
      mode: "text/x-kotlin"
    },
    "kts": {
      mode: "text/x-kotlin"
    },
    "ceylon": {
      mode: "text/x-ceylon"
    }
  }

  var editor = document.getElementById("editor"),
    editorMode = document.getElementById('editor-mode'),
    editorSyntax = document.getElementById('editor-syntax');

  var code = CodeMirror.fromTextArea(editor, def);
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

    if (mode === 'NORMAL')
      toggleTabs();

    if (mode) {
      editorMode.className = "";
      editorMode.classList.add(mode.toLowerCase())
      editorMode.textContent = mode;
    }
  });

  // CodeMirror.on(code, 'vim-command-done', function(e) {
  //   document.body.focus();
  // });

  this.newTab = function() {},

    this.setValue = function(file, tab) {
      function changeSyntax(filepath) {
        var syntax = filepath.split('.').pop();
        console.log(syntax)
        editorSyntax.textContent = syntax;
        code.setOption(merge(def, syntaxes[syntax]));
      }
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
  retro.setValue(filepath);
  ev.preventDefault()
}

function openFiles() {
  dialog.showOpenDialog(function(fileNames) {
    if (fileNames && fileNames.length)
      retro.setValue(fileNames[0]);
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
