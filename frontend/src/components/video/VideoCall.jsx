import React, { useState, useEffect, useRef } from 'react';
import { Video, VideoOff, Mic, MicOff, Phone, PhoneOff, Maximize2, Minimize2, User } from 'lucide-react';
import Peer from 'peerjs';

function VideoCall({ socket, roomId, username }) {
  const [inCall, setInCall] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [remotePeers, setRemotePeers] = useState([]);
  
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerRef = useRef(null);
  const connectionsRef = useRef([]);

  const testCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      console.log('✅ Camera works!', stream);
      alert('✅ Camera access granted!');
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error('❌ Camera error:', err);
      alert('❌ Camera error: ' + err.name);
    }
  };

  const joinCall = async () => {
    try {
      console.log('📹 Requesting media access...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      });

      console.log('✅ Media access granted');
      localStreamRef.current = stream;
      
      setInCall(true);

    } catch (error) {
      console.error('❌ Error accessing media devices:', error);
      alert('Could not access camera: ' + error.message);
    }
  };

  // Attach stream to video when inCall changes
  useEffect(() => {
    if (inCall && localStreamRef.current && localVideoRef.current) {
      console.log('📺 Attaching stream to video element');
      localVideoRef.current.srcObject = localStreamRef.current;
      
      localVideoRef.current.play()
        .then(() => {
          console.log('✅ Video playing');
          setStreamReady(true);
        })
        .catch(err => console.error('❌ Video play failed:', err));
    }
  }, [inCall]);

  // Initialize PeerJS
  useEffect(() => {
    if (!inCall || !socket) return;

    console.log('📹 Initializing PeerJS...');

    // Create PeerJS instance with unique ID
    const peer = new Peer(socket.id, {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ]
      },
      debug: 2 // Show debug logs
    });

    peerRef.current = peer;

    peer.on('open', (id) => {
      console.log('✅ PeerJS initialized with ID:', id);
      // Tell server we're joining video call
      socket.emit('join-video-call', { roomId, peerId: id });
    });

    // Handle incoming calls
    peer.on('call', (call) => {
      console.log('📹 Receiving call from:', call.peer);
      
      // Answer with our stream
      call.answer(localStreamRef.current);
      
      // When we receive their stream
      call.on('stream', (remoteStream) => {
        console.log('✅ Received remote stream from:', call.peer);
        
        setRemotePeers(prev => {
          // Avoid duplicates
          if (prev.find(p => p.id === call.peer)) {
            return prev;
          }
          return [...prev, { id: call.peer, stream: remoteStream }];
        });
      });

      connectionsRef.current.push(call);
    });

    peer.on('error', (err) => {
      console.error('❌ PeerJS error:', err);
    });

    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, [inCall, socket, roomId]);

  // Handle socket events for peer connections
  useEffect(() => {
    if (!socket || !inCall) return;

    // When another user joins the call
    socket.on('user-joined-video-call', ({ peerId }) => {
      console.log('📹 User joined, calling peer:', peerId);
      
      if (peerRef.current && localStreamRef.current) {
        // Call the new peer
        const call = peerRef.current.call(peerId, localStreamRef.current);
        
        if (call) {
          call.on('stream', (remoteStream) => {
            console.log('✅ Received stream from:', peerId);
            
            setRemotePeers(prev => {
              if (prev.find(p => p.id === peerId)) {
                return prev;
              }
              return [...prev, { id: peerId, stream: remoteStream }];
            });
          });

          connectionsRef.current.push(call);
        }
      }
    });

    socket.on('user-left-video', ({ peerId }) => {
      console.log('📹 Peer left:', peerId);
      setRemotePeers(prev => prev.filter(p => p.id !== peerId));
    });

    return () => {
      socket.off('user-joined-video-call');
      socket.off('user-left-video');
    };
  }, [socket, inCall]);

  const leaveCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }

    connectionsRef.current.forEach(conn => conn.close());
    if (peerRef.current) {
      peerRef.current.destroy();
    }

    connectionsRef.current = [];
    setRemotePeers([]);
    setInCall(false);
    setStreamReady(false);

    socket.emit('leave-video-call', { roomId });
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setIsExpanded(false);
  };

  const exitFullscreen = () => {
    setIsFullscreen(false);
  };

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        exitFullscreen();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isFullscreen]);

  if (!inCall) {
    return (
      <div className="bg-slate-800 border-t border-slate-700 p-3">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
              <VideoOff className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <p className="text-white font-medium text-sm">Video Call</p>
              <p className="text-slate-400 text-xs">Click to test or join</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={testCamera}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
            >
              Test
            </button>
            <button
              onClick={joinCall}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 text-sm"
            >
              <Phone className="w-4 h-4" />
              Join Call
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-slate-800 border-t border-slate-700 transition-all ${
      isFullscreen ? 'fixed inset-0 z-50 h-screen' : 
      isExpanded ? 'h-64' : 'h-auto'
    }`}>
      
      {isFullscreen && (
        <>
          <div className="absolute inset-0 bg-slate-900"></div>
          <button
            onClick={exitFullscreen}
            className="absolute top-4 right-4 z-10 p-2 bg-slate-800/90 rounded-lg"
          >
            <Minimize2 className="w-5 h-5 text-white" />
          </button>
        </>
      )}
      
      <div className={`transition-all relative z-10 ${
        isFullscreen ? 'p-4 h-full flex flex-col' : 
        isExpanded ? 'p-4' : 'p-2'
      }`}>
        
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <Video className="w-4 h-4 text-green-400" />
            <span className="text-white text-xs">Live ({remotePeers.length + 1})</span>
          </div>
          
          <div className="flex gap-2">
            {!isFullscreen && (
              <button onClick={() => setIsExpanded(!isExpanded)} className="p-1 hover:bg-slate-700 rounded">
                {isExpanded ? <Minimize2 className="w-4 h-4 text-slate-400" /> : <Maximize2 className="w-4 h-4 text-slate-400" />}
              </button>
            )}
            <button onClick={toggleFullscreen} className="p-1 hover:bg-slate-700 rounded">
              <Maximize2 className="w-4 h-4 text-purple-400" />
            </button>
          </div>
        </div>

        <div className={`grid gap-2 mb-2 ${
          remotePeers.length === 0 ? 'grid-cols-1 max-w-md mx-auto' :
          remotePeers.length === 1 ? 'grid-cols-2' :
          'grid-cols-3'
        } ${isFullscreen ? 'flex-1' : isExpanded ? '' : 'max-h-32'}`}>
          
          {/* Local Video */}
          <div className={`relative bg-slate-900 rounded-lg overflow-hidden ${
            isExpanded || isFullscreen ? 'aspect-video' : 'aspect-video h-28'
          }`}>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover ${!streamReady ? 'opacity-0' : 'opacity-100'}`}
            />
            
            {!streamReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            
            <div className="absolute bottom-1 left-1 bg-black/70 px-2 py-1 rounded text-xs text-white">
              <User className="w-3 h-3 inline mr-1" />
              You
            </div>
            
            {!videoEnabled && streamReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                <VideoOff className="w-8 h-8 text-slate-600" />
              </div>
            )}
          </div>

          {/* Remote Videos */}
          {remotePeers.map((peer, idx) => (
            <RemoteVideoPeerJS key={peer.id} stream={peer.stream} index={idx} isExpanded={isExpanded || isFullscreen} />
          ))}
        </div>

        <div className="flex items-center justify-center gap-2">
          <button onClick={toggleVideo} className={`p-2 rounded-lg ${videoEnabled ? 'bg-slate-700' : 'bg-red-600'}`}>
            {videoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </button>
          <button onClick={toggleAudio} className={`p-2 rounded-lg ${audioEnabled ? 'bg-slate-700' : 'bg-red-600'}`}>
            {audioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>
          <button onClick={leaveCall} className="p-2 px-4 bg-red-600 rounded-lg flex items-center gap-2">
            <PhoneOff className="w-4 h-4" />
            {(isExpanded || isFullscreen) && <span className="text-sm">Leave</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

function RemoteVideoPeerJS({ stream, index, isExpanded }) {
  const ref = useRef();

  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`relative bg-slate-900 rounded-lg overflow-hidden ${
      isExpanded ? 'aspect-video' : 'aspect-video h-28'
    }`}>
      <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />
      <div className="absolute bottom-1 left-1 bg-black/70 px-2 py-1 rounded text-xs text-white">
        <User className="w-2 h-2 inline mr-1" />
        P{index + 1}
      </div>
    </div>
  );
}

export default VideoCall;