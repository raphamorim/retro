/* global ace */

import React, { Component } from 'react'
import Footer from './Footer'

import { remote as app } from 'electron'
import tron from '../lib/tron'
import loader from '../lib/loader'

import {
  js_beautify,
  css,
  html
} from 'js-beautify'

import syntaxes from '../config/syntax'

class Editor extends Component {
  static defaultProps = {
    filepath: false,
  }

  state = {
    reading: false,
  }

  openFile = () => {
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

  openFilesDialog() {
    console.log(this.openFile)
    app.dialog.showOpenDialog((fileNames) => {
      if (fileNames && fileNames.length) {
        this.openFile(fileNames[0])
        // notifications.add(fileNames[0])
      }
    })
  }

    // TODO: formatCode
  formatCode() {
      return false;

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

  componentDidMount() {
      ace.require('ace/ext/language_tools')
      ace.require('ace/ext/emmet')

      const code = ace.edit(this.refs.editor)
      code.setKeyboardHandler('ace/keyboard/vim')
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

      code.commands.addCommand({
          name: 'open file',
          exec: this.openFilesDialog,
          bindKey: {
              mac: 'cmd-o',
              win: 'ctrl-o'
          }
      })

      // code.commands.addCommand({
      //     name: 'toggle tabs',
      //     exec: toggleTabs,
      //     bindKey: {
      //         mac: 'cmd-e',
      //         win: 'ctrl-e'
      //     }
      // })

      // code.commands.addCommand({
      //     name: 'toggle modal',
      //     exec: toggleModal,
      //     bindKey: {
      //         mac: 'cmd-p',
      //         win: 'ctrl-p'
      //     }
      // })

      // code.commands.addCommand({
      //     name: 'save file',
      //     exec: saveFile,
      //     bindKey: {
      //         mac: 'cmd-s',
      //         win: 'ctrl-s'
      //     }
      // })

      // code.commands.addCommand({
      //     name: 'format code',
      //     exec: formatCode,
      //     bindKey: {
      //         mac: 'cmd-shift-f',
      //         win: 'ctrl-shift-f'
      //     }
      // })

      code.on('changeStatus', function() {
          let mode = code.keyBinding.getStatusText(code)

          // if (!mode || mode.length < 2) {
          //     mode = 'NORMAL'
          //     editorMode.textContent = mode
          //     toggleTabs()
          // }

          // if (mode) {
          //     editorMode.className = ''
          //     editorMode.classList.add(mode.toLowerCase())
          //     editorMode.textContent = mode
          // }
      })

      code.getSession().setMode('ace/mode/javascript')
  }

  render() {
    return (
      <div>
        <section role="main" className="main">
          <div ref="editor" id="editor"></div>
        </section>
        <Footer/>
      </div>
    )
  }
}

export default Editor
