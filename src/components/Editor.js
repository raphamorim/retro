/* global ace */

import React, { Component } from 'react'
import Footer from './Footer'

import { remote as app } from 'electron'
import tron from '../lib/tron'

import {
    js_beautify,
    css,
    html
} from 'js-beautify'

import syntaxes from '../config/syntax'

export default class Editor extends Component {
    constructor() {
        super()
    }

    openFilesDialog() {
        app.dialog.showOpenDialog((fileNames) => {
            // if (fileNames && fileNames.length) {
            //     retro.openFile(fileNames[0])
            //     notifications.add(fileNames[0])
            // }
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
        code.getSession().setValue('asasasas')
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
