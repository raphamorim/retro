'use strict';

const CONFIG = require('./src/config');

const fuzeOptions = {
  shouldSort: true,
  threshold: 0.6,
  location: 0,
  distance: 100,
  maxPatternLength: 32,
  keys: [
    "path"
  ]
};

const tron = require('./src/tron');
const syntaxes = require('./src/syntax');
const app = require('electron').remote;
const dialog = app.dialog;
const retro = new Retro();

const tabs = document.querySelector('.tabs');
const modal = document.querySelector('.modal');
const modalItems = document.querySelector('.modal-items');
const modalSearch = document.querySelector('#modal-search');

// TODO: Change to ESLint?
const beautify = require('js-beautify').js_beautify;
const beautifyCss = require('js-beautify').css;
const beautifyHtml = require('js-beautify').html;

const Fuse = require('fuse.js');

let currentFile;
let cachedFiles = [];

modalSearch.addEventListener('keydown', function(e) {
  // enter
  if (e.keyCode === 13) {
    enterModalItems()
  }

  // up key
  if (e.keyCode === 38) {
    updateModalItems('up')
  }

  // down key
  if (e.keyCode === 40) {
    updateModalItems('down')
  }

  // esc
  if (e.keyCode === 27)
    modal.classList.remove('visible');
});

function enterModalItems() {
  modal.classList.remove('visible');
  const item = modalItems.querySelector('.active');
  retro.openFile(item.getAttribute('data-path'));
}

function indexInParent(node) {
  var children = node.parentNode.childNodes;
  var num = 0;
  for (var i = 0; i < children.length; i++) {
    if (children[i] == node) return num;
    if (children[i].nodeType == 1) num++;
  }
  return -1;
}

function updateModalItems(key) {
  const item = modalItems.querySelector('.active');
  let currentPos = indexInParent(item);
  
  let nextPos = (key === 'down') ? ++currentPos : --currentPos;
  if (currentPos < 0) {
    nextPos = modalItems.children.length - 1;
  } else if (currentPos >= modalItems.children.length) {
    nextPos = 0;
  }

  const nextItem = modalItems.children[nextPos];
  if (nextItem) {
    item.classList.remove('active');
    nextItem.classList.add('active');
  }
}

modalSearch.addEventListener('input', function(e) {
  const fuse = new Fuse(cachedFiles, fuzeOptions);
  const search = (fuse.search(e.target.value)).slice(0, 10);
  modalItems.innerHTML = '';
  for (var i = 0; i < search.length; i++) {
    var div = document.createElement('div');
    div.classList.add('modal-item');
    if (i === 0) {
      div.classList.add('active');
    }
    div.setAttribute('data-path', search[i].path);
    div.textContent = '...' + search[i].path.slice(-40);
    modalItems.appendChild(div);
  }
})

// Helpers

function unfocusTabs() {
  tabs.classList.add('unfocus');
}

function toggleTabs() {
  tabs.classList.toggle('unfocus');
}

function toggleModal() {
  modal.classList.toggle('visible');
  if (modal.classList.contains('visible')) {
    setTimeout(() => {
      modalSearch.focus()
    }, 30);
  }
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
    name: "toggle modal",
    exec: toggleModal,
    bindKey: {
      mac: "cmd-p",
      win: "ctrl-p"
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
    } else if (mode === 'html') {
      var val = code.session.getValue()
      code.session.setValue(beautifyHtml(val, CONFIG.format))
    } else if (mode === 'css') {
      var val = code.session.getValue()
      code.session.setValue(beautifyCss(val, CONFIG.format))
    }
  }

  code.on("changeStatus", function() {
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
    function inputSyntax(filepath) {
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
      inputSyntax(file);
      setCurrentFile(file);
      const files = tron.listFiles(tron.folderPath(file));
      if (files.length) {
        cachedFiles = cachedFiles.concat(files);
      }
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