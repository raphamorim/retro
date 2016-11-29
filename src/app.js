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
    const editor = document.getElementById("editor"),
      editorFile = document.getElementById("editor-file"),
      editorMode = document.getElementById('editor-mode'),
      editorSyntax = document.getElementById('editor-syntax');

    const code = ace.edit("editor");

    code.setKeyboardHandler("ace/keyboard/vim")
    code.setTheme("ace/theme/monokai");
    code.setOptions({
      showPrintMargin: false
    })
    code.$blockScrolling = Infinity
    code.getSession().setMode("ace/mode/javascript");
    code.getSession().setUseWorker(false);

    code.commands.addCommand({
        name: "open file",
        exec: openFiles,
        bindKey: {mac: "cmd-o", win: "ctrl-o"}
    })

    code.on("changeStatus", function(e, a) {
      var mode = code.keyBinding.getStatusText(code);
      unfocusTabs();

      if (!mode || !mode.length) {
        mode = 'NORMAL';
        editorMode.textContent = mode;
        toggleTabs();
      }

      if (mode) {
        editorMode.className = "";
        editorMode.classList.add(mode.toLowerCase())
        editorMode.textContent = mode;
      }
    })

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
        var current = syntaxes[syntax];
        if (!current)
          current = {mode: "text"}

        code.getSession().setMode("ace/mode/" + current.mode);
      }

      function setCurrentFile(filepath) {
        filepath = filepath.split('/').pop();
        filepath = filepath.split('.').shift();
        editorFile.textContent = filepath;
        this.setTabs(filepath, true);
      }

      setCurrentFile = setCurrentFile.bind(this)

      var stream = fs.createReadStream(file)

      changeSyntax(file);
      setCurrentFile(file);

      var d = '';
      console.time('finished');

      stream.setEncoding('utf8');

      stream.on('data', (chunk) => {d += chunk;})

      stream.on('end', function() {
        code.getSession().setValue(d);
        console.timeEnd('finished');
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