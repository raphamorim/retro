'use strict';

(function() {
  const app = require('electron').remote;
  const dialog = app.dialog;
  const fs = require('fs');
  const retro = new Retro();
  const tabs = document.querySelector('.tabs');

  function unfocusTabs() {
    tabs.classList.add('unfocus');
  }

  function toggleTabs() {
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
      continuousScanning: 500,
      incrementalLoading: true,
      keyMap: "vim",
      electricChars: false,
      autofocus: true,
      allowDropFileTypes: false,
      theme: "monokai",
      dragDrop: false,
      coverGutterNextToScrollbar: true,
      cursorScrollMargin: 3,
      inputStyle: "textarea",
      pollInterval: 200,
      flattenSpans: true,
      viewportMargin: 1,
      // matchBrackets: true, very slower mode
      // showCursorWhenSelecting: true,
      styleActiveLine: true
    };

    const editor = document.getElementById("editor"),
      editorFile = document.getElementById("editor-file"),
      editorMode = document.getElementById('editor-mode'),
      editorSyntax = document.getElementById('editor-syntax');

    const code = CodeMirror.fromTextArea(editor, def);

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
        filepath = filepath.split('.');
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

      // var data = fs.(file, 'utf8');
      var stream = fs.createReadStream(file)

      changeSyntax(file);
      setCurrentFile(file);

      var d = '';
      console.time('finished');
      stream.setEncoding('utf8');

      stream.on('data', (chunk) => {d += chunk;})

      stream.on('end', function() {
        var limit = 15000,
          prev = 0;

        console.log(d.length);
        
        if (d.length > limit) {
          code.replaceRange(d.substr(prev, limit), CodeMirror.Pos(code.lastLine()));
          var interval = setInterval(function() {
            if (d.length <= 0) {
              console.timeEnd('finished');
              clearInterval(interval);
            } else {
              prev += limit;
              limit += limit;
              code.replaceRange(d.substr(prev, limit), CodeMirror.Pos(code.lastLine()));
            }
          }, 300)
        } else {
          code.setValue(d)
          console.timeEnd('finished');
        }
      });
    }
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

  function toggleModal() {

  }

  key('⌘+o', function(event, handler) {
    // TODO: Multiple files and diretory
    openFiles();
  });

  key('⌘+p', function(event, handler) {
    toggleModal();
  });

  key('⌘+e', function(event, handler) {
    toggleTabs();
  });

  key('⌘+,', function(event, handler) {
    // TODO: Preferences
    console.log("Preferences")
  });

})();