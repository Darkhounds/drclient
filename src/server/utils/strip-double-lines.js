function stripDoubleLineBreaks (message) {
	message = message.replace(/\r/gm, '\n').replace(/\n\n/gm, '\n');
	if (message.indexOf('\n\n') > 0) {
		return stripDoubleLineBreaks(message);
	} else {
		return message;
	}
}

function getTagNames(message) {
	var tags = {};

	message.replace(/<([\w]+)([\s\w="']*)?[\/]?>([^<>]*)?(?:<\/\1>)?/gm, function () {
		if (!tags[arguments[1]]) {
			tags[arguments[1]] = [];
		}
		var attributes = {};
		(arguments[2] || '').split(' ').forEach(function (property) {
			var pair = property.split('=');
			if (pair.length === 2 ) {
				attributes[pair[0]] = pair[1].replace(/["']/g, '');
			}
		});

		tags[arguments[1]].push({attributes: attributes, content: arguments[3] || ''});
	});

	return tags;
}

module.exports = stripDoubleLineBreaks;