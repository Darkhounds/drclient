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
var username = process.argv[2];
var password = process.argv[3];

var client = null;

function connect () {
	if (state === CONNECT) {
		client = new net.Socket();
		client.on('data', _handleResponse);
		client.connect(PORT, HOST, _handleResponse);
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

	client.write('K\n');
}

function _handleHandshake(data) {
	console.log('HANDSHAKED:', data.toString().trim());
	state = AUTHENTICATE;

	client.write('A\t' + username + '\t');
	client.write(maskPassword(password, data));
	client.write('\n');
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

		client.write('M\n');
	}
}

function _handleRequestGames(data) {
	console.log('REQUESTED GAMES:', data.toString().trim());
	state = SELECT_GAME;

	client.write('N\tDR\n');
}

function _handleSelectGame(data) {
	console.log('SELECTED GAME:', data.toString().trim());
	state = REQUEST_ACCOUNT;

	client.write('F\tDR\n');
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

		client.write('G\tDR\n');
	}
}

function _handleRequestGameMeta(data) {
	console.log('REQUESTED GAME META:', data.toString().trim());
	state = REQUEST_GAME_COSTS;

	client.write('P\tDR\n');
}

function _handleRequestGameCosts(data) {
	console.log('REQUESTED GAME COSTS:', data.toString().trim());
	state = REQUEST_CHARACTERS;

	client.write('C\n');
}

function _handleRequestCharacters(data) {
	console.log('REQUESTED CHARACTERS:', data.toString().trim());
	state = SELECT_CHARACTER;

	client.write('L\tW_MALLAKAY_001\tSTORM\n');
}

function _handleSelectCharacter(data) {
	console.log('SELECTED CHARACTER:', data.toString().trim());
	state = DISCONNECT;

	_handleResponse(true);
}

function _handleDisconnect(data) {
	console.log('CONNECTION ' + (data?'SUCCESSFUL!':'FAILED!'));

	client.end();
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
