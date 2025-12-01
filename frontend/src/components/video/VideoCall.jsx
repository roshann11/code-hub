import React, { useState, useEffect, useRef } from 'react';
import { Video, VideoOff, Mic, MicOff, Phone, PhoneOff, Maximize2, Minimize2, User } from 'lucide-react';
import Peer from 'simple-peer';

function VideoCall({ socket, roomId, username }) {
  const [inCall, setInCall] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [peers, setPeers] = useState([]);
  const [streamReady, setStreamReady] = useState(false); // ← ADDED: Missing state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef([]);

  // Test camera function
  const testCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      console.log('✅ Camera works!', stream);
      console.log('Video tracks:', stream.getVideoTracks());
      console.log('Audio tracks:', stream.getAudioTracks());
      alert('✅ Camera access granted! Check console for details.');
      
      // Stop the test stream
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error('❌ Camera error:', err);
      alert('❌ Camera error: ' + err.name + '\n' + err.message);
    }
  };

  // Join video call
  const joinCall = async () => {
    try {
      console.log('📹 Requesting media access...');
      
      // Get user media (camera + microphone)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      });

      console.log('✅ Media access granted');
      console.log('Stream:', stream);
      console.log('Video tracks:', stream.getVideoTracks());
      console.log('Audio tracks:', stream.getAudioTracks());

      localStreamRef.current = stream;

      setInCall(true);
      console.log('✅ Set inCall to true');
      socket.emit('join-video-call', { roomId });
    }catch (error) {
      console.error('❌ Error accessing media devices:', error);
      let errorMsg = 'Could not access camera/microphone. ';
      if (error.name === 'NotAllowedError') {
      errorMsg += 'Please allow camera and microphone permissions.';
    } else if (error.name === 'NotFoundError') {
      errorMsg += 'No camera or microphone found.';
    } else if (error.name === 'NotReadableError') {
      errorMsg += 'Camera is already in use by another application.';
    } else {
      errorMsg += error.message;
    }
    
    alert(errorMsg);
  }
};

  // Attach stream to video element when it's ready
  useEffect(() => {
    if (inCall && localStreamRef.current && localVideoRef.current) {
      console.log('📺 Attaching stream to video element');
      
      localVideoRef.current.srcObject = localStreamRef.current;
      
      localVideoRef.current.onloadedmetadata = () => {
        console.log('✅ Video metadata loaded');
        console.log('Video dimensions:', localVideoRef.current.videoWidth, 'x', localVideoRef.current.videoHeight);
      };
      
      localVideoRef.current.onloadeddata = () => {
        console.log('✅ Video data loaded');
      };
      
      localVideoRef.current.onplay = () => {
        console.log('✅ Video playing');
        setStreamReady(true);
      };
      
      localVideoRef.current.onerror = (e) => {
        console.error('❌ Video error:', e);
      };
      
      // Manually play
      localVideoRef.current.play()
        .then(() => {
          console.log('✅ Video play() succeeded');
          setStreamReady(true);
        })
        .catch((playError) => {
          console.error('❌ Video play() failed:', playError);
        });
    }
  }, [inCall]); // Run when inCall changes

  // Leave video call
  const leaveCall = () => {
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Stopped track:', track.kind);
      });
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
    setStreamReady(false);

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
        console.log('📹 Video:', videoTrack.enabled ? 'ON' : 'OFF');
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
        console.log('🎤 Audio:', audioTrack.enabled ? 'ON' : 'OFF');
      }
    }
  };
  // Toggle fullscreen
const toggleFullscreen = () => {
  setIsFullscreen(!isFullscreen);
  setIsExpanded(false); // Reset expanded when going fullscreen
};

// Exit fullscreen (for ESC key support)
const exitFullscreen = () => {
  setIsFullscreen(false);
};

// Handle ESC key to exit fullscreen
useEffect(() => {
  const handleEscape = (e) => {
    if (e.key === 'Escape' && isFullscreen) {
      exitFullscreen();
    }
  };
  
  window.addEventListener('keydown', handleEscape);
  return () => window.removeEventListener('keydown', handleEscape);
}, [isFullscreen]);

  // Create peer connection
  const createPeer = (userToSignal, callerID, stream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
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
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
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
      <div className="bg-slate-800 border-t border-slate-700 p-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
              <VideoOff className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <p className="text-white font-medium text-sm">Video Call</p>
              <p className="text-slate-400 text-xs">Click to test or join with camera</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={testCamera}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              🔍 Test
            </button>
            
            <button
              onClick={joinCall}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2 font-medium text-sm"
            >
              <Phone className="w-4 h-4" />
              Join Call
            </button>
          </div>
        </div>
      </div>
    );
  }

  // In Call UI
return (
  <div className={`bg-slate-800 border-t border-slate-700 transition-all duration-300 ${
    isFullscreen 
      ? 'fixed inset-0 z-50 h-screen' 
      : isExpanded 
      ? 'h-64'  // ← Changed from h-[500px] to h-64 (256px)
      : 'h-auto'
  }`}>
    
    {/* Fullscreen Overlay */}
    {isFullscreen && (
      <>
        <div className="absolute inset-0 bg-slate-900"></div>
        <button
          onClick={exitFullscreen}
          className="absolute top-4 right-4 z-10 p-2 bg-slate-800/90 hover:bg-slate-700 rounded-lg transition-colors backdrop-blur-sm"
          title="Exit Fullscreen (ESC)"
        >
          <Minimize2 className="w-5 h-5 text-white" />
        </button>
      </>
    )}
    
    <div className={`transition-all relative z-10 ${
      isFullscreen 
        ? 'p-4 max-w-full h-full flex flex-col' 
        : isExpanded 
        ? 'p-4 max-w-6xl mx-auto'
        : 'p-2 max-w-6xl mx-auto'  // ← Smaller padding when collapsed
    }`}>
      
      {/* Header - More Compact */}
      <div className={`flex items-center justify-between ${isExpanded || isFullscreen ? 'mb-3' : 'mb-2'}`}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <Video className={`${isExpanded || isFullscreen ? 'w-5 h-5' : 'w-4 h-4'} text-green-400`} />
          <span className={`text-white font-medium ${isExpanded || isFullscreen ? 'text-sm' : 'text-xs'}`}>
            Live Call
          </span>
          <span className={`text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded-full ${!isExpanded && !isFullscreen ? 'hidden sm:inline' : ''}`}>
            {peers.length + 1} {peers.length === 0 ? 'participant' : 'participants'}
          </span>
          {isFullscreen && (
            <span className="text-xs text-slate-500 ml-2">
              Press ESC to exit fullscreen
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {!streamReady && !isFullscreen && (
            <span className="text-xs text-yellow-400 hidden sm:inline">Loading...</span>
          )}
          
          {/* Expand/Minimize */}
          {/* {!isFullscreen && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 hover:bg-slate-700 rounded transition-colors"
              title={isExpanded ? 'Minimize' : 'Expand'}
            >
              {isExpanded ? (
                <Minimize2 className="w-4 h-4 text-slate-400" />
              ) : (
                <Maximize2 className="w-4 h-4 text-slate-400" />
              )}
            </button>
          )} */}
          
          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 hover:bg-slate-700 rounded transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-purple-400" />
            ) : (
              <Maximize2 className="w-4 h-4 text-purple-400" />
            )}
          </button>
        </div>
      </div>

      {/* Video Grid - Compact when collapsed */}
      <div className={`grid gap-2 ${
        isFullscreen ? 'flex-1 mb-3' : 
        isExpanded ? 'mb-3' : 
        'mb-2'
      } ${
        isFullscreen ? '' : 
        isExpanded ? '' : 
        'max-h-32'  // ← Limit height when collapsed
      } ${
        peers.length === 0 ? 'grid-cols-1 max-w-md mx-auto' :
        peers.length === 1 ? 'grid-cols-2' :
        peers.length === 2 ? 'grid-cols-3' :
        peers.length <= 4 ? 'grid-cols-4' :
        peers.length <= 6 ? 'grid-cols-6' :  // ← More columns for compact view
        'grid-cols-7'
      }`}>
        
        {/* Local Video - Smaller when not expanded */}
        <div className={`relative bg-slate-900 rounded-lg overflow-hidden shadow-lg ${
          isExpanded || isFullscreen ? 'aspect-video' : 'aspect-video h-28'  // ← Fixed small height
        }`}>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover ${!streamReady ? 'opacity-0' : 'opacity-100'} transition-opacity`}
          />
          
          {/* Loading State */}
          {!streamReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <div className="text-center">
                <div className={`${isExpanded || isFullscreen ? 'w-12 h-12' : 'w-6 h-6'} border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2`}></div>
                {(isExpanded || isFullscreen) && (
                  <p className="text-slate-400 text-xs">Loading camera...</p>
                )}
              </div>
            </div>
          )}
          
          {/* Name Tag - Smaller when collapsed */}
          <div className={`absolute bottom-1 left-1 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded flex items-center gap-1 ${
            isExpanded || isFullscreen ? 'text-xs' : 'text-[10px]'
          } text-white`}>
            <User className={`${isExpanded || isFullscreen ? 'w-3 h-3' : 'w-2 h-2'}`} />
            <span>{isExpanded || isFullscreen ? `${username} (You)` : 'You'}</span>
          </div>
          
          {/* Camera Off Overlay */}
          {!videoEnabled && streamReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
              <div className={`${isExpanded || isFullscreen ? 'w-16 h-16' : 'w-8 h-8'} bg-slate-700 rounded-full flex items-center justify-center mb-2`}>
                <User className={`${isExpanded || isFullscreen ? 'w-8 h-8' : 'w-4 h-4'} text-slate-400`} />
              </div>
              {(isExpanded || isFullscreen) && (
                <>
                  <VideoOff className="w-6 h-6 text-slate-500 mb-1" />
                  <span className="text-slate-400 text-xs">Camera Off</span>
                </>
              )}
            </div>
          )}
          
          {/* Status Indicators - Only show when expanded */}
          {(isExpanded || isFullscreen) && (
            <div className="absolute top-2 right-2 flex gap-1">
              {!videoEnabled && (
                <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center">
                  <VideoOff className="w-3 h-3 text-white" />
                </div>
              )}
              {!audioEnabled && (
                <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center">
                  <MicOff className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Remote Videos - Smaller when not expanded */}
        {peers.map((peerObj, index) => (
          <RemoteVideoCompact 
            key={peerObj.peerID} 
            peer={peerObj.peer} 
            index={index}
            isExpanded={isExpanded || isFullscreen}
          />
        ))}
      </div>

      {/* Controls - More Compact */}
      <div className="flex items-center justify-center gap-2">
        
        {/* Toggle Video */}
        <button
          onClick={toggleVideo}
          className={`rounded-lg transition-all ${
            isExpanded || isFullscreen ? 'p-3' : 'p-2'
          } ${
            videoEnabled 
              ? 'bg-slate-700 hover:bg-slate-600 text-white' 
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
          title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {videoEnabled ? (
            <Video className={`${isExpanded || isFullscreen ? 'w-5 h-5' : 'w-4 h-4'}`} />
          ) : (
            <VideoOff className={`${isExpanded || isFullscreen ? 'w-5 h-5' : 'w-4 h-4'}`} />
          )}
        </button>

        {/* Toggle Audio */}
        <button
          onClick={toggleAudio}
          className={`rounded-lg transition-all ${
            isExpanded || isFullscreen ? 'p-3' : 'p-2'
          } ${
            audioEnabled 
              ? 'bg-slate-700 hover:bg-slate-600 text-white' 
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
          title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          {audioEnabled ? (
            <Mic className={`${isExpanded || isFullscreen ? 'w-5 h-5' : 'w-4 h-4'}`} />
          ) : (
            <MicOff className={`${isExpanded || isFullscreen ? 'w-5 h-5' : 'w-4 h-4'}`} />
          )}
        </button>

        {/* Leave Call */}
        <button
          onClick={leaveCall}
          className={`bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all flex items-center gap-2 ${
            isExpanded || isFullscreen ? 'p-3 px-4' : 'p-2 px-3'
          }`}
          title="Leave call"
        >
          <PhoneOff className={`${isExpanded || isFullscreen ? 'w-5 h-5' : 'w-4 h-4'}`} />
          {(isExpanded || isFullscreen) && (
            <span className="text-sm font-medium">Leave</span>
          )}
        </button>
      </div>
    </div>
  </div>
);
}

// Remote Video Component
function RemoteVideo({ peer, index }) {
  const ref = useRef();
  const [hasStream, setHasStream] = useState(false);

  useEffect(() => {
    peer.on('stream', stream => {
      console.log('📹 Received remote stream for peer', index);
      if (ref.current) {
        ref.current.srcObject = stream;
        setHasStream(true);
      }
    });

    return () => {
      peer.off('stream');
    };
  }, [peer, index]);

  return (
    <div className="relative bg-slate-900 rounded-lg overflow-hidden aspect-video shadow-lg">
      <video 
        ref={ref} 
        autoPlay 
        playsInline 
        className={`w-full h-full object-cover ${!hasStream ? 'opacity-0' : 'opacity-100'} transition-opacity`}
      />
      
      {!hasStream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-slate-400 text-xs">Connecting...</p>
        </div>
      )}
      
      <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-xs text-white flex items-center gap-1">
        <User className="w-3 h-3" />
        <span>Participant {index + 1}</span>
      </div>
    </div>
  );
}
// Compact Remote Video Component
// function RemoteVideoCompact({ peer, index, isExpanded }) {
//   const ref = useRef();
//   const [hasStream, setHasStream] = useState(false);

//   useEffect(() => {
//     peer.on('stream', stream => {
//       console.log('📹 Received remote stream for peer', index);
//       if (ref.current) {
//         ref.current.srcObject = stream;
//         setHasStream(true);
//       }
//     });

//     return () => {
//       peer.off('stream');
//     };
//   }, [peer, index]);

//   return (
//     <div className={`relative bg-slate-900 rounded-lg overflow-hidden shadow-lg ${
//       isExpanded ? 'aspect-video' : 'aspect-video h-28'
//     }`}>
//       <video 
//         ref={ref} 
//         autoPlay 
//         playsInline 
//         className={`w-full h-full object-cover ${!hasStream ? 'opacity-0' : 'opacity-100'} transition-opacity`}
//       />
      
//       {!hasStream && (
//         <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
//           <div className={`${isExpanded ? 'w-12 h-12' : 'w-6 h-6'} border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-2`}></div>
//           {isExpanded && (
//             <p className="text-slate-400 text-xs">Connecting...</p>
//           )}
//         </div>
//       )}
      
//       <div className={`absolute bottom-1 left-1 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded flex items-center gap-1 ${
//         isExpanded ? 'text-xs' : 'text-[10px]'
//       } text-white`}>
//         <User className={`${isExpanded ? 'w-3 h-3' : 'w-2 h-2'}`} />
//         <span>{isExpanded ? `Participant ${index + 1}` : `P${index + 1}`}</span>
//       </div>
//     </div>
//   );
// }

export default VideoCall;