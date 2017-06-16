/*
 • clean screen, show result
 • when is selecting, replace with result
*/

const { spawn } = require('child_process')

class Shell {
  exec(command) {
    command = command.substr(1)
    console.debug(`[ DEBUG ]: command: ${command}`)

    const inputs = command.trim().split(' ')
    const mainInput = inputs.shift()
    console.log(`[ DEBUG ]: inputs: ${inputs}`, inputs)
    console.log(`[ DEBUG ]: mainInput: ${mainInput}`)
    const commandSpawn = spawn(mainInput, inputs)

    const shellElement = document.querySelector('#shell')
    shellElement.innerHTML = ''
    shellElement.classList.add('on')

    commandSpawn.stdout.on('data', (data) => {
      const pNode = document.createElement('p')
      pNode.textContent = data
      shellElement.appendChild(pNode)
    })

    commandSpawn.stderr.on('data', (data) => {
      const pNode = document.createElement('p')
      pNode.textContent = data
      shellElement.appendChild(pNode)
    })

    commandSpawn.on('close', (code) => {
      const keyPressHandler = (ev) => {
        var key = ev.which || ev.keyCode
        if (key === 13 && shellElement.classList.contains('on')) {
          shellElement.classList.remove('on')
          document.removeEventListener('keypress', keyPressHandler)
        }
      }

      const clickHandler = (ev) => {
        shellElement.classList.remove('on')
        ev.target.removeEventListener('click', clickHandler)
        ev.preventDefault()
      }

      const pNode = document.createElement('p')
      pNode.textContent = 'Press ENTER or CLICK HERE to continue'
      pNode.classList.add('close')
      pNode.addEventListener('click', clickHandler)

      document.addEventListener('keypress', keyPressHandler)
      shellElement.appendChild(pNode)
    })
  }
}

module.exports = new Shell()
