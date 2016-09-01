var target = process.argv[2] || 'win';

var tar = require("tar")
	, fstream = require("fstream")
	, fs = require("fs");

var dirDest = fs.createWriteStream('./dist/' + target + '/drclient.zip');

var packer = tar.Pack({ noProprietary: true, fromBase: true })
	.on('error', onError)
	.on('end', onEnd);

// This must be a "directory"
fstream.Reader({ path: './build/drclient/' + target + '64', type: "Directory" })
	.on('error', onError)
	.pipe(packer)
	.pipe(dirDest);

function onError(err) {
	console.error('An error occurred:', err);
}

function onEnd() {
	console.log('Packed!');
}

