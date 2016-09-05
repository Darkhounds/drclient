module.exports = function (data) {
	var values = data.toString().trim().split('\t').reverse();

	var config = {};
	values.forEach(function (pair){
		var parts = pair.split('=');
		if (parts.length === 2) {
			config[parts[0]] = parts[1];
		}
	});

	return config;
};
