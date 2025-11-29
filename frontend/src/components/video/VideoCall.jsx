import React, { useState, useEffect, useRef } from 'react';
import { Video, VideoOff, Mic, MicOff, Phone, PhoneOff, Maximize2, Minimize2 } from 'lucide-react';
import Peer from 'simple-peer';

function VideoCall({ socket, roomId, username }) {
  const [inCall, setInCall] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [peers, setPeers] = useState([]);
  
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef([]);

  // Join video call
  const joinCall = async () => {
    try {
      console.log('Requesting media access...');
      
      // Get user media (camera + microphone)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      localStreamRef.current = stream;
      
      // Display local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setInCall(true);
      console.log('Media access granted');

      // Tell server we're joining video call
      socket.emit('join-video-call', { roomId });

    } catch (error) {
      console.error('Error accessing media devices:', error);
      alert('Could not access camera/microphone. Please check permissions.');
    }
  };

  // Leave video call
  const leaveCall = () => {
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }

    // Close all peer connections
    peersRef.current.forEach(peerObj => {
      if (peerObj.peer) {
        peerObj.peer.destroy();
      }
    });

    peersRef.current = [];
    setPeers([]);
    setInCall(false);

    // Notify server
    socket.emit('leave-video-call', { roomId });
    
    console.log('📹 Left video call');
  };

  // Toggle video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  // Create peer connection
  const createPeer = (userToSignal, callerID, stream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream,
    });

    peer.on('signal', signal => {
      socket.emit('sending-signal', { userToSignal, callerID, signal });
    });

    peer.on('error', err => {
      console.error('Peer error:', err);
    });

    return peer;
  };

  // Add peer
  const addPeer = (incomingSignal, callerID, stream) => {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream,
    });

    peer.on('signal', signal => {
      socket.emit('returning-signal', { signal, callerID });
    });

    peer.on('error', err => {
      console.error('Peer error:', err);
    });

    peer.signal(incomingSignal);

    return peer;
  };

  // Socket event listeners
  useEffect(() => {
    if (!socket || !inCall) return;

    // When we receive list of users already in call
    socket.on('all-users', ({ users }) => {
      console.log('📹 Users in call:', users);
      
      const newPeers = [];
      users.forEach(userID => {
        const peer = createPeer(userID, socket.id, localStreamRef.current);
        peersRef.current.push({
          peerID: userID,
          peer,
        });
        newPeers.push({
          peerID: userID,
          peer,
        });
      });
      setPeers(newPeers);
    });

    // When another user joins the call
    socket.on('user-joined-video', ({ signal, callerID }) => {
      console.log('📹 User joined video:', callerID);
      
      const peer = addPeer(signal, callerID, localStreamRef.current);
      
      peersRef.current.push({
        peerID: callerID,
        peer,
      });

      setPeers(prev => [...prev, { peerID: callerID, peer }]);
    });

    // When we receive answer from another peer
    socket.on('receiving-returned-signal', ({ signal, id }) => {
      console.log('📹 Received returned signal from:', id);
      
      const item = peersRef.current.find(p => p.peerID === id);
      if (item) {
        item.peer.signal(signal);
      }
    });

    // When a user leaves video call
    socket.on('user-left-video', ({ userId }) => {
      console.log('📹 User left video:', userId);
      
      const peerObj = peersRef.current.find(p => p.peerID === userId);
      if (peerObj) {
        peerObj.peer.destroy();
      }
      
      peersRef.current = peersRef.current.filter(p => p.peerID !== userId);
      setPeers(prev => prev.filter(p => p.peerID !== userId));
    });

    return () => {
      socket.off('all-users');
      socket.off('user-joined-video');
      socket.off('receiving-returned-signal');
      socket.off('user-left-video');
    };
  }, [socket, inCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      peersRef.current.forEach(peerObj => {
        if (peerObj.peer) {
          peerObj.peer.destroy();
        }
      });
    };
  }, []);

  if (!inCall) {
    // Join Call Button
    return (
      <div className="bg-slate-800 border-t border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center">
              <VideoOff className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <p className="text-white font-medium text-sm">Video Call</p>
              <p className="text-slate-400 text-xs">Not connected</p>
            </div>
          </div>
          <button
            onClick={joinCall}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
          >
            <Phone className="w-4 h-4" />
            Join Call
          </button>
        </div>
      </div>
    );
  }

  // In Call UI
  return (
    <div className={`bg-slate-800 border-t border-slate-700 transition-all ${
      isExpanded ? 'h-96' : 'h-auto'
    }`}>
      <div className="p-4">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-green-400" />
            <span className="text-white font-medium text-sm">Video Call</span>
            <span className="text-xs text-slate-400">
              ({peers.length + 1} participant{peers.length !== 0 ? 's' : ''})
            </span>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
            title={isExpanded ? 'Minimize' : 'Expand'}
          >
            {isExpanded ? (
              <Minimize2 className="w-4 h-4 text-slate-400" />
            ) : (
              <Maximize2 className="w-4 h-4 text-slate-400" />
            )}
          </button>
        </div>

        {/* Video Grid */}
        <div className={`grid gap-3 mb-4 ${
          peers.length === 0 ? 'grid-cols-1' :
          peers.length === 1 ? 'grid-cols-2' :
          peers.length === 2 ? 'grid-cols-3' :
          'grid-cols-4'
        }`}>
          
          {/* Local Video */}
          <div className="relative bg-slate-900 rounded-lg overflow-hidden aspect-video">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-white">
              You {!videoEnabled && '(Camera Off)'}
            </div>
            {!videoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                <VideoOff className="w-8 h-8 text-slate-600" />
              </div>
            )}
          </div>

          {/* Remote Videos */}
          {peers.map((peerObj, index) => (
            <RemoteVideo key={peerObj.peerID} peer={peerObj.peer} index={index} />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          
          {/* Toggle Video */}
          <button
            onClick={toggleVideo}
            className={`p-3 rounded-lg transition-colors ${
              videoEnabled 
                ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {videoEnabled ? (
              <Video className="w-5 h-5" />
            ) : (
              <VideoOff className="w-5 h-5" />
            )}
          </button>

          {/* Toggle Audio */}
          <button
            onClick={toggleAudio}
            className={`p-3 rounded-lg transition-colors ${
              audioEnabled 
                ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            title={audioEnabled ? 'Mute' : 'Unmute'}
          >
            {audioEnabled ? (
              <Mic className="w-5 h-5" />
            ) : (
              <MicOff className="w-5 h-5" />
            )}
          </button>

          {/* Leave Call */}
          <button
            onClick={leaveCall}
            className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            title="Leave call"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Remote Video Component
function RemoteVideo({ peer, index }) {
  const ref = useRef();

  useEffect(() => {
    peer.on('stream', stream => {
      if (ref.current) {
        ref.current.srcObject = stream;
      }
    });

    return () => {
      peer.off('stream');
    };
  }, [peer]);

  return (
    <div className="relative bg-slate-900 rounded-lg overflow-hidden aspect-video">
      <video 
        ref={ref} 
        autoPlay 
        playsInline 
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-white">
        Participant {index + 1}
      </div>
    </div>
  );
}

export default VideoCall;