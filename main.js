const electron = require('electron')
const resolve = require('path').resolve

const elekid = require('elekid')
const template = require('./src/template')

const app = electron.app
const BrowserWindow = electron.BrowserWindow

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 600,
    minWidth: 400,
    minHeight: 400,
    resizable: true,
    movable: true,
    center: true,
    //macOnly
    titleBarStyle: 'hidden-inset',
    title: 'Retro',
    // we want to go frameless on windows and linux
    frame: process.platform === 'darwin',
    transparent: true,
    hasShadow: true,
    debug: false,
    darkTheme: true,
    vibrancy: "ultra-dark",
    acceptFirstMouse: true,
    show: false,
    icon: resolve(__dirname + '/assets/images/logo-128.icns')
  })

  mainWindow.loadURL(elekid({
    path: 'src/components/Retro.js',
    template: template
  }))

  // Open the DevTools.
  mainWindow.webContents.openDevTools()

  mainWindow.on('closed', function() {
    mainWindow = null
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })
}

if (app) {
  app.on('ready', createWindow)

  app.on('window-all-closed', function() {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', function() {
    if (mainWindow === null) {
      createWindow()
    }
  })
}
