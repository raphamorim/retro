import retro from './retro'

import config from './config'
import { modalSearch, modalItems, modal } from './selectors'
import keys from './keys'
import Fuse from 'Fuse.js'

const fuzeOptions = {
  shouldSort: true,
  threshold: 0.6,
  location: 0,
  distance: 100,
  maxPatternLength: 32,
  keys: [
    "path"
  ]
}

// TODO: Change to ESLint?
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
    modal.classList.remove('visible')
})

function enterModalItems() {
  modal.classList.remove('visible')
  const item = modalItems.querySelector('.active')
  retro.openFile(item.getAttribute('data-path'))
}

function indexInParent(node) {
  var children = node.parentNode.childNodes
  var num = 0
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
  const fuse = new Fuse(config.cachedFiles, fuzeOptions);
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

// Init
document.body.ondrop = (ev) => {
  var filepath = ev.dataTransfer.files[0].path;
  retro.openFile(filepath);
  ev.preventDefault()
}

keys.init();