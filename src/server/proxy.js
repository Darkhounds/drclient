function createServer() {
	var WebSocketServer = require('ws').Server;
	var wss = new WebSocketServer({ port: 3010 });
	wss.on('connection', function connection(socket) {
		createClient(socket);
	});

	function createClient(socket) {
		var client = {
			connected: false,
			connecting: false,
			socket: null,
			websocket: socket
		};

		socket.on('message', function (data) {
			data = JSON.parse(data);

			if (data.action === 'authenticate') {
				_authenticate(client, data);
			} else if (!client.connected) {
				client.websocket.send({error: 'alreadyConnecting'});
			} else {
				client.socket.write(data.message + '\n');
			}
		});
	}
}
createServer();

var PORT = 7900;
var HOST = 'eaccess.play.net';
var parseCharacterConfig = require('./utils/parse-characters-config');
var parseCharacters = require('./utils/parse-characters');
var maskPassword = require('./utils/mask-password');
var connectionState = require('./constants/connection-state');
var net = require('net');
function _authenticate(client, requestData) {
	var authServer = null;
	var state = connectionState.CONNECT;

	if (client.connecting) {
		client.websocket.send({error: 'alreadyConnecting'});
	} else if (client.connected) {
		client.websocket.send({error: 'alreadyConnected'});
	} else if (!requestData.username) {
		client.websocket.send({error: 'missingUsername'});
	} else if (!requestData.password) {
		client.websocket.send({error: 'missingPassword'});
	} else if (!requestData.character) {
		client.websocket.send({error: 'missingCharacter'});
	} else {
		client.connecting = true;
		authServer = new net.Socket();
		authServer.on('data', _handleAuthResponse);
		authServer.connect(PORT, HOST, _handleAuthResponse);

		function _handleAuthResponse(data) {
			switch (state) {
				case connectionState.CONNECT: _handleConnection(); break;
				case connectionState.HANDSHAKE: _handleHandshake(data); break;
				case connectionState.AUTHENTICATE: _handleAuthenticate(data); break;
				case connectionState.SELECT_GAME: _handleSelectGame(); break;
				case connectionState.REQUEST_ACCOUNT: _handleRequestAccount(data); break;
				case connectionState.REQUEST_CHARACTERS: _handleRequestCharacters(data); break;
				case connectionState.SELECT_CHARACTER: _handleSelectCharacter(data); break;
				default: _handleDisconnect(data); break;
			}
		}

		function _handleConnection() {
			state = connectionState.HANDSHAKE;

			authServer.write('K\n');
		}

		function _handleHandshake(data) {
			state = connectionState.AUTHENTICATE;

			authServer.write('A\t' + requestData.username + '\t');
			authServer.write(maskPassword(requestData.password, data));
			authServer.write('\n');
		}

		function _handleAuthenticate(data) {
			var message = data.toString();
			if (message.indexOf('\tKEY\t') < 0) {
				state = connectionState.DISCONNECT;

				_handleAuthResponse('authenticationFailed');
			} else {
				state = connectionState.SELECT_GAME;

				authServer.write('G\tDR\n');
			}
		}

		function _handleSelectGame() {
			state = connectionState.REQUEST_ACCOUNT;

			authServer.write('B\n');
		}

		function _handleRequestAccount(data) {
			var message = data.toString();
			var status = message.split('\t')[1];
			if (status === 'EXPIRED') {
				state = connectionState.DISCONNECT;

				_handleAuthResponse('accountExpired');
			} else {
				state = connectionState.REQUEST_CHARACTERS;

				authServer.write('C\n');
			}
		}

		function _handleRequestCharacters(data) {
			state = connectionState.SELECT_CHARACTER;

			var characters = parseCharacters(data);

			authServer.write('L\t' + characters[requestData.character.toLowerCase()] + '\tSTORM\n');
		}

		function _handleSelectCharacter(data) {
			state = connectionState.DISCONNECT;

			client.config = parseCharacterConfig(data);

			_handleAuthResponse();
		}

		function _handleDisconnect(error) {
			if (error) {
				client.websocket.send({error: 'connectionFailed'});
			} else {
				_connect(client);
			}

			authServer.end();
		}

	}
}

function _connect(client) {
	var gameServer = new net.Socket();
	gameServer.on('data', _handleGameResponse);

	gameServer.connect(client.config.GAMEPORT, client.config.GAMEHOST, function () {
		gameServer.write(client.config.KEY + '\n');
		gameServer.write('/FE:WebFE /VERSION:0.2015.9.29.0 /P:WIN_XP  /XML' + '\n');
		//gameServer.write('/FE:STORMFRONT /VERSION:1.0.1.26 /P:OSX /XML' + '\n');
		//gameServer.write('/FE:WIZARD /VERSION:2.02 /P:WIN32' + '\n');
	});

	var gameMessage = '';
	var gameHandshake = 0;
	function _handleGameResponse(data) {
		if (gameHandshake < 3) {
			gameHandshake++;
		}

		if (gameHandshake === 2) {
			gameServer.write('\n\n');
			client.connecting = false;
			client.connected = true;
			client.socket = gameServer;
			client.websocket.send(JSON.stringify({action: 'authenticated'}));
		} else {
			gameMessage += data?data.toString():'';

			if (gameMessage.charAt(gameMessage.length - 1) === '\n') {
				gameMessage = gameMessage.trim();

				client.websocket.send(JSON.stringify({message: gameMessage.toString()}));

				gameMessage = '';
			}
		}
	}
}


