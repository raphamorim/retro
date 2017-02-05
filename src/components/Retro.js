import React, { Component } from 'react'
import Editor from './Editor'

import TopBar from './atoms/topbar'
import Tabs from './atoms/tabs'
import Dialog from './atoms/dialog'

export default class Retro extends Component {
  constructor() {
    super()
  }

  render() {
    return (
      <div className="retro container">
        <TopBar/>
        <Dialog/>
        <Tabs/>
        <Editor/>
      </div>
    )
  }
}
