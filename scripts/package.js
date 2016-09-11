var target = process.argv[2] || 'win';

var fs = require('fs');
var archiver = require('archiver');

var targetPath = './dist/' + target + '/drclient.zip';
var output = fs.createWriteStream(targetPath);
var zipArchive = archiver('zip', {level: 9});

output.on('close', function() {
	console.log('done with the zip: ', targetPath);
});

zipArchive.pipe(output);

zipArchive.bulk([
	{ src: [ '**/*' ], cwd: './build/drclient/' + target + '64/', expand: true }
]);

zipArchive.finalize(function(err, bytes) {
	if(err) {
		throw err;
	}

	console.log('done:', bytes);
});
