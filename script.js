let peerConn;
let localStream;
let db;
let callId = "my-call";

function initFirebase() {
  const firebaseConfig = {
    apiKey: "AIzaSyAmWBSqhsChYspp8cnPwV9E7EOnyB4jcqE",
    authDomain: "nonu-a2b10.firebaseapp.com",
    databaseURL: "https://nonu-a2b10-default-rtdb.firebaseio.com",
    projectId: "nonu-a2b10",
    storageBucket: "nonu-a2b10.firebasestorage.app",
    messagingSenderId: "563739635078",
    appId: "1:563739635078:web:52d355f0d9411317829007"
  };

  firebase.initializeApp(firebaseConfig);
  db = firebase.database();
}

async function getMediaStream() {
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  return localStream;
}

function setupCaller() {
  document.getElementById("callBtn").onclick = async () => {
    const servers = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
    peerConn = new RTCPeerConnection(servers);

    const stream = await getMediaStream();
    stream.getTracks().forEach(track => peerConn.addTrack(track, stream));

    peerConn.onicecandidate = e => {
      if (e.candidate) {
        db.ref(`${callId}/callerCandidates`).push(JSON.stringify(e.candidate));
      }
    };

    peerConn.ontrack = e => {
      document.getElementById("remoteAudio").srcObject = e.streams[0];
    };

    const offer = await peerConn.createOffer();
    await peerConn.setLocalDescription(offer);
    db.ref(`${callId}`).set({ offer: JSON.stringify(offer) });

    db.ref(`${callId}/answer`).on("value", async snapshot => {
      const data = snapshot.val();
      if (data && !peerConn.currentRemoteDescription) {
        const answer = new RTCSessionDescription(JSON.parse(data));
        await peerConn.setRemoteDescription(answer);
      }
    });

    db.ref(`${callId}/receiverCandidates`).on("child_added", snapshot => {
      const candidate = new RTCIceCandidate(JSON.parse(snapshot.val()));
      peerConn.addIceCandidate(candidate);
    });
  };
}

function setupReceiver() {
  const servers = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
  peerConn = new RTCPeerConnection(servers);

  getMediaStream().then(stream => {
    stream.getTracks().forEach(track => peerConn.addTrack(track, stream));
  });

  peerConn.ontrack = e => {
    document.getElementById("remoteAudio").srcObject = e.streams[0];
  };

  peerConn.onicecandidate = e => {
    if (e.candidate) {
      db.ref(`${callId}/receiverCandidates`).push(JSON.stringify(e.candidate));
    }
  };

  db.ref(`${callId}/offer`).on("value", async snapshot => {
    const data = snapshot.val();
    if (data) {
      document.getElementById("status").innerText = "Incoming call...";
      document.getElementById("answerBtn").style.display = "block";

      document.getElementById("answerBtn").onclick = async () => {
        const offer = new RTCSessionDescription(JSON.parse(data));
        await peerConn.setRemoteDescription(offer);

        const answer = await peerConn.createAnswer();
        await peerConn.setLocalDescription(answer);
        db.ref(`${callId}/answer`).set(JSON.stringify(answer));

        document.getElementById("status").innerText = "Call connected";
      };
    }
  });

  db.ref(`${callId}/callerCandidates`).on("child_added", snapshot => {
    const candidate = new RTCIceCandidate(JSON.parse(snapshot.val()));
    peerConn.addIceCandidate(candidate);
  });
}
