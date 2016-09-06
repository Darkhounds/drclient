var util = require('util');

var rawParsers = [];
var streamParsers = [];
var lineParsers = [];
function parseGameMessage(message) {
	message = runRawParsers(message);
	message = runStreamParsers(message);
	message = runLineParsers(message);

	message = quiet(message);

	return message + ((message && message.substr(-1) !== '\n')?"\n":'');
}

function runRawParsers(message) {
	if (message) {
		rawParsers.map(function (parser) {
			if (message) {
				message = parser(message);
			}
		});
	}

	return message;
}

function parseInlinedMultiTags(message) {
	var pattern = /<[\/]?[^<>]*[\/]?(><){1}[/]?[^<>]*[/]?>/ig;
	message = message.trim().replace(pattern, function () {
		var parsed = arguments[0].replace(/></i, '>\n<');
		return parsed;
	});

	var leftOver = pattern.exec(message);

	if (leftOver && leftOver.length) return parseInlinedMultiTags(message);
	else return message + '\n';
}
rawParsers.push(parseInlinedMultiTags);

function parseClosedTags(message) {
	var pattern = /^<([\w]*)[^<>]*>[^<>\n]*(\n{1})(<\/\1>){1}/;
	message = message.trim().replace(pattern, function () {
		var parsed = arguments[0].replace(new RegExp(arguments[2] + arguments[3], ''), arguments[3]);
		return parsed;
	});

	message = message.trim().replace(/^<([^<>\/ ]*)[^<>]*>[^<>]*<[\/]?\1>(.)/m, function () {
		var parsed = arguments[0].replace(/(.)$/i, '\n' + arguments[2]);
		return parsed;
	});

	message = message.trim().replace(/^<style[\s]+id=['"]{1}roomName['"]{1}[\s]*\/>[^<>\n]*(\n)<style[\s]+id=''[\s]*\/>/m, function () {
		var parsed = arguments[0].replace(/\n<style/m, '<style');
		return parsed;
	});

	var leftOver = pattern.exec(message);

	if (leftOver && leftOver.length) return parseInlinedMultiTags(message);
	else return message + '\n';
}
rawParsers.push(parseClosedTags);

function runStreamParsers(message) {
	return splitIntoLines(message).map(function(line) {
		line = line.trim();
		streamParsers.forEach(function (parser) {
			if (line && line.indexOf('<data') !== 0) {
				try {
					line = parser(line);
				} catch (e) {
					console.log('Error', line);
					console.log(e, e.stack);
					line = '';
				}
			}
		});
		return line
	}).filter(function (line) { return line }).join('\n');
}

var _settings = null;
function parseSettings(message) {
	if (message.indexOf('</settings>') === 0) {
		_settings.push('</data>');
		message = _settings.join('');
		_settings = null;
	} else if (message.indexOf('<settings ') === 0) {
		_settings = [];
		_settings.push('<data group="system" type="settings">');
		message = '';
	} else if (_settings) {
		_settings.push(message);
		message = '';
	}

	return message;
}
streamParsers.push(parseSettings);

var _appConfig = null;
function parseAppConfig(message) {
	if (message.indexOf('<endSetup') === 0) {
		_appConfig.push('</data>');
		message = _appConfig.join('');
		_appConfig = null;
	} else if (message.indexOf('<app') === 0) {
		var values = message.match(/<app[\s]+char=['"]{1}([^'"]*)['"]{1}[\s]+game=['"]{1}([^'"]*)['"]{1}[\s]+title=['"]{1}([^'"]*)['"]{1}[\s]*\/>/i);
		_appConfig = [];
		_appConfig.push('<data group="system" type="config" char="' + values[1] + '" game="' + values[2] + '" title="' + values[3] + '" id="' + values[1] + '">');
		message = '';
	} else if (_appConfig) {
		_appConfig.push(message);
		message = '';
	}

	return message;
}
streamParsers.push(parseAppConfig);

var _dialog = null;
function parseDialog(message) {
	if (message.indexOf('</dialogData') === 0) {
		_dialog.push('</data>');
		message = _dialog.join('');
		_dialog = null;
	} else if (message.indexOf('<dialogData') === 0) {

		var values = message.match(/<dialogData[\s]*id=['"]{1}([\w]*)['"]{1}[\s]*>(.*)$/i);
		_dialog = [];
		_dialog.push('<data group="ui" type="dialog" id="' + values[1] + '">');
		if (values[2]) {
			_dialog.push('<item>' + values[2] + '</item>');
		}
		message = '';
	} else if (_dialog) {
		_dialog.push('<item>' + message + '</item>');
		message = '';
	}

	return message;
}
streamParsers.push(parseDialog);

var _push = null;
function parsePush(message) {
	if (message.indexOf('<popStream') === 0) {
		_push.push('</data>');
		message = _push.join('');
		_push = null;
	} else if (message.indexOf('<pushStream') === 0) {

		var values = message.match(/<pushStream[\s]*id=['"]{1}([^'"]*)['"]{1}[\s]*\/>(.*)$/i);
		_push = [];
		_push.push('<data group="stream" type="push" id="' + values[1] + '">');
		if (values[2]) {
			_push.push('<item>' + values[2] + '</item>');
		}
		message = '';
	} else if (_push) {
		_push.push('<item>' + message + '</item>');
		message = '';
	}

	return message;
}
streamParsers.push(parsePush);

var _output = null;
function parseOutput(message) {
	if (message.indexOf('<output class=""') === 0) {
		_output.push('</data>');
		message = _output.join('');
		_output = null;
	} else if (message.indexOf('<output class="mono"') === 0) {
		_output = [];
		_output.push('<data group="stream" type="mono">\n');
		message = '';
	} else if (_output) {
		_output.push(parseBold(message) + '\n');
		message = '';
	}

	return message;
}
streamParsers.push(parseOutput);

var _bold = null;
function parseBold(message) {
	if (message.indexOf('<popBold') === 0) {
		_bold.push('</data>');
		message = _bold.join('');
		_bold = null;
	} else if (message.indexOf('<pushBold') === 0) {
		var values = message.match(/<pushBold[\s]*\/>(.*)$/i);
		_bold = [];
		_bold.push('<data group="system" type="bold" >\n');
		if (values[1]) {
			_bold.push(values[1] + '\n');
		}
		message = '';
	} else if (_bold) {
		_bold.push(message + '\n');
		message = '';
	}

	return message;
}
streamParsers.push(parseBold);

var _compass = null;
function parseCompass(message) {
	if (message.indexOf('</compass') === 0) {
		console.log('====>', 'STOP');
		_compass.push('</data>');
		message = _compass.join('');
		_compass = null;
	} else if (message.indexOf('<compass') === 0) {
		console.log('====>', 'START');
		_compass = [];
		_compass.push('<data group="ui" type="compass">');
		message = '';
	} else if (_compass) {
		console.log('====>', 'ADD');
		_compass.push(message.replace(/<dir/i, '<item'));
		message = '';
	}

	return message;
}
streamParsers.push(parseCompass);

function runLineParsers(message) {
	return splitIntoLines(message).map(function(line) {
		line = line.trim();
		lineParsers.forEach(function (parser) {
			if (line && line.indexOf('<data') !== 0) {
				try {
					line = parser(line);
				} catch (e) {
					console.log('Error', line);
					console.log(e, e.stack);
					line = '';
				}
			}
		});
		return line
	}).filter(function (line) { return line }).join('\n');
}

function parseClearStream(message) {
	if (message.indexOf('<clearStream') === 0) {
		var values = message.match(/<clearStream[^<>]+id=['"]{1}([^'"]*)['"]{1}[^<>]*\/>/i);
		message = '<data group="stream" type="clear" id="' + values[1] + '" />';
	}

	return message;
}
lineParsers.push(parseClearStream);

var _prompt = '';
function parsePrompt(message) {
	if (message.indexOf('<prompt') === 0) {
		var values = message.match(/<prompt[^<>]+time=['"]{1}([^'"]*)['"]{1}[^<>]*>([^<>]*)(<\/prompt>)?/i);
		message = '<data group="stream" type="prompt" time="' + values[1] + '">' + values[2];
		if (values[3]) {
			message += '</data>';
		} else {
			_prompt = message;
			message = '';
		}
	} else if (message.indexOf('</prompt') === 0) {
		message = _prompt + '</data>';
		_prompt = '';
	}

	return message;
}
lineParsers.push(parsePrompt);

var _roomName = '';
function parseRoomName(message) {
	if (message.match(/^<style[\s]+id=['"]{1}roomName['"]{1}/i)) {
		var values = message.match(/<style[^<>]+id=['"]{1}roomName['"]{1}[^<>]*>([^<>]*)(<style)?/i);
		message = '<data group="room" type="name">' + values[1];
		if (values[2]) {
			message += '</data>';
		} else {
			_roomName = message;
			message = '';
		}
	} else if (message.match(/^<style[\s]+id=['"]{2}/i)) {
		message = _roomName + '</data>';
		_roomName = '';
	}

	return message;
}
lineParsers.push(parseRoomName);

var _roomDescriptionPreset = '';
function parseRoomDescriptionPreset(message) {
	if (message.indexOf('<preset id=\'roomDesc\'') === 0) {
		var values = message.match(/<preset[^<>]+id=['"]{1}roomDesc['"]{1}[^<>]*>([^<>]*)(<\/preset>)?/i);
		message = '<data group="room" type="description">' + values[1];
		if (values[2]) {
			message += '</data>';
		} else {
			_roomDescriptionPreset = message;
			message = '';
		}
	} else if (message.indexOf('</preset') === 0) {
		message = _roomDescriptionPreset + '</data>';
		_roomDescriptionPreset = '';
	}

	return message;
}
lineParsers.push(parseRoomDescriptionPreset);

var _roomDescription = '';
function parseRoomDescription(message) {
	if (message.indexOf('<component id=\'room desc\'') === 0) {
		var values = message.match(/<component[^<>]+id=['"]{1}room desc['"]{1}[^<>]*>([^<>]*)(<\/component>)?/i);
		message = '<data group="room" type="description">' + values[1];
		if (values[2]) {
			message += '</data>';
		} else {
			_roomPlayers = message;
			message = '';
		}
	} else if (message.indexOf('</component') === 0) {
		message = _roomPlayers + '</data>';
		_roomPlayers = '';
	}

	return message;
}
lineParsers.push(parseRoomDescription);

var _roomPlayers = '';
function parseRoomPlayers(message) {
	if (message.indexOf('<component id=\'room players\'') === 0) {
		var values = message.match(/<component[^<>]+id=['"]{1}room players['"]{1}[^<>]*>([^<>]*)(<\/component>)?/i);
		message = '<data group="room" type="players">' + values[1];
		if (values[2]) {
			message += '</data>';
		} else {
			_roomPlayers = message;
			message = '';
		}
	} else if (message.indexOf('</component') === 0) {
		message = _roomPlayers + '</data>';
		_roomPlayers = '';
	}

	return message;
}
lineParsers.push(parseRoomPlayers);

var _roomObjects = '';
function parseRoomObjects(message) {
	if (message.indexOf('<component id=\'room objs\'') === 0) {
		var values = message.match(/<component[^<>]+id=['"]{1}room objs['"]{1}[^<>]*>([^<>]*)(<\/component>)?/i);
		message = '<data group="room" type="objects">' + values[1];
		if (values[2]) {
			message += '</data>';
		} else {
			_roomObjects = message;
			message = '';
		}
	} else if (message.indexOf('</component') === 0) {
		message = _roomObjects + '</data>';
		_roomObjects = '';
	}

	return message;
}
lineParsers.push(parseRoomObjects);

var _roomExtra = '';
function parseRoomExtra(message) {
	if (message.indexOf('<component id=\'room extra\'') === 0) {
		var values = message.match(/<component[^<>]+id=['"]{1}room extra['"]{1}[^<>]*>([^<>]*)(<\/component>)?/i);
		message = '<data group="room" type="extra">' + values[1];
		if (values[2]) {
			message += '</data>';
		} else {
			_roomExtra = message;
			message = '';
		}
	} else if (message.indexOf('</component') === 0) {
		message = _roomExtra + '</data>';
		_roomExtra = '';
	}

	return message;
}
lineParsers.push(parseRoomExtra);

var _roomExits = '';
function parseRoomExits(message) {
	if (message.indexOf('<component id=\'room exits\'') === 0) {
		var values = message.match(/<component[^<>]+id=['"]{1}room exits['"]{1}[^<>]*>([^<>]*)(<\/component>)?/i);
		message = '<data group="room" type="extra">' + values[1];
		if (values[2]) {
			message += '</data>';
		} else {
			_roomExits = message;
			message = '';
		}
	} else if (message.indexOf('</component') === 0) {
		message = _roomExits + '</data>';
		_roomExits = '';
	}

	return message;
}
lineParsers.push(parseRoomExits);

function parseRoomObvious(message) {
	if (message.indexOf('Obvious') === 0) {
		message = '<data group="room" type="obvious">' + message + '</data>';
	}

	return message;
}
lineParsers.push(parseRoomObvious);

function parseResourcePicture(message) {
	if (message.indexOf('<resource picture') === 0) {
		var values = message.match(/<resource[^<>]+picture=['"]{1}([^<>]*)['"]{1}[^<>\/]*\/>/i);
		message = '<data group="resource" type="picture">' + values[1] + '</data>';
	}

	return message;
}
lineParsers.push(parseResourcePicture);

function quiet (message) {
	if (!message) { return ''; }

	// return '';
	return message;
	return (message.indexOf('<data') === 0)?'':message;
	return (message.indexOf('<data') === 0)?message:'';
	return (message.indexOf('<data') === 0)?'':('<data group="system" id="unknown">' + message.trim() + '</data>\n');
	return (message.indexOf('<data') === 0)?message:('<data group="system" id="unknown">' + message.trim() + '</data>\n');
}

var stripDoubleLineBreaks = require('./strip-double-lines');
function splitIntoLines(message) {
	message = stripDoubleLineBreaks(message || '');

	var lines = message.split('\n').map(function (line) {
		return line.trim();
	});

	return lines;
}

module.exports = parseGameMessage;

function getTemplateAppConfig() {
	return "<app char='Mallakay' game='DR' title='[DR: Mallakay] StormFront'/>\n" +
	"<streamWindow id='main' title='Story' location='center' target='drop' resident='true'/>\n" +
	"<streamWindow id='inv' title='My Inventory' target='wear' ifClosed='' resident='true'/><clearStream id='inv' ifClosed=''/><pushStream id='inv'/>Your worn items are:\n" +
	"a lumpy bundle\n" +
	"a simple iron belt knife\n" +
	"a chain helm\n" +
	"some gloves\n" +
	"a target shield\n" +
	"a branch-framed canvas backpack\n" +
	"a divine charm\n" +
	"a leather sheath\n" +
	"some leather greaves\n" +
	"a leather coat\n" +
	"a scale aventail\n" +
	"an iron-banded parry stick with brown leather straps\n" +
	"<popStream/>\n" +
	"<exposeContainer id='stow'/><container id='stow' title='My Backpack' target='#13926026' location='right' save='' resident='true'/><clearContainer id='stow'/><inv id='stow'>In the backpack:</inv><inv id='stow'> a map</inv><inv id='stow'> some gemstone lizards</inv><inv id='stow'> a long pouch</inv><inv id='stow'> some long arrows</inv><inv id='stow'> some small rocks</inv><inv id='stow'> a bronze rapier</inv><openDialog type='dynamic' id='minivitals' title='Stats' location='statBar'><dialogData id='minivitals'></dialogData></openDialog>\n" +
	"<dialogData id='minivitals'><skin id='healthSkin' name='healthBar' controls='health' left='0%' top='0%' width='25%' height='100%'/><progressBar id='health' value='100' text='health 100%' left='0%' customText='t' top='0%' width='25%' height='100%'/></dialogData>\n" +
	"<dialogData id='minivitals'><skin id='spiritSkin' name='spiritBar' controls='spirit' left='50%' top='0%' width='25%' height='100%'/><progressBar id='spirit' value='100' text='spirit 100%' left='50%' customText='t' top='0%' width='25%' height='100%'/></dialogData>\n" +
	"<dialogData id='minivitals'><skin id='staminaSkin' name='staminaBar' controls='stamina' left='25%' top='0%' width='25%' height='100%'/><progressBar id='stamina' value='100' text='fatigue 100%' left='25%' customText='t' top='0%' width='25%' height='100%'/></dialogData>\n" +
	"<dialogData id='minivitals'><progressBar id='concentration' value='100' text='concentration 100%' left='75%' customText='t' top='0%' width='25%' height='100%'/></dialogData>\n" +
	"<openDialog type='dynamic' id='befriend' title='Friends &amp;&amp; Enemies' location='right' target='befriend' height='165' resident='true'><dialogData id='befriend'></dialogData></openDialog>\n" +
	"<dialogData id='befriend' clear='t'></dialogData>\n" +
	"<dialogData id='befriend'><label id='nofriends' align='n' value='No friends added'/></dialogData>\n" +
	"<streamWindow id='familiar' title='Familiar' location='center' resident='true' styleIfClosed='watching'/>\n" +
	"<streamWindow id='thoughts' title='Thoughts' location='center' resident='true' styleIfClosed='thought' timestamp='on'/>\n" +
	"<streamWindow id='logons' title='Arrivals' location='left' resident='true' nameFilterOption='true' timestamp='on'/>\n" +
	"<streamWindow id='death' title='Deaths' location='left' resident='true' nameFilterOption='true' timestamp='on'/>\n" +
	"<streamWindow id='assess' title='Assess' location='right' resident='true'/>\n" +
	"<streamWindow id='conversation' title='Conversation' location='center' resident='true' ifClosed='' timestamp='on'/>\n" +
	"<streamWindow id='whispers' title='Whispers' location='center' resident='true' timestamp='on' ifClosed='conversation'/>\n" +
	"<streamWindow id='talk' title='Talk' location='center' resident='true' timestamp='on' ifClosed='conversation'/>\n" +
	"<streamWindow id='experience' title='Field Experience' location='center' target='drop' ifClosed='' resident='true'/><clearStream id='experience'/><pushStream id='experience'/><output class='mono'/>\n" +
	"<compDef id='exp Shield Usage'></compDef>\n" +
	"<compDef id='exp Light Armor'></compDef>\n" +
	"<compDef id='exp Chain Armor'></compDef>\n" +
	"<compDef id='exp Brigandine'></compDef>\n" +
	"<compDef id='exp Plate Armor'></compDef>\n" +
	"<compDef id='exp Defending'></compDef>\n" +
	"<compDef id='exp Parry Ability'></compDef>\n" +
	"<compDef id='exp Small Edged'></compDef>\n" +
	"<compDef id='exp Large Edged'></compDef>\n" +
	"<compDef id='exp Twohanded Edged'></compDef>\n" +
	"<compDef id='exp Small Blunt'></compDef>\n" +
	"<compDef id='exp Large Blunt'></compDef>\n" +
	"<compDef id='exp Twohanded Blunt'></compDef>\n" +
	"<compDef id='exp Slings'></compDef>\n" +
	"<compDef id='exp Bow'></compDef>\n" +
	"<compDef id='exp Crossbow'></compDef>\n" +
	"<compDef id='exp Staves'></compDef>\n" +
	"<compDef id='exp Polearms'></compDef>\n" +
	"<compDef id='exp Light Thrown'></compDef>\n" +
	"<compDef id='exp Heavy Thrown'></compDef>\n" +
	"<compDef id='exp Brawling'></compDef>\n" +
	"<compDef id='exp Offhand Weapon'></compDef>\n" +
	"<compDef id='exp Melee Mastery'></compDef>\n" +
	"<compDef id='exp Missile Mastery'></compDef>\n" +
	"<compDef id='exp Inner Magic'></compDef>\n" +
	"<compDef id='exp Attunement'></compDef>\n" +
	"<compDef id='exp Arcana'></compDef>\n" +
	"<compDef id='exp Targeted Magic'></compDef>\n" +
	"<compDef id='exp Augmentation'></compDef>\n" +
	"<compDef id='exp Debilitation'></compDef>\n" +
	"<compDef id='exp Utility'></compDef>\n" +
	"<compDef id='exp Warding'></compDef>\n" +
	"<compDef id='exp Sorcery'></compDef>\n" +
	"<compDef id='exp Evasion'></compDef>\n" +
	"<compDef id='exp Athletics'></compDef>\n" +
	"<compDef id='exp Perception'></compDef>\n" +
	"<compDef id='exp Stealth'></compDef>\n" +
	"<compDef id='exp Locksmithing'></compDef>\n" +
	"<compDef id='exp Thievery'></compDef>\n" +
	"<compDef id='exp First Aid'></compDef>\n" +
	"<compDef id='exp Outdoorsmanship'></compDef>\n" +
	"<compDef id='exp Skinning'></compDef>\n" +
	"<compDef id='exp Forging'></compDef>\n" +
	"<compDef id='exp Engineering'></compDef>\n" +
	"<compDef id='exp Outfitting'></compDef>\n" +
	"<compDef id='exp Alchemy'></compDef>\n" +
	"<compDef id='exp Enchanting'></compDef>\n" +
	"<compDef id='exp Scholarship'></compDef>\n" +
	"<compDef id='exp Mechanical Lore'></compDef>\n" +
	"<compDef id='exp Appraisal'></compDef>\n" +
	"<compDef id='exp Performance'></compDef>\n" +
	"<compDef id='exp Tactics'></compDef>\n" +
	"<compDef id='exp mindstate'></compDef>\n" +
	"<output class=''/>\n" +
	"<popStream id='experience'/>\n" +
	"<component id='exp Shield Usage'></component>\n" +
	"<component id='exp Light Armor'></component>\n" +
	"<component id='exp Chain Armor'></component>\n" +
	"<component id='exp Brigandine'></component>\n" +
	"<component id='exp Plate Armor'></component>\n" +
	"<component id='exp Defending'></component>\n" +
	"<component id='exp Parry Ability'></component>\n" +
	"<component id='exp Small Edged'></component>\n" +
	"<component id='exp Large Edged'></component>\n" +
	"<component id='exp Twohanded Edged'></component>\n" +
	"<component id='exp Small Blunt'></component>\n" +
	"<component id='exp Large Blunt'></component>\n" +
	"<component id='exp Twohanded Blunt'></component>\n" +
	"<component id='exp Slings'></component>\n" +
	"<component id='exp Bow'></component>\n" +
	"<component id='exp Crossbow'></component>\n" +
	"<component id='exp Staves'></component>\n" +
	"<component id='exp Polearms'></component>\n" +
	"<component id='exp Light Thrown'></component>\n" +
	"<component id='exp Heavy Thrown'></component>\n" +
	"<component id='exp Brawling'></component>\n" +
	"<component id='exp Offhand Weapon'></component>\n" +
	"<component id='exp Melee Mastery'></component>\n" +
	"<component id='exp Missile Mastery'></component>\n" +
	"<component id='exp Inner Fire'></component>\n" +
	"<component id='exp Attunement'></component>\n" +
	"<component id='exp Arcana'></component>\n" +
	"<component id='exp Targeted Magic'></component>\n" +
	"<component id='exp Augmentation'></component>\n" +
	"<component id='exp Debilitation'></component>\n" +
	"<component id='exp Utility'></component>\n" +
	"<component id='exp Warding'></component>\n" +
	"<component id='exp Sorcery'></component>\n" +
	"<component id='exp Evasion'></component>\n" +
	"<component id='exp Athletics'></component>\n" +
	"<component id='exp Perception'></component>\n" +
	"<component id='exp Stealth'></component>\n" +
	"<component id='exp Locksmithing'></component>\n" +
	"<component id='exp Thievery'></component>\n" +
	"<component id='exp First Aid'></component>\n" +
	"<component id='exp Outdoorsmanship'></component>\n" +
	"<component id='exp Skinning'></component>\n" +
	"<component id='exp Forging'></component>\n" +
	"<component id='exp Engineering'></component>\n" +
	"<component id='exp Outfitting'></component>\n" +
	"<component id='exp Alchemy'></component>\n" +
	"<component id='exp Enchanting'></component>\n" +
	"<component id='exp Scholarship'></component>\n" +
	"<component id='exp Mechanical Lore'></component>\n" +
	"<component id='exp Appraisal'></component>\n" +
	"<component id='exp Performance'></component>\n" +
	"<component id='exp Tactics'></component>\n" +
	"<streamWindow id='group' title='Group' location='center' resident='true' ifClosed='' />\n" +
	"<streamWindow id='atmospherics' title='Atmospherics' location='center' resident='true' timestamp='on' ifClosed='main'/>\n" +
	"<streamWindow id='ooc' title='OOC' location='center' resident='true' timestamp='on' ifClosed=''/>\n" +
	"<streamWindow id='percWindow' title='Active Spells' location='center' save='true' ifClosed='' resident='true' />\n" +
	"<streamWindow id='chatter' title='Chatter' location='center' resident='true' timestamp='on' ifClosed='thoughts'/>\n" +
	"<openDialog id='quick-simu' location='quickBar' title='Information'><dialogData id='quick-simu' clear='true'><link id='1' value='Game Info' cmd='url:/dr/info/' /><link id='2' value='Calendar' cmd='url:/bounce/redirect.asp?URL=http://forums.play.net/calendar?game=dragonrealms' /><link id='3' value='Forums' cmd='bbs' echo='bbs' /><link id='4' value='News' cmd='news' echo='news' /><link id='5' value='Policy' cmd='policy' echo='policy' /><link id='6' value='Premium' cmd='url:/dr/premium/' /><link id='7' value='Platinum' cmd='url:/dr/platinum/' /><link id='8' value='SimuCon' cmd='url:/bounce/redirect.asp?URL=http://www.simucon.com' /><link id='9' value='Box Office' cmd='url:/dr/boxoffice.asp' /><link id='10' value='Vote for DR!' cmd='url:/bounce/redirect.asp?URL=http://www.topmudsites.com/vote-DragonRealms.html' /><link id='11' value='Elanthipedia' cmd='url:/bounce/redirect.asp?URL=https://elanthipedia.play.net/mediawiki/index.php/Main_Page' /><link id='12' value='Simucoins Store' cmd='url:/bounce/redirect.asp?URL=https://store.play.net/store/purchase/dr' /></dialogData></openDialog>\n" +
	"<openDialog id='quick-char' location='quickBar' title='Character'><dialogData id='quick-char' clear='true'><link id='1' value='Info' cmd='info' echo='info' /><link id='2' value='Exp' cmd='exp' echo='exp' /><link id='3' value='Store' cmd='store window' echo='store window' /><link id='4' value='Look [self]' cmd='look Mallakay' echo='look Mallakay' /><link id='5' value='Look' cmd='look' echo='look' /><link id='6' value='Profile' cmd='profile /edit' echo='profile /edit' /><link id='9' value='Health' cmd='health' echo='health' /><link id='10' value='Wealth' cmd='wealth' echo='wealth' /><link id='11' value='Vote for DR!' cmd='url:/bounce/redirect.asp?URL=http://www.topmudsites.com/vote-DragonRealms.html' /></dialogData></openDialog>\n" +
	"<openDialog id='quick-blank' location='quickBar' title='Blank'><dialogData id='quick-blank' clear='true'></dialogData></openDialog>\n" +
	"<switchQuickBar id='quick-char'/>\n" +
	"<indicator id='IconKNEELING' visible='n'/><indicator id='IconPRONE' visible='n'/><indicator id='IconSITTING' visible='n'/><indicator id='IconSTANDING' visible='y'/><indicator id='IconSTUNNED' visible='n'/><indicator id='IconHIDDEN' visible='y'/><indicator id='IconINVISIBLE' visible='n'/><indicator id='IconDEAD' visible='n'/><indicator id='IconWEBBED' visible='n'/><indicator id='IconJOINED' visible='n'/>\n" +
	"<spell>None</spell>\n" +
	"<left>Empty</left><right exist='13926057' noun='stick'>wooden stick</right>\n" +
	"<endSetup/>";
}
function getTemplateClearStreamPushStreamDialogData() {
	return "<clearStream id='inv' ifClosed=''/><pushStream id='inv'/>Your worn items are:\n" +
		"a lumpy bundle\n" +
		"a simple iron belt knife\n" +
		"a chain helm\n" +
		"some gloves\n" +
		"a target shield\n" +
		"a branch-framed canvas backpack\n" +
		"a divine charm\n" +
		"a leather sheath\n" +
		"some leather greaves\n" +
		"a leather coat\n" +
		"a scale aventail\n" +
		"an iron-banded parry stick with brown leather straps\n" +
		"<popStream/>\n" +
		"<dialogData id='minivitals'>" +
		"<skin id='healthSkin' name='healthBar' controls='health' left='0%' top='0%' width='25%' height='100%'/>" +
		"<progressBar id='health' value='100' text='health 100%' left='0%' customText='t' top='0%' width='25%' height='100%'/>" +
		"</dialogData>\n" +
		"<dialogData id='minivitals'><skin id='staminaSkin' name='staminaBar' controls='stamina' left='25%' top='0%' width='25%' height='100%'/><progressBar id='stamina' value='100' text='fatigue 100%' left='25%' customText='t' top='0%' width='25%' height='100%'/></dialogData>\n"
}
function getTemplateOutput() {
	return '<output class="mono"/>\n' +
	"<pushBold/>    *************************IMPORTANT!*************************    \n" +
	"<popBold/>        Closing the StormFront front end does NOT necessarily\n" +
	"drop your character from the game!  Type QUIT or EXIT!\n" +
	"<pushBold/>    *************************IMPORTANT!*************************\n" +
	"<popBold/>     PvP has strict rules!  See NEWS 5 15, NEWS 5 24, NEWS 5 25!\n" +
	"Scripting is ok, but you must be responsive!  NEWS 5 17!\n" +
	"Vulgarity is not allowed in public!  NEWS 5 7!\n" +
	"<pushBold/>    *************************IMPORTANT!*************************\n" +
	"<popBold/>\n" +
	"Enjoy DragonRealms?  Vote Today!\n" +
	"<a href='http://www.topmudsites.com/vote-DragonRealms.html'>Visit Top Mud Sites!</a>\n" +
	"<a href='https://drwiki.play.net'>Elanthipedia</a>           <a href='http://www.olwydd.org'>Olwydd's</a>               <a href='https://drwiki.play.net/mediawiki/index.php/Ranik_Maps'>Maps</a>\n" +
	"<d>ADVICE</d>.........A collection of HELP articles to get you started.\n" +
	"<d>HELP</d>...........Covers a variety of starter (and advanced) topics for the game.\n" +
	"<d>CHATTER</d>........Allows global communication with Mentors and others to get assistance.\n" +
	"<d>NEWS</d>...........Covers game updates, policies, events and more!\n" +
	"<d>EMAIL</d>..........Contact info for various Simutronics departments.\n" +
	"<d>VERB</d>...........A comprehensive list of most of our verbs!\n" +
	"<d>DIR</d>............Get directions to guilds, stat training, the bank, and more!\n" +
	"- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n" +
	'<output class=""/>';
}
function debug() {
	var template = "<component id='room desc'>The stone town walls seal off the city from the wilds beyond to the north.  Still, the scents of damp earth and leaf mold, pine and cedar, and feral creatures drift over the barricade.  Directly to the east, within spitting distance, is the Northeast town gate.  Through the gap in the wall, you can make out the low rise of the slate hills to the northwest and the lone, aloof tower of the Warrior Mages' Guild to the east.</component>\n" +
		"<component id='room objs'></component>\n" +
		"<component id='room players'></component>\n" +
		"<component id='room exits'>Obvious paths: <d>east</d>, <d>south</d>, <d>west</d>.<compass></compass></component>\n" +
		"<component id='room extra'></component>\n" +
		"<output class='mono'/>\n" +
		"----------------------------------------------------------------------------\n" +
		"Last login :  Wednesday, September 7, 2016 at 19:20:56\n" +
		"Logoff :  Wednesday, September 7, 2016 at 19:21:02\n" +
		"----------------------------------------------------------------------------\n" +
		"<output class=''/>\n" +
		"<resource picture='0'/><style id='roomName' />[The Crossing, Firulf Vista]\n" +
		"<style id=''/><preset id='roomDesc'>The stone town walls seal off the city from the wilds beyond to the north.  Still, the scents of damp earth and leaf mold, pine and cedar, and feral creatures drift over the barricade.  Through the gap in the wall, you can make out the low rise of the slate hills to the northwest and the lone, aloof tower of the Warrior Mages' Guild to the east.</preset>\n" +
		"Obvious paths: <d>east</d>, <d>south</d>, <d>west</d>.\n" +
		"<compass><dir value='e'/><dir value='s'/><dir value='w'/></compass>";

	console.log('-->', parseGameMessage(template));
}
debug();
