'use strict';

const CONFIG = require('./src/config');

const tron = require('./src/tron');
const syntaxes = require('./src/syntax');
const app = require('electron').remote;
const dialog = app.dialog;
const retro = new Retro();
const tabs = document.querySelector('.tabs');
const beautify = require('js-beautify').js_beautify;
const beautifyCss = require('js-beautify').css;
const beautifyHtml = require('js-beautify').html;

let currentFile;

// Helpers

function unfocusTabs() {
  tabs.classList.add('unfocus');
}

function toggleTabs() {
  tabs.classList.toggle('unfocus');
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
    bindKey: {
      mac: "cmd-o",
      win: "ctrl-o"
    }
  })

  code.commands.addCommand({
    name: "toggle tabs",
    exec: toggleTabs,
    bindKey: {
      mac: "cmd-e",
      win: "ctrl-e"
    }
  })

  code.commands.addCommand({
    name: "save file",
    exec: saveFile,
    bindKey: {
      mac: "cmd-s",
      win: "ctrl-s"
    }
  })

  code.commands.addCommand({
    name: "format code",
    exec: formatCode,
    bindKey: {
      mac: "cmd-shift-f",
      win: "ctrl-shift-f"
    }
  })

  function formatCode() {
    const mode = code.getSession().getMode().$id.split('/').pop();
    if (mode === 'javascript') {
      var val = code.session.getValue()
      code.session.setValue(beautify(val, CONFIG.format))
    } 
    else if (mode === 'html') {
      var val = code.session.getValue()
      code.session.setValue(beautifyHtml(val, CONFIG.format))
    }
    else if (mode === 'css') {
      var val = code.session.getValue()
      code.session.setValue(beautifyCss(val, CONFIG.format))
    }
  }

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
      currentFile = filepath;
      filepath = filepath.split('/').pop();
      filepath = filepath.split('.');
      if (filepath.length <= 1) {
        editorFile.textContent = '';
        editorSyntax.textContent = '';
        return;
      }

      const syntax = filepath.pop();
      editorSyntax.textContent = syntax;
      var current = syntaxes[syntax];
      if (!current)
        current = {
          mode: "text"
        }

      code.getSession().setMode("ace/mode/" + current.mode);
    }

    function setCurrentFile(filepath) {
      filepath = filepath.split('/').pop();
      filepath = filepath.split('.').shift();
      editorFile.textContent = filepath;
      this.setTabs(filepath, true);
    }

    setCurrentFile = setCurrentFile.bind(this)

    tron.readStream(file).then(function(data) {
      code.getSession().setValue(data);
      changeSyntax(file);
      setCurrentFile(file);
    })
  }

  function saveFile() {
    tron.writeStream(currentFile, code.getValue())
  }

  document.body.addEventListener('save-file', saveFile.bind(this), false);
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