var net = require('net');
var Buffer = require('buffer').Buffer;

var CONNECT = 'connect';
var HANDSHAKE = 'handshake';
var AUTHENTICATE = 'authenticate';
var REQUEST_GAMES = 'requestGames';
var SELECT_GAME = 'selectGame';
var REQUEST_ACCOUNT = 'requestAccount';
var REQUEST_GAME_META = 'requestGameMeta';
var REQUEST_GAME_COSTS = 'requestGameCosts';
var REQUEST_CHARACTERS = 'requestCharacters';
var SELECT_CHARACTER = 'selectCharacter';
var DISCONNECT = 'disconnect';
var state = CONNECT;

var HOST = 'eaccess.play.net';
var PORT = 7900;

var game = process.argv[2] || 'DR';
var username = process.argv[3];
var password = process.argv[4];
var character = process.argv[5];

var isMissingArguments = false;
if (!username) {
	console.log('Missing argument - Username!');
	isMissingArguments = true;
}
if (!password) {
	console.log('Missing argument - Password!');
	isMissingArguments = true;
}
if (!character) {
	console.log('Missing argument - Character!');
	isMissingArguments = true;
}

if (isMissingArguments) {
	process.exit();
}

var authServer = null;
var config = null;

function connect () {
	if (state === CONNECT) {
		authServer = new net.Socket();
		authServer.on('data', _handleResponse);
		authServer.connect(PORT, HOST, _handleResponse);
	}
}

function _handleResponse(data) {
	switch (state) {
		case CONNECT: _handleConnection(); break;
		case HANDSHAKE: _handleHandshake(data); break;
		case AUTHENTICATE: _handleAuthenticate(data); break;
		case REQUEST_GAMES: _handleRequestGames(data); break;
		case SELECT_GAME: _handleSelectGame(data); break;
		case REQUEST_ACCOUNT: _handleRequestAccount(data); break;
		case REQUEST_GAME_META: _handleRequestGameMeta(data); break;
		case REQUEST_GAME_COSTS: _handleRequestGameCosts(data); break;
		case REQUEST_CHARACTERS: _handleRequestCharacters(data); break;
		case SELECT_CHARACTER: _handleSelectCharacter(data); break;
		default: _handleDisconnect(data); break;
	}
}

function _handleConnection() {
	console.log('CONNECTED:', HOST + ':' + PORT);
	state = HANDSHAKE;

	authServer.write('K\n');
}

function _handleHandshake(data) {
	console.log('HANDSHAKED:', data.toString().trim());
	state = AUTHENTICATE;

	authServer.write('A\t' + username + '\t');
	authServer.write(maskPassword(password, data));
	authServer.write('\n');
}

function _handleAuthenticate(data) {
	console.log('AUTHENTICATED:', data.toString().trim());
	var message = data.toString();
	if (message.indexOf('\tKEY\t') < 0) {
		state = DISCONNECT;

		_handleResponse();
	} else {
		state = REQUEST_GAMES;
		var key = message.split('\t')[3];

		authServer.write('M\n');
	}
}

function _handleRequestGames(data) {
	console.log('REQUESTED GAMES:', data.toString().trim());
	state = SELECT_GAME;

	authServer.write('N\tDR\n');
}

function _handleSelectGame(data) {
	console.log('SELECTED GAME:', data.toString().trim());
	state = REQUEST_ACCOUNT;

	authServer.write('F\t' + game + '\n');
}

function _handleRequestAccount(data) {
	console.log('REQUESTED ACCOUNT:', data.toString().trim());
	var message = data.toString();
	var status = message.split('\t')[1];
	if (status === 'EXPIRED') {
		state = DISCONNECT;

		_handleResponse();
	} else {
		state = REQUEST_GAME_META;

		authServer.write('G\tDR\n');
	}
}

function _handleRequestGameMeta(data) {
	console.log('REQUESTED GAME META:', data.toString().trim());
	state = REQUEST_GAME_COSTS;

	authServer.write('P\tDR\n');
}

function _handleRequestGameCosts(data) {
	console.log('REQUESTED GAME COSTS:', data.toString().trim());
	state = REQUEST_CHARACTERS;

	authServer.write('C\n');
}

function _handleRequestCharacters(data) {
	console.log('REQUESTED CHARACTERS:', data.toString().trim());
	state = SELECT_CHARACTER;

	var characters = _parseCharacters(data);

	authServer.write('L\t' + characters[character.toLowerCase()] + '\tSTORM\n');
}

function _parseCharacters(data){
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
}

function _handleSelectCharacter(data) {
	console.log('SELECTED CHARACTER:', data.toString().trim());
	state = DISCONNECT;

	config = _parseCharacterConfig(data);
	/*
	 { KEY: '2df5559e2d478d19e79bce8209b84330',
	 GAMEPORT: '11024',
	 GAMEHOST: 'dr.simutronics.net',
	 GAMEFILE: 'STORMFRONT.EXE',
	 FULLGAMENAME: 'StormFront',
	 GAMECODE: 'DR',
	 GAME: 'STORM',
	 UPPORT: '5535' }
	 */

	_handleResponse(true);
}

function _parseCharacterConfig(data) {
	var values = data.toString().trim().split('\t').reverse();

	var config = {};
	values.forEach(function (pair){
		var parts = pair.split('=');
		if (parts.length === 2) {
			config[parts[0]] = parts[1];
		}
	});

	return config;
}

function _handleDisconnect(data) {
	console.log('CONNECTION ' + (data?'SUCCESSFUL!':'FAILED!'));

	authServer.end();
}

function maskPassword(password, mask) {
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
}

connect();

