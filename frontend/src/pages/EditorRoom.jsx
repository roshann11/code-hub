import React, { useState, useEffect } from 'react';
import { Monitor, Users, Copy, Check } from 'lucide-react';
import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3001';

function EditorRoom({ roomId, username }) {
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Create socket connection
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    // Connection events
    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
      // Join the room
      newSocket.emit('join-room', { roomId, username });
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    // Room events
    newSocket.on('room-state', ({ users: roomUsers }) => {
      console.log('Received room state:', roomUsers);
      setUsers(roomUsers);
    });

    newSocket.on('user-joined', ({ username: newUser, users: updatedUsers }) => {
      console.log(`${newUser} joined the room`);
      setUsers(updatedUsers);
    });

    newSocket.on('user-left', ({ username: leftUser, users: updatedUsers }) => {
      console.log(`${leftUser} left the room`);
      setUsers(updatedUsers);
    });

    // Cleanup
    return () => {
      newSocket.close();
    };
  }, [roomId, username]);

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-screen bg-slate-900 flex flex-col">
      
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center justify-between">
        
        {/* Left side - Room info */}
        <div className="flex items-center gap-4">
          <Monitor className="w-6 h-6 text-purple-400" />
          <div>
            <h1 className="text-white font-semibold">Collaborative Editor</h1>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400">Room:</span>
              <code className="text-purple-400 font-mono font-semibold">
                {roomId}
              </code>
              <button
                onClick={copyRoomId}
                className="p-1 hover:bg-slate-700 rounded transition-colors"
                title="Copy room code"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right side - Connection status & Users */}
        <div className="flex items-center gap-4">
          
          {/* Connection indicator */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-xs text-slate-400">
              {connected ? 'Connected' : 'Connecting...'}
            </span>
          </div>

          {/* Users count */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded-lg">
            <Users className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-white font-medium">
              {users.length} online
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex items-center justify-center bg-slate-900">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-500/20 rounded-full">
            <Users className="w-10 h-10 text-purple-400" />
          </div>
          
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Welcome, {username}!
            </h2>
            <p className="text-slate-400">
              You're in room <span className="text-purple-400 font-mono">{roomId}</span>
            </p>
          </div>

          {/* Users List */}
          <div className="bg-slate-800 rounded-lg p-6 min-w-[300px] border border-slate-700">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              Active Users ({users.length})
            </h3>
            <div className="space-y-2">
              {users.length === 0 ? (
                <p className="text-slate-500 text-sm">No users yet...</p>
              ) : (
                users.map((user) => (
                  <div 
                    key={user.socketId}
                    className="flex items-center gap-3 p-2 bg-slate-700/50 rounded"
                  >
                    <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                      <span className="text-purple-400 font-semibold text-sm">
                        {user.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-white text-sm">{user.username}</span>
                    {user.username === username && (
                      <span className="text-xs text-purple-400 ml-auto">(You)</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <p className="text-slate-500 text-sm">
            Code editor coming in next module! 🚀
          </p>
        </div>
      </div>
    </div>
  );
}

export default EditorRoom;