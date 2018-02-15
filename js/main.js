'use strict';

var Observable = Rx.Observable;

var socket = io.connect();

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');

var room = prompt('Enter room name:');

if (room !== '') {
  socket.emit('create or join', room);
}

function sendMessage(message) {
  socket.emit('message', message, room);
}

function initPeerConnection() {
  var pc = new RTCPeerConnection(null);

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

  return pc;
}

var initPC$ = Observable.of(initPeerConnection());

var getMediaStream$ = Observable.fromPromise(
  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true
  })
);

var fullNotify$ = Observable.fromEvent(socket, 'full');

var message$ = Observable.fromEvent(socket, 'message')

var readyForOffer$ = message$.filter(function(msg) {
  return msg === 'ready'
});

var getOfferSD$ = message$.filter(function(msg) {
  return msg.type === 'offer'
});

var getAnswerSD$ = message$.filter(function(msg) {
  return msg.type === 'answer'
});

var getCandidate$ = message$.filter(function(msg) {
  return msg.type === 'candidate'
});

getMediaStream$.subscribe(function(stream) {
  localVideo.srcObject = stream;
});

fullNotify$.subscribe(function(room) {
  alert("The " + room + "is full");
});

Observable
  .zip(initPC$, getMediaStream$, readyForOffer$)
  .subscribe(function(val) {
    var pc = val[0];
    var stream = val[1];

    pc.addStream(stream);
    
    pc.createOffer().then(
      function(sessionDesc) {
        pc.setLocalDescription(sessionDesc);
        sendMessage(sessionDesc);
      }
    ).catch(
      function(err) {
        console.error('createOffer() error: ', err);
      }
    );
  });

Observable
  .zip(initPC$, getMediaStream$, getOfferSD$)
  .subscribe(function(val) {
    var pc = val[0];
    var stream = val[1];
    var message = val[2];

    pc.addStream(stream);
    pc.setRemoteDescription(new RTCSessionDescription(message));
    
    pc.createAnswer().then(
      function(sessionDesc) {
        pc.setLocalDescription(sessionDesc);
        sendMessage(sessionDesc);
      }
    ).catch(
      function(err) {
        console.error('Failed to create session description: ' + err.toString());
      }
    );
  });

Observable
  .zip(initPC$, getAnswerSD$)
  .subscribe(function(val) {
    var pc = val[0];
    var message = val[1];

    pc.setRemoteDescription(new RTCSessionDescription(message));
  });

Observable
  .zip(initPC$, getCandidate$)
  .subscribe(function(val) {
    var pc = val[0];
    var message = val[1];

    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });

    pc.addIceCandidate(candidate);
  });

