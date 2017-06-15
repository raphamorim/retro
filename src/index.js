import retro from './retro'
import data from './data'
import config from './config'
import { presentation, container, modalSearch, modalItems, modal } from './config/selectors'
import { displayEditor, displayPresentation } from './lib/screen'
import keys from './lib/keys'
import Fuse from 'Fuse.js'

// DEBUG
import { notifications } from './lib/screen'

const fuzeOptions = {
  shouldSort: true,
  threshold: 0.6,
  location: 0,
  distance: 100,
  maxPatternLength: 32,
  keys: [
    'path'
  ]
}

function enterModalItems() {
  modal.classList.remove('visible')
  const item = modalItems.querySelector('.active')
  retro.openFile(item.getAttribute('data-path'))
}

function indexInParent(node) {
  const children = node.parentNode.childNodes;
  let num = 0;
  for (let i = 0; i < children.length; i++) {
    if (children[i] === node) return num
    if (children[i].nodeType === 1) num++
  }

  return -1
}

function updateModalItems(key) {
  const item = modalItems.querySelector('.active')
  let currentPos = indexInParent(item)

  let nextPos = (key === 'down') ? ++currentPos : --currentPos
  if (currentPos < 0) {
    nextPos = modalItems.children.length - 1
  } else if (currentPos >= modalItems.children.length) {
    nextPos = 0
  }

  const nextItem = modalItems.children[nextPos]
  if (nextItem) {
    item.classList.remove('active')
    nextItem.classList.add('active')
  }
}

// TODO: Change to ESLint?
modalSearch.addEventListener('keydown', ev => {
  // enter
  if (ev.keyCode === 13) {
    enterModalItems()
  }

  // up key
  if (ev.keyCode === 38) {
    updateModalItems('up')
  }

  // down key
  if (ev.keyCode === 40) {
    updateModalItems('down')
  }

  // esc
  if (ev.keyCode === 27)
    modal.classList.remove('visible')
})

modalSearch.addEventListener('input', ev => {
  const fuse = new Fuse(config.cachedFiles, fuzeOptions)
  const search = (fuse.search(ev.target.value)).slice(0, 10)
  modalItems.innerHTML = ''
  for (let i = 0; i < search.length; i++) {
    const div = document.createElement('div');
    div.classList.add('modal-item')
    if (i === 0) {
      div.classList.add('active')
    }
    div.setAttribute('data-path', search[i].path)
    div.textContent = `...${search[i].path.slice(-40)}`
    modalItems.appendChild(div)
  }
})

// Init
document.body.ondrop = (ev) => {
  const filepath = ev.dataTransfer.files[0].path;
  retro.openFile(filepath)
  ev.preventDefault()
}

data.get().then((retroConfig) => {
  if (retroConfig) {
    displayEditor()
    keys.editor()
  } else {
    displayPresentation()
    keys.presentation()
    data.init()
  }
})
