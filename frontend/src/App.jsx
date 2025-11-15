import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3001';

function App() {
  const [connected, setConnected] = useState(false);
  const [socketId, setSocketId] = useState('');

  useEffect(() => {
    // Create socket connection
    const socket = io(SOCKET_URL);

    socket.on('connect', () => {
      console.log('Connected to server!');
      setConnected(true);
      setSocketId(socket.id);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
      setSocketId('');
    });

    // Cleanup on unmount
    return () => {
      socket.close();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-md w-full border border-purple-500/20">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">
          Connection Test
        </h1>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
            <span className="text-slate-300">Server Status:</span>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className={`font-semibold ${connected ? 'text-green-400' : 'text-red-400'}`}>
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          {connected && (
            <div className="p-4 bg-slate-700 rounded-lg">
              <span className="text-slate-300">Socket ID:</span>
              <p className="text-purple-400 font-mono text-sm mt-2 break-all">
                {socketId}
              </p>
            </div>
          )}

          <div className="text-center text-slate-400 text-sm mt-6">
            {connected 
              ? 'Backend connection successful!' 
              : 'Make sure backend is running on port 3001'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;