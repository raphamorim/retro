/* global ace */

import {
  openFiles,
  unfocusTabs,
  toggleModal,
  toggleTabs
} from './lib/screen'

import loader from './lib/loader'
import tron from './lib/tron'
import data from './data'

import config from './config'
import syntaxes from './config/syntax'

import {
  tabs
} from './config/selectors'

import {
  js_beautify,
  css,
  html
} from 'js-beautify'

function Retro() {
  const editor = document.getElementById('editor'),
    editorFile = document.getElementById('editor-file'),
    editorMode = document.getElementById('editor-mode'),
    editorSyntax = document.getElementById('editor-syntax')

  ace.require('ace/ext/language_tools')
  ace.require('ace/ext/emmet')
  const code = ace.edit('editor')

  code.setKeyboardHandler('ace/keyboard/vim')
    // code.setShowInvisibles(true)
  code.setTheme('ace/theme/retro')
  code.setOptions({
    showPrintMargin: false,
    enableBasicAutocompletion: true,
    enableLiveAutocompletion: true
  })
  code.$blockScrolling = Infinity
  code.getSession().setMode('ace/mode/text')
  code.getSession().setUseWorker(false)
  code.getSession().setUseWrapMode(true)

  function saveFile() {
    tron.writeStream(config.currentFile, code.getValue())
  }

  function formatCode() {
    const currentLine = code.getSelectionRange().start.row
    const mode = code.getSession().getMode().$id.split('/').pop()
    let val = code.session.getValue()

    if (mode === 'javascript') {
      code.session.setValue(js_beautify(val, data.format))
      code.gotoLine(currentLine + 1, Infinity)
    } else if (mode === 'html') {
      code.session.setValue(html(val, data.format))
      code.gotoLine(currentLine + 1, Infinity)
    } else if (mode === 'css') {
      code.session.setValue(css(val, data.format))
      code.gotoLine(currentLine + 1, Infinity)
    }
  }

  code.commands.addCommand({
    name: 'open file',
    exec: openFiles,
    bindKey: {
      mac: 'cmd-o',
      win: 'ctrl-o'
    }
  })

  code.commands.addCommand({
    name: 'toggle tabs',
    exec: toggleTabs,
    bindKey: {
      mac: 'cmd-e',
      win: 'ctrl-e'
    }
  })

  code.commands.addCommand({
    name: 'toggle modal',
    exec: toggleModal,
    bindKey: {
      mac: 'cmd-p',
      win: 'ctrl-p'
    }
  })

  code.commands.addCommand({
    name: 'save file',
    exec: saveFile,
    bindKey: {
      mac: 'cmd-s',
      win: 'ctrl-s'
    }
  })

  code.commands.addCommand({
    name: 'format code',
    exec: formatCode,
    bindKey: {
      mac: 'cmd-shift-f',
      win: 'ctrl-shift-f'
    }
  })

  code.on('changeStatus', function() {
    var mode = code.keyBinding.getStatusText(code)
    unfocusTabs()

    if (!mode || mode.length < 2) {
      mode = 'NORMAL'
      editorMode.textContent = mode
      toggleTabs()
    }

    if (mode) {
      editorMode.className = ''
      editorMode.classList.add(mode.toLowerCase())
      editorMode.textContent = mode
    }
  })

  this.setTabs = function(file, asActive) {
    var tab = document.createElement('div')
    tab.classList.add('tabs-item')
    if (asActive) {
      tab.classList.add('active')
    }

    tab.textContent = file
    tabs.innerHTML = ''
    tabs.appendChild(tab)
  }

  this.updateFile = function(file, forcedUpdate = false) {
    tron.readStream(file).then(function(tronData) {
      if (tronData === code.getValue())
        return

      if (!forcedUpdate)
        forcedUpdate = confirm('This file was update, do you want to update it?')

      if (forcedUpdate)
        code.getSession().setValue(tronData)
    })
  }

  this.openFile = function(file, tab) {
    loader.on()

    function inputSyntax(filepath) {
      config.currentFile = filepath
      filepath = filepath.split('/').pop()
      filepath = filepath.split('.')
      if (filepath.length <= 1) {
        editorFile.textContent = ''
        editorSyntax.textContent = ''

        return
      }

      const syntax = filepath.pop()
      editorSyntax.textContent = syntax
      var current = syntaxes[syntax]
      if (!current)
        current = {
          mode: 'text'
        }

      code.getSession().setMode('ace/mode/' + current.mode)
      if (current.mode === 'html') {
        code.setOption('enableEmmet', true)
      }
    }

    function setCurrentFile(filepath) {
      filepath = filepath.split('/').pop()
      filepath = filepath.split('.').shift()
      editorFile.textContent = filepath
      this.setTabs(filepath, true)
    }

    setCurrentFile = setCurrentFile.bind(this)

    tron.readStream(file).then(function(tronData) {
      code.getSession().setValue(tronData)
      inputSyntax(file)
      setCurrentFile(file)
      const files = tron.listFiles(tron.folderPath(file))
      if (files.length) {
        config.cachedFiles = config.cachedFiles.concat(files)
      }
    }).then(() => {
      setTimeout(() => {
        loader.off()
      }, 500)
    })
  }

  document.body.addEventListener('save-file', saveFile.bind(this), false)
}

const retro = new Retro()
export default retro