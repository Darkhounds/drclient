module.exports = function (data){
	var values = data.toString().trim().split('\t').reverse();
	var characters = {};
	var characterName = '';
	var isCharacterName = true;
	var isInvalid = false;
	values.forEach(function(value) {
		if (isInvalid) {
			isInvalid = false;
			isCharacterName = true;
		} else if(isCharacterName) {
			characterName = value.toLowerCase();
			if (characterName.length <= 1) {
				isInvalid = true;
			} else {
				isCharacterName = false;
			}
		} else {
			characters[characterName] = value;
			isCharacterName = true;
		}
	});

	return characters;
};
