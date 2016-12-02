function Tron(encoding) {
	const fs = require('fs');
	const path = require('path');
	let queue = [];
	this.encoding = encoding || 'utf8';

	function write(filepath, data) {
		return fs.writeFileSync(filepath, data, this.encoding);
	}

	function writeStream(filepath, data) {
		const encode = this.encoding;
		return new Promise(function(resolve, reject) {
			const stream = fs.createWriteStream(filepath);
			stream.write(data, function() {
				stream.close();
				resolve();
			});
		});
	}

	function read(filepath) {
		const encode = this.encoding;
		return new Promise(function(resolve, reject) {
			fs.readFile(filepath, encode, function(err, data) {
				if (err)
					reject(err)
				else
					resolve(data)
			})
		})
	}

	function readStream(filepath) {
		const encode = this.encoding;
		return new Promise(function(resolve, reject) {
			const stream = fs.createReadStream(filepath);
			var d = '';
			stream.setEncoding(encode);
			stream.on('data', (chunk) => {
				d += chunk;
			});

			stream.on('end', function() {
				stream.close();
				resolve(d);
			});
		});
	}

	function isDirectory(filepath) {
		return new Promise(function(resolve, reject) {
			fs.stat(filepath, function(err, stat) {
				if (err) {
					reject(err);
				}

				resolve(stat.isDirectory());
			});
		});
	}

	function listFilesAsync(dir, filelist) {
		return new Promise(function(resolve, reject) {
			var files = fs.readdir(dir, function(err, files) {
				if (err)
					reject(err);

				filelist = filelist || [];
				var promises = [];

				for (var i = files.length - 1; i >= 0; i--) {
					const file = files[i];
					if (fs.statSync(path.join(dir, file)).isDirectory()) {
						promises.push(listFiles(path.join(dir, file), filelist));
					} else {
						filelist.push({
							"path": path.join(dir, file)
						});
					}
				}

				filelist = filelist.filter(function(file) {
					if (file.path.indexOf('.git') > -1)
						return false;
					else if (file.path.indexOf('node_modules') > -1)
						return false;

					return file
				});

				return Promise.all(promises).then(function(results) {
					for (var i = results.length - 1; i >= 0; i--) {
						filelist = filelist.concat(results[i]);
					}
					resolve(filelist)
				})
			});
		});
	}

	// TODO: Doens't do fs.stat synchrounous
	function listFiles(dir, filelist) {
		var files = fs.readdirSync(dir);
		filelist = filelist || [];

		files.forEach(function(file) {
			if (fs.statSync(path.join(dir, file)).isDirectory()) {
				filelist = listFiles(path.join(dir, file), filelist);
			} else {
				filelist.push({"path": path.join(dir, file)});
			}
		});
		return filelist.filter(function(file) {
			if (file.path.indexOf('.git') > -1)
				return false;
			else if (file.path.indexOf('node_modules') > -1)
				return false;
			else if (file.path.indexOf('.DS_Store') > -1)
				return false;
			else if (file.path.indexOf('.png') > -1)
				return false;
			else if (file.path.indexOf('.ico') > -1)
				return false;
			else if (file.path.indexOf('.jpg') > -1)
				return false;
			else if (file.path.indexOf('.jpeg') > -1)
				return false;
			else if (file.path.indexOf('.gif') > -1)
				return false;

			
			return file
		});

	}

	function folderPath(file) {
		return path.dirname(file);
	}

	this.read = read;
	this.readStream = readStream;
	this.write = write;
	this.listFiles = listFiles;
	this.writeStream = writeStream;
	this.folderPath = folderPath;
}

const tron = new Tron();
module.exports = tron;