'use strict';

var Observable = Rx.Observable;

var socket = io.connect();

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');

var pc;

var room = prompt('Enter room name:');

if (room !== '') {
  socket.emit('create or join', room);
}

function sendMessage(message) {
  socket.emit('message', message, room);
}

function initPeerConnection() {
  var localPC = new RTCPeerConnection(null);

  localPC.onicecandidate = function(e) {
    if (e.candidate) {
      sendMessage({
        type: 'candidate',
        label: e.candidate.sdpMLineIndex,
        id: e.candidate.sdpMid,
        candidate: e.candidate.candidate
      });
    }
  };

  localPC.onaddstream = function(e) {
    remoteVideo.srcObject = e.stream;
  };

  return localPC;
}

var initPC$ = Observable.of(initPeerConnection());

var getMediaStream$ = Observable.fromPromise(
  navigator.mediaDevices.getUserMedia({
    audio: false,
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

readyForOffer$
  .switchMap(function() { 
    return getMediaStream$; 
  })
  .subscribe(function(stream) {
    pc = initPeerConnection();
    pc.addStream(stream);
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
  });

Observable.zip(getOfferSD$, getMediaStream$).subscribe(function (val) {
  var message = val[0];
  var stream = val[1];

  pc = initPeerConnection();
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
});

getAnswerSD$.subscribe(function(message) {
  pc.setRemoteDescription(new RTCSessionDescription(message));
});

getCandidate$.subscribe(function(message) {
  var candidate = new RTCIceCandidate({
    sdpMLineIndex: message.label,
    candidate: message.candidate
  });

  pc.addIceCandidate(candidate);
});

