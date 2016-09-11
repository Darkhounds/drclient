function Constructor() {
	var username = document.querySelector('#USERNAME');
	var password = document.querySelector('#PASSWORD');
	var character = document.querySelector('#CHARACTER');
	var login = document.querySelector('#LOGIN');
	var room = document.querySelector('#ROOM');
	var roomTitle = room.querySelector('.title');
	var roomDescription = room.querySelector('.description');
	var roomObjects = room.querySelector('.objects');
	var roomExtra = room.querySelector('.extra');
	var roomExists = room.querySelector('.exits');
	var alsohere = document.querySelector('#ALSO_HERE');
	var output = document.querySelector('#OUTPUT');
	var prompt = document.querySelector('#PROMPT');
	var send = document.querySelector('#SEND');

	var search = {};
	(window.location.search || '').substr(1).split('&').forEach(function (pair) {
		var parts = pair.split('=');
		if (parts.length === 2) {
			search[parts[0]] = parts[1];
		}
	});
	console.log(search);

	username.value = search.username || '';
	password.value = search.password || '';
	character.value = search.character || '';

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
		var data = JSON.parse(data);

		// console.log((data && data.message)?data.message.length:'', (data && data.message)?data.message.substr(0, 20):'');

		if (data.message && data.message.length > 2) {
			data.message.split('</data>\n').forEach(function (line) {
				parseLine(line + '</data>');
			});
		}
	}

	var dataParser = document.createElement('div');
	function parseLine(data) {
		dataParser.innerHTML = data;
		data = dataParser.querySelector('data');

		var dataGroup = data.getAttribute('group');
		var dataType = data.getAttribute('type');
		var dataId = data.getAttribute('id');

		var line = document.createElement('div');

		if (dataGroup === "game" && dataType === "text") {
			line.innerText = data.innerText;
			appendToOutput(line);
		} else if (dataGroup === "game" && dataId === "roomName") {
			line.innerText =  data.innerText;
			appendToOutput(line);
		} else if (dataGroup === "game" && dataId === "roomDesc") {
			line.innerText =  data.innerText;
			appendToOutput(line);
		} else if (dataGroup === "game" && dataType === "obvious exits") {
			var exitType = data.getAttribute('exit-type');
			line.innerText =  'Obvious ' + exitType + ': ' + data.innerText;
			appendToOutput(line);
		} else if (dataGroup === "game" && dataType === "bold") {
			line.innerHTML = '<b>' + data.innerText + '</b>';
			appendToOutput(line);
		} else if (dataGroup === "game" && dataType === "output") {
			line.innerHTML =  data.innerHTML
				.replace(/<pushbold>/ig, '<b>').replace(/<\/pushbold>/ig, '')
				.replace(/<popbold>/ig, '</b>').replace(/<\/popbold>/ig, '')
				.replace(/<d>/ig, '<i>').replace(/<\/d>/ig, '</i>')
				.replace(/\n/ig, '<br/>');
			appendToOutput(line);
		} else if (dataGroup === "game" && dataType === "directions") {
			line.innerHTML =  data.innerHTML
				.replace(/<pushbold>/ig, '<b>').replace(/<\/pushbold>/ig, '')
				.replace(/<popbold>/ig, '</b>').replace(/<\/popbold>/ig, '')
				.replace(/<d>/ig, '<i>').replace(/<\/d>/ig, '</i>')
				.replace(/\n/ig, '<br/>');
			appendToOutput(line);
		} else if (dataGroup === "ui" && dataType === "window" && dataId === "room") {
			roomTitle.innerHTML =  data.getAttribute("subtitle");
		} else if (dataGroup === "ui" && dataType === "component" && dataId === "room desc") {
			roomDescription.innerHTML =  data.innerHTML;
		} else if (dataGroup === "ui" && dataType === "component" && dataId === "room exits") {
			roomExists.innerHTML =  data.innerHTML;
		} else if (dataGroup === "ui" && dataType === "component" && dataId === "room extra") {
			roomExtra.innerHTML =  data.innerHTML;
		} else if (dataGroup === "ui" && dataType === "component" && dataId === "room objs") {
			roomObjects.innerHTML =  data.innerHTML;
		} else if (dataGroup === "ui" && dataType === "component" && dataId === "room players") {
			alsohere.innerHTML = '';
			data.innerText.substr(data.innerText.indexOf(':')+1).split(', ').forEach(function (player) {
				player.split('and ').forEach(function (player) {
					alsohere.innerHTML += '<div>' + player.trim() + '</div>';
				});
			});
		} else if (dataGroup === "ui" && dataType === "prompt") {

		} else {
			console.log('Ignored:', data);
		}
	}

	function appendToOutput(data) {
		if (data.innerHTML) {
			output.appendChild(data);
			setTimeout(function () {
				output.parentElement.scrollTop = output.parentElement.scrollHeight
			});
		}
	}
}

module.exports = Constructor;