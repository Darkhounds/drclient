var Buffer = require('buffer').Buffer;

module.exports = function (password, mask) {
	if (typeof mask === 'string') {
		mask = new Buffer(mask);
	}

	if (typeof password === 'string') {
		password = new Buffer(password);
	}

	var masked = new Buffer(password.length);

	for (var i = 0; i < mask.length && i < password.length; i++) {
		var maskedValue = (mask[i] ^ (password[i] - 0x20)) + 0x20;
		masked[i] = maskedValue;
	}

	return masked;
};

