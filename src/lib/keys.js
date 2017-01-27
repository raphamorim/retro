/* global key */

import {
  displayEditor,
  openFiles,
  toggleModal,
  toggleTabs
} from './screen'

class Keys {
  // TODO: reset method: unbind all keys

  editor() {
    key('⌘+o', function(event, handler) {
      // TODO: Multiple files and diretory
      openFiles()
    })

    key('⌘+p', function(event, handler) {
      toggleModal()
    })

    key('⌘+e', function(event, handler) {
      toggleTabs()
    })

    key('⌘+,', function(event, handler) {
      // TODO: Preferences
      console.log('Preferences')
    })
  }

  presentation() {
    key('enter', () => {
      displayEditor()
      key.unbind('enter')
      this.editor()
    })
  }
}

export default new Keys()
