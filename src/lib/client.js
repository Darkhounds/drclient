var username = document.querySelector('#USERNAME');
var password = document.querySelector('#PASSWORD');
var character = document.querySelector('#CHARACTER');
var login = document.querySelector('#LOGIN');
var room = document.querySelector('#ROOM');
var alsohere = document.querySelector('#ALSO_HERE');
var output = document.querySelector('#OUTPUT');
var prompt = document.querySelector('#PROMPT');
var send = document.querySelector('#SEND');

login.addEventListener('click', function () {
	authenticate(username.value, password.value, character.value);
});

send.addEventListener('click', function () {
	sendMessage();
});

prompt.addEventListener('keyup', function (e) {
	var code = (e.keyCode ? e.keyCode : e.which);
	if (code === 13) {
		sendMessage();
	}
});

var socket = null;
function authenticate(username, password, character) {
	socket = new WebSocket("ws://localhost:3010");
	socket.onerror = function (error) {
		console.log(error);
	};

	socket.onopen = function () {
		socket.send(JSON.stringify({
			action: 'authenticate',
			username: username,
			password: password,
			character: character
		}));
	};

	socket.onmessage = function (event) {
		recieveMessage(event.data);
	};
}

function sendMessage() {
	var message = prompt.value;
	prompt.value = '';

	socket.send(JSON.stringify({
		message: message
	}));
}

function recieveMessage(data) {
	var element = null;
	var data = JSON.parse(data);
	data = data.message?data.message.trim():'';

	if (!data || !data.length) {

	} else if (data.substr(0, 9) === '<resource') {
		var parts = data.split('\r\n');

		var roomName = parts[0].match(/\[(.*)\]/i);
		var roomDesc = parts[1].match(/<preset id='roomDesc'>(.*)<\/preset>/i);
		var alsoSee = parts[1].match(/<\/preset>(.*)/i);
		var obvious = parts[2].replace('<d>', '<span>').replace('</d>', '</span>');

		room.innerHTML = '<div id="ROOM_NAME">' + (roomName?roomName[0]:'') + '</div>';
		room.innerHTML += '<div id="ROOM_DESCRIPTION">' + (roomDesc?roomDesc[0]:'') + '</div>';
		room.innerHTML += '<div id="ROOM_ALSO_SEE">' + (alsoSee?alsoSee[0]:'') + '</div>';
		room.innerHTML += '<div id="ROOM_OBVIOUS">' + obvious + '</div>';

	} else if (data[0] !== '<') {
		element = document.createElement('div');
		element.innerHTML = data.split('\r\n')[0].split('\n')[0];
		output.appendChild(element);
		output.parentElement.scrollTop = output.parentElement.scrollHeight;
	}

	// var lines = [];
	// data.split('\r\n').forEach(function (part) {
	// 	part.split('\n').forEach(function (part) {
	// 		lines.push(part);
	// 	});
	// });
	//
	// lines.forEach(function (line) {
	// 	if (line && line.length && line[0] !== '<') {
	// 		var element = document.createElement('div');
	//
	// 		element.innerHTML = line;
	// 		output.appendChild(element);
	// 		output.parentElement.scrollTop = output.parentElement.scrollHeight;
	// 	} else {
	// 		var element = document.createElement('div');
	//
	//
	//
	//
	// 		element.innerHTML = line;
	// 		console.log(element);
	// 	}
	// });
}