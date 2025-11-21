import React, { useState, useEffect, useRef } from 'react';
import { Monitor, Users, Copy, Check, Download, Play } from 'lucide-react';
import { io } from 'socket.io-client';
import CodeEditor from '../components/editor/CodeEditor';
import LanguageSelector from '../components/editor/LanguageSelector';

const SOCKET_URL = 'http://localhost:3001';

function EditorRoom({ roomId, username }) {
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(false);
  
  // Editor state
  const [code, setCode] = useState('// Loading...');
  const [language, setLanguage] = useState('javascript');
  const isRemoteChange = useRef(false);

  useEffect(() => {
    // Create socket connection
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    // Connection events
    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
      newSocket.emit('join-room', { roomId, username });
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    // Room events
    newSocket.on('room-state', ({ code: roomCode, language: roomLanguage, users: roomUsers }) => {
      console.log('Received room state');
      setCode(roomCode);
      setLanguage(roomLanguage);
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

    // Code editor events
    newSocket.on('code-update', ({ code: newCode }) => {
      console.log('Received code update');
      isRemoteChange.current = true;
      setCode(newCode);
    });

    newSocket.on('language-update', ({ language: newLanguage }) => {
      console.log('Language updated to:', newLanguage);
      setLanguage(newLanguage);
    });

    // Cleanup
    return () => {
      newSocket.close();
    };
  }, [roomId, username]);

  const handleCodeChange = (newCode) => {
    // If this is a remote change, don't emit it back
    if (isRemoteChange.current) {
      isRemoteChange.current = false;
      return;
    }

    setCode(newCode);
    if (socket && socket.connected) {
      socket.emit('code-change', { roomId, code: newCode });
    }
  };

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
    if (socket && socket.connected) {
      socket.emit('language-change', { roomId, language: newLanguage });
    }
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCode = () => {
    const extensions = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      csharp: 'cs',
      go: 'go',
      rust: 'rs',
      php: 'php',
      ruby: 'rb',
      html: 'html',
      css: 'css',
      json: 'json',
      markdown: 'md',
      sql: 'sql',
    };

    const extension = extensions[language] || 'txt';
    const blob = new Blob([code], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code-${roomId}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
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

        {/* Right side - Controls & Status */}
        <div className="flex items-center gap-3">
          
          {/* Language Selector */}
          <LanguageSelector 
            language={language}
            onLanguageChange={handleLanguageChange}
          />

          {/* Download Code */}
          <button
            onClick={downloadCode}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-white text-sm"
            title="Download code"
          >
            <Download className="w-4 h-4" />
            <span className="hidden md:inline">Download</span>
          </button>

          {/* Connection indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded-lg">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-xs text-slate-300">
              {connected ? 'Connected' : 'Connecting...'}
            </span>
          </div>

          {/* Users count */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded-lg">
            <Users className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-white font-medium">
              {users.length}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content - Editor + Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Code Editor */}
        <div className="flex-1">
          <CodeEditor 
            code={code}
            language={language}
            onChange={handleCodeChange}
          />
        </div>

        {/* Users Sidebar */}
        <div className="w-64 bg-slate-800 border-l border-slate-700 p-4 overflow-y-auto">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            Active Users ({users.length})
          </h3>
          <div className="space-y-2">
            {users.map((user) => (
              <div 
                key={user.socketId}
                className="flex items-center gap-3 p-2 bg-slate-700/50 rounded-lg"
              >
                <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                  <span className="text-purple-400 font-semibold text-sm">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-white text-sm block truncate">
                    {user.username}
                  </span>
                  {user.username === username && (
                    <span className="text-xs text-purple-400">(You)</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Room Info */}
          <div className="mt-6 p-3 bg-slate-700/30 rounded-lg border border-slate-700">
            <p className="text-xs text-slate-400 mb-2">Room Code</p>
            <code className="text-purple-400 font-mono text-sm font-semibold">
              {roomId}
            </code>
            <p className="text-xs text-slate-500 mt-2">
              Share this code with others to collaborate
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditorRoom;