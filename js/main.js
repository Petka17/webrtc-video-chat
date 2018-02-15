'use strict';

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');

var socket = io.connect();

var pc;

var localStream;

var pcConfig = {
  'iceServers': [{
    'urls': 'stun:stun.l.google.com:19302'
  }]
};

var offerOption = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true
};

var getStream = navigator.mediaDevices.getUserMedia({
  audio: false,
  video: true
})

var room = prompt('Enter room name:');

if (room !== '') {
  socket.emit('create or join', room);
}

socket.on('created', function(room) {
  getStream.then(function(stream) {
    localStream = stream;
    localVideo.srcObject = stream;
  })
  .catch(function(err) {
    alert('getUserMedia() error: ' + err.name);
  });
});

socket.on('full', function(room) {
  console.warn('Room ' + room + ' is full');
});

function sendMessage(message) {
  console.log("message: ");
  console.log(message);
  socket.emit('message', message, room);
}

function initPeerConnection() {
  pc = new RTCPeerConnection(null);

  pc.onicecandidate = function(e) {
    if (e.candidate) {
      sendMessage({
        type: 'candidate',
        label: e.candidate.sdpMLineIndex,
        id: e.candidate.sdpMid,
        candidate: e.candidate.candidate
      });
    }
  };

  pc.onaddstream = function(e) {
    remoteVideo.srcObject = e.stream;
  };
}
  
socket.on('message', function(message) {
  if (message === 'ready') {
    initPeerConnection();
    pc.addStream(localStream);
    pc.createOffer().then(
      function (sessionDesc) {
        pc.setLocalDescription(sessionDesc);
        sendMessage(sessionDesc);
      }
    ).catch(
    function(err) {
      console.error('createOffer() error: ', err);
    }
    );
  } else if (message.type === 'offer') {
    getStream.then(function(stream) {
      localVideo.srcObject = stream;
      initPeerConnection();
      pc.addStream(stream);
      pc.setRemoteDescription(new RTCSessionDescription(message));
      pc.createAnswer().then(
        function (sessionDesc) {
          pc.setLocalDescription(sessionDesc);
          sendMessage(sessionDesc);
        }
      ).catch(
      function (err) {
        console.error('Failed to create session description: ' + err.toString());
      }
      );
    })
    .catch(function(err) {
      alert('getUserMedia() error: ' + err.name);
    });
  } else if (message.type === 'answer') {
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate') {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pc.addIceCandidate(candidate);
  } else if (message === 'bye') {
    handleRemoteHangup();
  }
});

function hangup() {
  stop();
  sendMessage('bye');
}

function handleRemoteHangup() {
  stop();
}

function stop() {
  pc.close();
  pc = null;
}

window.onbeforeunload = function() {
  sendMessage('bye');
};

