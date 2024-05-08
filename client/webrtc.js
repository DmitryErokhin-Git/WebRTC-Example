let localStream;
let localVideo;
let peerConnection;
let remoteVideo;
let serverConnection;
let uuid;

const peerConnectionConfig = {
   /* config: { */
   /*       iceServers: [
            {
               // urls: ['stun:stun.l.google.com:19302'],
               urls: ['stun:dev.pyjam.com:3478', 'turn:dev.pyjam.com:3478'],
               username: 'user',
               credential: '234567Qwe',
               credentialType: 'password'
            }
         ],
         iceTransportPolicy: 'relay' */
   /*  } */
}


async function pageReady() {
   uuid = createUUID();

   localVideo = document.getElementById('localVideo');
   remoteVideo = document.getElementById('remoteVideo');

   serverConnection = new WebSocket(`wss://${window.location.hostname}:8443`);
   serverConnection.onmessage = gotMessageFromServer;

   const constraints = {
      video: true,
      audio: true,
   };

   if (!navigator.mediaDevices.getUserMedia) {
      alert('Your browser does not support getUserMedia API');
      return;
   }

   try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      localStream = stream;
      localVideo.srcObject = stream;
   } catch (error) {
      errorHandler(error);
   }
}

function onConnectionStateChange(event) {
   console.warn('\x1b[31m' + `connectionState` + '\x1b[0m', peerConnection.connectionState);
   console.warn('localDescription', peerConnection.localDescription)
   console.warn('remoteDescription', peerConnection.remoteDescription)
}

function start(isCaller) {
   peerConnection = new RTCPeerConnection(peerConnectionConfig);
   peerConnection.onicecandidate = gotIceCandidate;
   peerConnection.ontrack = gotRemoteStream;
   peerConnection.addEventListener('connectionstatechange', (event) => onConnectionStateChange(event))

   for (const track of localStream.getTracks()) {
/*       console.log(track, localStream)
 */      peerConnection.addTrack(track, localStream);
   }

   if (isCaller) {
      console.log('createOffer')

      peerConnection.createOffer().then(createdDescription).catch(errorHandler);
   }
}

function gotMessageFromServer(message) {
/*    console.log('Socket message', JSON.parse(message.data))
 */   if (!peerConnection) start(false);

   const signal = JSON.parse(message.data);

   // Ignore messages from ourself
   if (signal.uuid == uuid) return;

   if (signal.sdp) {
      console.log('get description')

      peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
         // Only create answers in response to offers
         if (signal.sdp.type !== 'offer') return;
         console.log('createAnswer')

         /*  setTimeout(() => { */
         peerConnection.createAnswer().then(createdDescription).catch(errorHandler);
         /*    }, 3000) */

      }).catch(errorHandler);
   } else if (signal.ice) {
      /*       console.log('localDescription', peerConnection.localDescription)
            console.log('remoteDescription', peerConnection.remoteDescription) */

      console.log('\x1b[32m' + `add remote candidate` + '\x1b[0m', signal.ice.candidate.type);
      peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(errorHandler);
   }
}

function gotIceCandidate(event) {
   if (event.candidate != null) {
      console.log('\x1b[34m' + `send local candidate` + '\x1b[0m', event.candidate.type);

      serverConnection.send(JSON.stringify({ 'ice': event.candidate, 'uuid': uuid }));
   }
}

function createdDescription(description) {
   console.log('set description');

   peerConnection.setLocalDescription(description).then(() => {
      console.log('send description');

      serverConnection.send(JSON.stringify({ 'sdp': peerConnection.localDescription, 'uuid': uuid }));
   }).catch(errorHandler);
}

function gotRemoteStream(event) {
/*    console.log('get remote stream');
 */   remoteVideo.srcObject = event.streams[0];
}

function errorHandler(error) {
   console.log(error);
}

// Taken from http://stackoverflow.com/a/105074/515584
// Strictly speaking, it's not a real UUID, but it gets the job done here
function createUUID() {
   function s4() {
      return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
   }

   return `${s4() + s4()}-${s4()}-${s4()}-${s4()}-${s4() + s4() + s4()}`;
}
