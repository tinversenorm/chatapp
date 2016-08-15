var socketio = require("socket.io");
var io;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];
var currentRoom = {};

exports.listen = function(server) {
	io = new socketio(server); // piggybacks onto given http server

	io.on('connection', function(socket) {
		if(assignGuestName(socket, guestNumber, nickNames, namesUsed)) {
			guestNumber++;
		}
		joinRoom(socket, 'Lobby');

		handleMessageBroadcasting(socket, nickNames);
		handleNameChangeAttempts(socket, nickNames, namesUsed);
		handleRoomJoining(socket);

		socket.on('rooms', function() {
			socket.emit('rooms', io.of('/').adapter.rooms);
		});

		handleClientDisconnection(socket, nickNames, namesUsed);
	});
};

function assignGuestName(socket, guestNumber, nickNames, namesUsed) {
	var name = 'Guest' + guestNumber;
	nickNames[socket.id] = name;
	socket.emit('nameResult', {
		success: true,
		name: name
	});
	namesUsed.push(name);
	return true;
}

function joinRoom(socket, room) {
	socket.join(room);
	currentRoom[socket.id] = room;
	socket.emit('joinResult', {room:room});
	socket.to(room).emit('message', {
		text: nickNames[socket.id] + ' has joined ' + room + '.'
	});

	var usersInRoom = io.of('/').in(room).clients;
	
	var usersSummary = 'Users currently in ' + room + ': ';
	for(var index in usersInRoom) {
		var userSocketId = usersInRoom[index].id;
		if(userSocketId != socket.id) {
			if(index > 0) {
				usersSummary += ', ';
			}
			usersSummary += nickNames[userSocketId];
		}
	}
	usersSummary += '.';
	socket.emit('message', {text: usersSummary});
}

function handleNameChangeAttempts(socket, nickNames, namesUsed) {
	socket.on('nameAttempt', function(name) {
		if(name.indexOf('Guest') == 0) {
			socket.emit('nameResult', {
				success : false,
				message : 'Names cannot begin with Guest'
			});
		} else {
			if(namesUsed.indexOf(name) == -1) {
				var previousName = nickNames[socket.id];
				var previousNameIndex = namesUsed.indexOf(previousName);
				namesUsed.push(name);
				nickNames[socket.id] = name;
				delete namesUsed[previousNameIndex];
				socket.emit('nameResult', {
					success : true,
					name : name
				});
				socket.to(currentRoom[socket.id]).emit('message', {
					text: previousName + 'is now known as ' + name + '.'
				});
			}cd
		}
	});
}

function handleMessageBroadcasting(socket) {
	socket.on('message', function(message) {
		socket.to(message.room).emit('message', {
			text: nickNames[socket.id] + ': ' + message.text
		});
	});
}

function handleRoomJoining(socket) {
	socket.on('join', function(room) {
		socket.leave(currentRoom[socket.id]);
		joinRoom(socket, room.newRoom);
	});
}

function handleClientDisconnection(socket) {
	socket.on('disconnect', function() {
		var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
		delete namesUsed[nameIndex];
		delete nickNames[socket.id];
	});
}