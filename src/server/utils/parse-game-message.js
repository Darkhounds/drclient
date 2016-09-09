var fs = require('fs');
var util = require('util');
var stripDoubleLineBreaks = require('./strip-double-lines');

var mainBuffer = '';
var mainBufferLevel = 0;
var bufferParsers = [];

function parseGameMessage(message) {
	var commands = [];
	var mainBufferLength;

	mainBuffer = stripDoubleLineBreaks(mainBuffer + message);
	mainBufferLength = mainBuffer.length;

	mainBuffer = parseBuffer(mainBuffer, commands);

	if (mainBuffer.length > 1) {
		console.log(mainBufferLevel, mainBuffer.length, mainBuffer.toString().substr(0, 50));
	}

	if (mainBuffer.length === mainBufferLength && ++mainBufferLevel > 5) {
		fs.appendFileSync('./logs/dump.xml', '\n' + mainBuffer + '\n================ DUMP END ================');
		parseGameMessage.flush();
	}

	return commands;
}
parseGameMessage.flush = function () {
	mainBuffer = '';
	mainBufferLevel = 0;
};

function parseBuffer(buffer, commands) {
	var oldBuffer = '';

	if (buffer.length > 2) {
		if (buffer.charAt(0) === '\n') {
			return parseBuffer(buffer.substr(1), commands);
		}

		for (var i = 0; i < bufferParsers.length; i++) {
			oldBuffer = '';

			while (buffer != oldBuffer) {
				oldBuffer = buffer;
				buffer = bufferParsers[i](buffer, commands);

				if (buffer !== oldBuffer) {
					return parseBuffer(buffer, commands);
				}
			}
		}
	}

	return buffer;
}

// ---- SYSTEM

// <settings client="1.0.1.26" major="1">...</settings>
var settingsPattern = /^<settings\s+client=(?:'|")([^<>]*)(?:'|")\s+major=(?:'|")([^<>]*)(?:'|")[^<>\/]*>([\s\S]*?)<\/settings>/;
function parseSettings (message, commands) {
	message = message.replace(settingsPattern, function (command, client, major, data) {
		commands.push(
			'<data group="system" type="settings"' +
			' client="' +  client + '"' +
			' major="' +  major + '"' +
			' >' + data + '</data>'
		);
		return '';
	});

	return message;
}
bufferParsers.push(parseSettings);

// <app>...<endSetup>
var appPattern = /^<app\s+char=(?:'|")([^'"]*)(?:'|")\s+game=(?:'|")([^'"]*)(?:'|")\s+title=(?:'|")([^'"]*)(?:'|")[^<>\/]*\/>([\s\S]*?)<endSetup\/>/;
function parseApp (message, commands) {
	message = message.replace(appPattern, function (command, char, game, title, data) {
		commands.push(
			'<data group="system" type="config"' +
			' char="' +  char + '"' +
			' game="' +  game + '"' +
			' title="' +  title + '"' +
			' >' + data + '</data>'
		);
		return '';
	});

	return message;
}
bufferParsers.push(parseApp);

// ---- UI

// TODO: Handle N properties if required in the future
//<resource picture="0"/>
var resourcePattern = /^<resource\s+([\w]*)=(?:'|")([^'"<>\/]*)(?:'|")\/>/;
function parseResource (message, commands) {
	message = message.replace(resourcePattern, function (command, property, value) {
		commands.push(
			'<data group="ui" type="resource"' +
			' ' + property + '="' + value + '"' +
			'>' + '</data>'
		);
		return '';
	});

	return message;
}
bufferParsers.push(parseResource);

// <prompt time="1473330491">&gt;</prompt>
var promptPattern = /^<prompt\s+time=(?:'|")([^<>]*)(?:'|")[^<>\/]*>([\s\S]*?)<\/prompt>/;
function parsePrompt (message, commands) {
	message = message.replace(promptPattern, function (command, time, data) {
		commands.push(
			'<data group="ui" type="prompt"' +
			' time="' +  time + '"' +
			' >' + data + '</data>'
		);
		return '';
	});

	return message;
}
bufferParsers.push(parsePrompt);

// TODO: Handle N properties as not all windows share the same attributes
// <streamWindow id='room' title='Room' subtitle=" - [The Crossing, Herald Street]" location='center' target='drop' ifClosed='' resident='true'/>
var windowPattern = /^<streamWindow\s+id=(?:'|")([^'"<>]*)(?:'|")\s+title=(?:'|")([^'"<>]*)(?:'|")\s+subtitle=(?:'|")([^'"<>]*)(?:'|")\s*[^<>\/]*\/>/;
function parseWindow (message, commands) {
	message = message.replace(windowPattern, function (command, id, title, subtitle) {
		commands.push(
			'<data group="ui" type="window"' +
			' id="' +  id + '"' +
			' title="' +  title + '"' +
			' subtitle="' +  subtitle + '"' +
			' />'
		);
		return '';
	});

	return message;
}
bufferParsers.push(parseWindow);

// <dialogData id='minivitals'><progressBar id='concentration' value='100' text='concentration 100%' left='75%' customText='t' top='0%' width='25%' height='100%'/></dialogData>
var dialogDataPattern = /^<dialogData\s+id=(?:'|")([^<>]*)(?:'|")\s*[^<>\/]*>([\s\S]*)<\/dialogData>/;
function parseDialogData (message, commands) {
	message = message.replace(dialogDataPattern, function (command, id, data) {
		commands.push(
			'<data group="ui" type="dialog"' +
			' id="' +  id + '"' +
			' >' + data + '</data>'
		);
		return '';
	});

	return message;
}
bufferParsers.push(parseDialogData);

// <component id='room desc'>...</component>
var componentPattern = /^<component\s+id=(?:'|")([^<>]*)(?:'|")[^<>\/]*>([\s\S]*?)<\/component>/;
function parseComponent (message, commands) {
	message = message.replace(componentPattern, function (command, id, data) {
		commands.push(
			'<data group="ui" type="component"' +
			' id="' +  id + '"' +
			' >' + data + '</data>'
		);
		return '';
	});

	return message;
}
bufferParsers.push(parseComponent);

// <compass><dir value="e"/><dir value="s"/><dir value="w"/></compass>
var compassPattern = /^<compass[^<>\/]*>([\s\S]*?)<\/compass>/;
function parseCompass (message, commands) {
	message = message.replace(compassPattern, function (command, data) {
		commands.push(
			'<data group="ui" id="compass">' + data + '</data>'
		);
		return '';
	});

	return message;
}
bufferParsers.push(parseCompass);

// <roundTime value='1473330497'/>
var roundtimePattern = /^<roundTime(\s+value=(?:'|")([^'"]*)(?:'|"))?\/>/;
function parseRoundtime (message, commands) {
	message = message.replace(roundtimePattern, function (command, value) {
		commands.push(
			'<data group="ui" type="roundtime"' +
			' value="' +  value + '"' +
			' />'
		);
		return '';
	});

	return message;
}
bufferParsers.push(parseRoundtime);

//<indicator id='IconHIDDEN' visible='y'/>
var indicatorPattern = /^<indicator\s+id=(?:'|")([^'"]*)(?:'|")\s+visible=(?:'|")([^'"]*)(?:'|")\/>/;
function parseIndicator (message, commands) {
	message = message.replace(indicatorPattern, function (command, id, visible) {
		commands.push(
			'<data group="ui" type="indicator"' +
			' id="' +  id + '"' +
			' visible="' +  visible + '"' +
			' />'
		);
		return '';
	});

	return message;
}
bufferParsers.push(parseIndicator);

// ---- GAME

// <style id="roomName" />...<style id=""/>
var stylePattern = /^<style\s+id=(?:'|")([^<>]*)(?:'|")[^<>\/]*\/>([\s\S]*?)<style id=(?:''|"")\/>/;
function parseStyle (message, commands) {
	message = message.replace(stylePattern, function (command, id, data) {
		commands.push(
			'<data group="game" type="style"' +
			' id="' +  id + '"' +
			' >' + data + '</data>'
		);
		return '';
	});

	return message;
}
bufferParsers.push(parseStyle);

// <preset id='roomDesc'>This quaint alley connects Magen Road to the south and Firulf Vista to the north.  An ornately carved building with an ancient wooden door is set back from the curb.</preset>
var presetPattern = /^<preset\s+id=(?:'|")([^<>]*)(?:'|")[^<>\/]*>([\s\S]*?)<\/preset>/;
function parsePreset (message, commands) {
	message = message.replace(presetPattern, function (command, id, data) {
		commands.push(
			'<data group="game" type="preset"' +
			' id="' +  id + '"' +
			' >' + data + '</data>'
		);
		return '';
	});

	return message;
}
bufferParsers.push(parsePreset);

// <pushStream id='inv'/>...<popStream id="asasd"/>
var pushStreamPattern = /^<pushStream\s*id=(?:'|")([\w]*)(?:'|")[^<>\/]*\/>([\s\S]*?)<popStream(?:\s+[^<>]*|\/)>/;
function parsePushStream (message, commands) {
	message = message.replace(pushStreamPattern, function (command, id, data) {
		commands.push(
			'<data group="game" type="stream" action="push"' +
			' id="' +  id + '"' +
			' >' + data + '</data>'
		);
		return '';
	});

	return message;
}
bufferParsers.push(parsePushStream);

//<clearStream id='inv' ifClosed=''/>
var clearStreamPattern = /^<clearStream\s+id=(?:'|")([^'"]*)(?:'|")[^<>\/]*\/>/;
function parseClearStream (message, commands) {
	message = message.replace(clearStreamPattern, function (command, id) {
		commands.push(
			'<data group="game" type="stream" action="clear"' +
			' id="' +  id + '"' +
			' />'
		);
		return '';
	});

	return message;
}
bufferParsers.push(parseClearStream);

// Obvious paths: <d>north</d>, <d>south</d>, <d>west</d>.
var obviousPattern = /^Obvious\s+([\w\s]*):(.*)\./;
function parseObvious (message, commands) {
	message = message.replace(obviousPattern, function (command, exitType, data) {
		commands.push(
			'<data group="game" type="obvious exits"' +
			' exit-type="' + exitType + '"' +
			' >' + data + '</data>'
		);
		return '';
	});

	return message;
}
bufferParsers.push(parseObvious);

// <output class="mono"/>...<output class=""/>
var outputPattern = /^<output\s+class=(?:'|")([^'"]*)(?:'|")[^<>\/]*\/>([\s\S]*?)<output\s+class=(?:''|"")\/>/;
function parseOutput (message, commands) {
	message = message.replace(outputPattern, function (command, className, data) {
		commands.push(
			'<data group="game" type="output"' +
			' id="' +  className + '"' +
			' >' + data + '</data>'
		);
		return '';
	});

	return message;
}
bufferParsers.push(parseOutput);

// <pushBold/>...<popBold/>
var boldPattern = /^<pushBold\/>([\s\S]*?)<popBold\/>/;
function parseBold (message, commands) {
	message = message.replace(boldPattern, function (command, data) {
		commands.push(
			'<data group="game" type="bold" action="push"' +
			' >' + data + '</data>'
		);
		return '';
	});

	return message;
}
bufferParsers.push(parseBold);

// Directions towards Northeast Customs: <d cmd="East">East</d>.
var directionsPattern = /^Directions\s+(?:towards)\s*([\w\s]*):(.*)\./;
function parseDirections (message, commands) {
	message = message.replace(directionsPattern, function (command, target, data) {
		commands.push(
			'<data group="game" type="directions"' +
			' target="' + target + '"' +
			' >' + data + '</data>'
		);
		return '';
	});

	return message;
}
bufferParsers.push(parseDirections);

//<nav/>
var navPattern = /^<nav\/>/;
function parseNav (message, commands) {
	message = message.replace(navPattern, function (command, value) {
		commands.push(
			'<data group="game" type="nav"/>'
		);
		return '';
	});

	return message;
}
bufferParsers.push(parseNav);

// some simple text<ignore-this>
var justTextPattern = /^[^<>\n]*/;
function parseJustText (message, commands) {
	message = message.replace(justTextPattern, function (data) {
		commands.push(
			'<data group="game" type="text"' +
			' >' + data + '</data>'
		);
		return '';
	});

	return message;
}
bufferParsers.push(parseJustText);

// ---- OTHER

// <data id="someValue">...</data>
var alreadyParsedPattern = /^(?:<data[^<>\/]*>([\s\S]*?)<\/data>)|(<data[^<>\/]*\/>)/;
function parseAlreadyParsed (message, commands) {
	message = message.replace(alreadyParsedPattern, function (command, tag, data) {
		return '';
	});

	return message;
}
bufferParsers.push(parseAlreadyParsed);

// ---- UNKNOWN

// <someTag id="someValue">...</someTag id='anotherValue' >
var unknownContentTagPattern = /^<([\w]+)[^<>]*[^\/]>([\s\S]*?)<\/\1[^<>\/]*>/;
function parseUnknownContentTag (message, commands) {
	message = message.replace(unknownContentTagPattern, function (command, tag, data) {
		commands.push(
			'<data group="unknown"' +
			' >' + command + '</data>'
		);
		return '';
	});

	return message;
}
bufferParsers.push(parseUnknownContentTag);

// <someTag />
var unknownSelfClosingTagPattern = /^<([\w]+)[^<>]*\/>/;
function parseUnknownSelfClosingTag (message, commands) {
	message = message.replace(unknownSelfClosingTagPattern, function (command, tag) {
		// var streams = ['settings', 'app', 'prompt', 'pushStream', 'component', 'compass', 'preset', 'style', 'output', 'pushBold']
		var streams = ['pushBold', 'output', 'style', 'pushStream', 'app'];
		if (streams.indexOf(tag) > -1) {
			return command;
		} else {
			commands.push(
				'<data group="unknown"' +
				' >' + command + '</data>'
			);
			return '';
		}
	});

	return message;
}
bufferParsers.push(parseUnknownSelfClosingTag);

module.exports = parseGameMessage;

function debug() {
	var raw = fs.readFile('./test/mocks/log.raw.txt', function (err, data) {
		fs.writeFileSync('./cache/log.parsed.xml', parseGameMessage(data));
	});
}
//debug();
