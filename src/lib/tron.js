function Tron(encoding) {
  const fs = require('fs')
  const path = require('path')
  let queue = []
  this.encoding = encoding || 'utf8'

  function writeSync(filepath, data) {
    return fs.writeFileSync(filepath, data, this.encoding)
  }

  function upsert(filepath, data) {
    if (!fs.existsSync(filepath)) {
      writeSync(filepath, data)

      return data
    }

    return fs.readFileSync(filepath, this.encoding)
  }

  function writeStream(filepath, data) {
    const encode = this.encoding

    return new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(filepath)
      stream.write(data, () => {
        stream.close()
        resolve()
      })
    })
  }

  function read(filepath) {
    const encode = this.encoding

    return new Promise((resolve, reject) => {
      fs.readFile(filepath, encode, (err, data) => {
        if (err)
          reject(err)
        else
          resolve(data)
      })
    })
  }

  function readStream(filepath) {
    const encode = this.encoding

    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filepath)
      let file = ''
      stream.setEncoding(encode)
      stream.on('data', (chunk) => {
        file += chunk
      })

      stream.on('end', () => {
        stream.close()
        resolve(file)
      })
    })
  }

  function isDirectory(filepath) {
    return new Promise((resolve, reject) => {
      fs.stat(filepath, (err, stat) => {
        if (err) {
          reject(err)
        }

        resolve(stat.isDirectory())
      })
    })
  }

  // TODO: Doens't do fs.stat synchrounous
  function listFiles(dir, filelist) {
    const files = fs.readdirSync(dir);
    filelist = filelist || []

    files.forEach(file => {
      if (fs.statSync(path.join(dir, file)).isDirectory()) {
        filelist = listFiles(path.join(dir, file), filelist)
      } else {
        filelist.push({ 'path': path.join(dir, file) })
      }
    })

    return filelist.filter(file => {
      if (file.path.includes('.git'))
        return false
      else if (file.path.includes('node_modules'))
        return false
      else if (file.path.includes('.DS_Store'))
        return false
      else if (file.path.includes('.png'))
        return false
      else if (file.path.includes('.ico'))
        return false
      else if (file.path.includes('.jpg'))
        return false
      else if (file.path.includes('.jpeg'))
        return false
      else if (file.path.includes('.gif'))
        return false

      return file
    })
  }

  function listFilesAsync(dir, filelist) {
    return new Promise((resolve, reject) => {
      const files = fs.readdir(dir, (err, files) => {
        if (err)
          reject(err)

        filelist = filelist || []
        const promises = [];

        for (let i = files.length - 1; i >= 0; i--) {
          const file = files[i]
          if (fs.statSync(path.join(dir, file)).isDirectory()) {
            promises.push(listFiles(path.join(dir, file), filelist))
          } else {
            filelist.push({
              'path': path.join(dir, file)
            })
          }
        }

        filelist = filelist.filter(file => {
          if (file.path.includes('.git'))
            return false
          else if (file.path.includes('node_modules'))
            return false

          return file
        })

        return Promise.all(promises).then(results => {
          for (let i = results.length - 1; i >= 0; i--) {
            filelist = filelist.concat(results[i])
          }
          resolve(filelist)
        })
      });
    })
  }

  function folderPath(file) {
    return path.dirname(file)
  }

  this.read = read
  this.readStream = readStream
  this.writeSync = writeSync
  this.listFiles = listFiles
  this.writeStream = writeStream
  this.folderPath = folderPath
  this.upsert = upsert
}

const tron = new Tron()
export default tron
