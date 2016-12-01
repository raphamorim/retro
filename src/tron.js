function Tron(encoding) {
	const fs = require('fs');
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

	this.read = read;
	this.readStream = readStream;
	this.write = write;
	this.writeStream = writeStream;
}

const tron = new Tron();
module.exports = tron;