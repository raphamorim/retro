import retro from '../retro'
import Notify from 'fs.notify'
import { remote as app } from 'electron'
import { tabs, modalSearch, modalItems, modal } from '../config/selectors'
import animation from '../animation'
import loader from './loader'

const container = document.querySelector('.container')
const presentation = document.querySelector('.presentation')

export const notifications = new Notify()

export function openFiles() {
  app.dialog.showOpenDialog(app.getCurrentWindow(), {
    filters: [
      { name: 'All Files', extensions: [ '*' ] },
      { name: 'Images', extensions: [ 'jpg', 'png', 'gif' ] },
      { name: 'Movies', extensions: [ 'mkv', 'avi', 'mp4' ] }
    ],
    properties: [ 'openFile' ]
  }, (fileNames) => {
    if (fileNames && fileNames.length) {
      loader.on()
      retro.openFile(fileNames[0])
      notifications.add(fileNames[0])
    }
  })
}

export function unfocusTabs() {
  tabs.classList.add('unfocus')
}

export function toggleTabs() {
  tabs.classList.toggle('unfocus')
}

export function toggleModal() {
  modal.classList.toggle('visible')
  if (modal.classList.contains('visible')) {
    setTimeout(() => {
      modalSearch.focus()
    }, 30)
  }
}

export function displayEditor() {
  document.body.removeChild(presentation)
  container.style.display = 'block'
}

export function displayPresentation() {
  presentation.style.display = 'block'
  animation.presentation()
}

notifications.on('change', (file, event, path) => {
  if (event === 'change') {
    retro.updateFile(path)
  }
})
