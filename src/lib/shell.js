/*
 • clean screen, show result
 • when is selecting, replace with result
*/

const { spawn } = require('child_process')

class Shell {
  exec(command) {
    command = command.substr(1)
    console.debug(`[DEBUG]: command: ${command}`)

    const inputs = command.trim().split(' ')
    const mainInput = inputs.shift()
    console.log(`[DEBUG]: inputs: ${inputs}`, inputs)
    console.log(`[DEBUG]: mainInput: ${mainInput}`)
    const commandSpawn = spawn(mainInput, inputs)

    const shellElement = document.querySelector('#shell')
    shellElement.innerHTML = ''
    shellElement.classList.add('on')

    commandSpawn.stdout.on('data', (data) => {
      const p = document.createElement('p')
      p.textContent = data
      shellElement.appendChild(p)
    })

    commandSpawn.stderr.on('data', (data) => {
      const p = document.createElement('p')
      p.textContent = data
      shellElement.appendChild(p)
    })

    commandSpawn.on('close', (code) => {
      const keyPressHandler = (e) => {
        var key = e.which || e.keyCode
        if (key === 13) {
          shellElement.classList.remove('on')
          document.removeEventListener('keypress', keyPressHandler)
        }
      }

      const clickHandler = (e) => {
        shellElement.classList.remove('on')
        e.target.removeEventListener('click', clickHandler)
        e.preventDefault()
      }

      const p = document.createElement('p')
      p.textContent = 'Press ENTER or CLICK HERE to continue'
      p.classList.add('close')
      p.addEventListener('click', clickHandler)

      document.addEventListener('keypress', keyPressHandler)
      shellElement.appendChild(p)
    })
  }
}

module.exports = new Shell()
