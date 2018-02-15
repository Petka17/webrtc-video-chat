'use strict';

var fs = require('fs');
var nodeStatic = require('node-static');
var https = require('https');
var socketIO = require('socket.io');

var fileServer = new nodeStatic.Server();
var fileMiddleware = fileServer.serve.bind(fileServer);

var serverOptions = {
  key: fs.readFileSync('server-key.pem'),
  cert: fs.readFileSync('server-cert.pem')
};

var app = https.createServer(
  serverOptions,
  fileMiddleware
)

var roomCallType = {}

var io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {

  socket.on('create or join', function(room) {
    var roomInfo = io.sockets.adapter.rooms[room] || {};
    var roomSockets = roomInfo.sockets || {};
    var numClients = Object.keys(roomSockets).length;

    if (numClients === 0) {
      socket.join(room);
      socket.emit('created', room, socket.id);
      roomCallType[room] = { [socket.id]: "caller"};
    } else if (numClients === 1) {
      socket.join(room);
      socket.broadcast.in(room).emit('message', 'ready');
      roomCallType[room][socket.id] = "callee";
    } else { 
      socket.emit('full', room);
    }
  });

  socket.on('message', function(message, room) {
    var fromRoom = roomCallType[room] || {};
    var from = fromRoom[socket.id] || socket.id;
    socket.broadcast.in(room).emit('message', message);
    console.log("get message from " + from + " in room " + room);
    console.log(message);
    console.log("----");
  });

  socket.on('bye', function(){
    console.log('received bye');
  });

});

app.listen(8080);

