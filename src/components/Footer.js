import React, { Component } from 'react'

export default class Footer extends Component {
  constructor(props) {
    super()
    this.state = {
        mode: props.mode || 'normal',
        file: props.file || '',
        syntax: props.syntax || ''
    }
  }

  render() {
    const { mode, file, syntax } = this.state

    return (
        <footer>
            <div id="editor-mode" className="normal">{ mode }</div>
            <div id="editor-file" className="normal">{ file }</div>
            <div id="editor-syntax" className="normal">{ syntax }</div>
            <div className="loader"></div>
        </footer>
    )
  }
}
