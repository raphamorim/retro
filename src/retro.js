import {
  tabs
} from './selectors'

import {
  openFiles,
  unfocusTabs,
  toggleModal,
  toggleTabs
} from './screen'

import tron from './tron'
import config from './config'

import { js_beautify, css, html } from 'js-beautify'

// TODO: Change to ES2015/Class
function Retro() {
  const editor = document.getElementById("editor"),
    editorFile = document.getElementById("editor-file"),
    editorMode = document.getElementById('editor-mode'),
    editorSyntax = document.getElementById('editor-syntax')

  const code = ace.edit("editor")

  code.setKeyboardHandler("ace/keyboard/vim")
  code.setTheme("ace/theme/monokai")
  code.setOptions({
    showPrintMargin: false
  })
  code.$blockScrolling = Infinity
  code.getSession().setMode("ace/mode/javascript")
  code.getSession().setUseWorker(false)

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
    const mode = code.getSession().getMode().$id.split('/').pop()
    if (mode === 'javascript') {
      var val = code.session.getValue()
      code.session.setValue(js_beautify(val, config.format))
    } else if (mode === 'html') {
      var val = code.session.getValue()
      code.session.setValue(html(val, config.format))
    } else if (mode === 'css') {
      var val = code.session.getValue()
      code.session.setValue(css(val, config.format))
    }
  }

  code.on("changeStatus", function() {
    var mode = code.keyBinding.getStatusText(code)
    unfocusTabs()

    if (!mode || !mode.length) {
      mode = 'NORMAL'
      editorMode.textContent = mode
      toggleTabs()
    }

    if (mode) {
      editorMode.className = ""
      editorMode.classList.add(mode.toLowerCase())
      editorMode.textContent = mode
    }
  })

  this.setTabs = function(file, asActive) {
    var tab = document.createElement("div")
    tab.classList.add("tabs-item")
    if (asActive) {
      tab.classList.add("active")
    }

    tab.textContent = file
    tabs.innerHTML = ''
    tabs.appendChild(tab)
  }

  this.openFile = function(file, tab) {
    function inputSyntax(filepath) {
      config.currentFile = filepath
      filepath = filepath.split('/').pop()
      filepath = filepath.split('.')
      if (filepath.length <= 1) {
        editorFile.textContent = ''
        editorSyntax.textContent = ''
        return
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
        config.cachedFiles = config.cachedFiles.concat(files);
      }
    })
  }

  function saveFile() {
    tron.writeStream(config.currentFile, code.getValue())
  }

  document.body.addEventListener('save-file', saveFile.bind(this), false);
}

const retro = new Retro();
export default retro;