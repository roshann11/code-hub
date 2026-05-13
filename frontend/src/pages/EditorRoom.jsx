import React, { useState, useEffect, useRef } from 'react';
import { Monitor, Users, Copy, Check, Download, MessageSquare, X, Bot, Video, Play, LogOut } from 'lucide-react';
import { io } from 'socket.io-client';
import CodeEditor from '../components/editor/CodeEditor';
import FileTabs from '../components/editor/FileTabs';
import LanguageSelector from '../components/editor/LanguageSelector';
import ChatBox from '../components/chat/Chatbox';
import AIAssistant from '../components/ai/AIAssistant';
import VideoCall from '../components/video/VideoCall';
import CodeOutput from '../components/editor/CodeOutput';
import {
  defaultMainPath,
  normalizeFilesPayload,
  pathToMonacoLanguage,
  sanitizeFilePath,
  uniquePath,
  welcomeForLanguage,
} from '../utils/projectFiles';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function EditorRoom({ roomId, username, onLeaveRoom }) {
  const [socket, setSocket] = useState(null);
  const [users, setUsers] = useState([]);
  const [copied, setCopied] = useState(false);
  const [connected, setConnected] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  
  // Project + editor
  const [files, setFiles] = useState([]);
  const [activePath, setActivePath] = useState('');
  const [language, setLanguage] = useState('javascript');
  const isRemoteChange = useRef(false);

  // Admin state
  const [isAdmin, setIsAdmin] = useState(false);

  // UI state
  const [showChat, setShowChat] = useState(false);

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
    newSocket.on('room-state', ({ files: roomFiles, language: roomLanguage, users: roomUsers, isAdmin: admin }) => {
      console.log('Received room state');
      const list = normalizeFilesPayload(roomFiles);
      const resolved =
        list.length > 0
          ? list
          : [{ path: defaultMainPath(roomLanguage || 'javascript'), content: welcomeForLanguage(roomLanguage || 'javascript') }];
      setFiles(resolved);
      setLanguage(roomLanguage || 'javascript');
      setActivePath((prev) =>
        prev && resolved.some((f) => f.path === prev) ? prev : resolved[0].path
      );
      setUsers(roomUsers);
      setIsAdmin(admin);
    });

    newSocket.on('user-joined', ({ username: newUser, users: updatedUsers }) => {
      console.log(`${newUser} joined the room`);
      setUsers(updatedUsers);
    });

    newSocket.on('user-left', ({ username: leftUser, users: updatedUsers }) => {
      console.log(`${leftUser} left the room`);
      setUsers(updatedUsers);
    });

    // Multi-file sync
    newSocket.on('files-update', ({ files: incoming }) => {
      const list = normalizeFilesPayload(incoming);
      if (!list.length) return;
      console.log('Received files update');
      isRemoteChange.current = true;
      setFiles(list);
      setActivePath((prev) =>
        prev && list.some((f) => f.path === prev) ? prev : list[0].path
      );
    });

    newSocket.on('language-update', ({ language: newLanguage }) => {
      console.log('Language updated to:', newLanguage);
      setLanguage(newLanguage);
    });

    newSocket.on('room-deleted', ({ message }) => {
      alert(message);
      try {
        sessionStorage.removeItem('coders-hub-session');
      } catch {
        /* ignore */
      }
      window.location.href = '/'; // Redirect to home
    });

    // Cleanup
    return () => {
      newSocket.close();
    };
  }, [roomId, username]);

  const emitFiles = (nextFiles) => {
    setFiles(nextFiles);
    if (socket && socket.connected) {
      socket.emit('files-change', { roomId, files: nextFiles });
    }
  };

  const handleCodeChange = (newCode) => {
    if (isRemoteChange.current) {
      isRemoteChange.current = false;
      return;
    }
    if (!activePath) return;
    const next = files.map((f) =>
      f.path === activePath ? { ...f, content: newCode } : f
    );
    emitFiles(next);
  };

  const handleSelectFile = (path) => {
    setActivePath(path);
  };

  const handleAddFile = () => {
    const suggested = uniquePath(
      defaultMainPath(language),
      files.map((f) => f.path)
    );
    const rawName = window.prompt(
      'New file path (e.g. utils.js or helpers/math.py)',
      suggested
    );
    if (rawName === null) return;
    const path = sanitizeFilePath(rawName) || suggested;
    if (files.some((f) => f.path === path)) {
      alert('A file with that path already exists.');
      return;
    }
    const snippet = welcomeForLanguage(language);
    const next = [...files, { path, content: snippet }];
    setActivePath(path);
    emitFiles(next);
  };

  const handleDeleteFile = (path) => {
    if (files.length <= 1) {
      alert('Keep at least one file in the project.');
      return;
    }
    if (!confirm(`Remove "${path}" from this project?`)) return;
    const next = files.filter((f) => f.path !== path);
    const nextActive =
      path === activePath ? next[0].path : activePath;
    setActivePath(nextActive);
    emitFiles(next);
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
    const file = files.find((f) => f.path === activePath) || files[0];
    if (!file) return;

    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safe = file.path.replace(/[/\\]/g, '-');
    a.download = `${roomId}-${safe}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const leaveRoom = () => {
    if (!confirm('Leave this room? You can join again later with the room code.')) return;
    onLeaveRoom?.();
  };

  const deleteRoom = async () => {
    if (!confirm('Are you sure you want to delete this room? This action cannot be undone.')) return;
    
    try {
      const response = await fetch(`${SOCKET_URL}/api/rooms/${roomId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      
      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to delete room');
      }
    } catch (error) {
      console.error('Error deleting room:', error);
      alert('Failed to delete room');
    }
  };

  const activeFile = files.find((f) => f.path === activePath);
  const editorCode =
    files.length === 0 ? '// Connecting…' : activeFile?.content ?? '// Select a file';
  const monacoLanguage = pathToMonacoLanguage(activePath || activeFile?.path || 'file.txt');

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
          
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[10px] text-slate-500 hidden lg:block max-w-[140px] text-right leading-tight">
              New-file template
            </span>
            <LanguageSelector
              language={language}
              onLanguageChange={handleLanguageChange}
            />
          </div>

          {/* Download Code */}
          <button
            onClick={downloadCode}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-white text-sm"
            title="Download active file"
          >
            <Download className="w-4 h-4" />
            <span className="hidden md:inline">Download</span>
          </button>

          {/* Run Code Button */}
<button
  onClick={() => setShowOutput(!showOutput)}
  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-white text-sm ${
    showOutput 
      ? 'bg-green-600 hover:bg-green-700' 
      : 'bg-slate-700 hover:bg-slate-600'
  }`}
  title="Run code"
>
  <Play className="w-4 h-4" />
  <span className="hidden md:inline">Run</span>
</button>

          {/* Chat Toggle */}
          <button
            onClick={() => setShowChat(!showChat)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-white text-sm ${
              showChat 
                ? 'bg-purple-600 hover:bg-purple-700' 
                : 'bg-slate-700 hover:bg-slate-600'
            }`}
            title="Toggle chat">
            <MessageSquare className="w-4 h-4" />
            <span className="hidden md:inline">Chat</span>
          </button>

          {/* AI Assistant Toggle */}
          <button
  onClick={() => setShowAI(!showAI)}
  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-white text-sm ${
    showAI 
      ? 'bg-purple-600 hover:bg-purple-700' 
      : 'bg-slate-700 hover:bg-slate-600'
  }`}
  title="Toggle AI Assistant (Powered by Groq - FREE)"
>
  <Bot className="w-4 h-4" />
  <span className="hidden md:inline">AI</span>
          </button>

          {/* Video Call Toggle */}
<button
  onClick={() => setShowVideo(!showVideo)}
  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-white text-sm ${
    showVideo 
      ? 'bg-purple-600 hover:bg-purple-700' 
      : 'bg-slate-700 hover:bg-slate-600'
  }`}
  title="Toggle video call"
>
  <Video className="w-4 h-4" />
  <span className="hidden md:inline">Video</span>
</button>

          {/* Leave Room — available to everyone */}
          <button
            type="button"
            onClick={leaveRoom}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-white text-sm"
            title="Leave room"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline">Leave Room</span>
          </button>

          {/* Delete Room (Admin only) */}
          {isAdmin && (
            <button
              onClick={deleteRoom}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-white text-sm"
              title="Delete room (Admin only)"
            >
              <X className="w-4 h-4" />
              <span className="hidden md:inline">Delete Room</span>
            </button>
          )}

          {/* Connection indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded-lg">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-xs text-slate-300 hidden md:inline">
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

      {/* Main Content - Editor + Sidebars */}
<div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
  
  {/* Code Editor + file tabs */}
  <div className="flex-1 min-w-0 min-h-0 flex flex-col">
    <FileTabs
      files={files}
      activePath={activePath}
      onSelect={handleSelectFile}
      onAdd={handleAddFile}
      onDelete={handleDeleteFile}
    />
    <div className="flex-1 min-h-0">
      <CodeEditor
        key={`${roomId}-${activePath}`}
        code={editorCode}
        language={monacoLanguage}
        onChange={handleCodeChange}
      />
    </div>
  </div>

  {/* Right Side Panels Container */}
  <div className="flex flex-col lg:flex-row border-t lg:border-t-0 lg:border-l border-slate-700 max-h-96 lg:max-h-full">
    
    {/* AI Assistant Panel */}
    {showAI && (
      <div className="lg:w-96 w-full h-full border-b lg:border-b-0 lg:border-l border-slate-700 flex-shrink-0">
        <AIAssistant files={files} />
      </div>
    )}

    {/* Chat Panel */}
    {showChat && (
      <div className="lg:w-80 w-full h-full border-b lg:border-b-0 lg:border-l border-slate-700 flex-shrink-0">
        <ChatBox 
          socket={socket}
          roomId={roomId}
          username={username}
        />
      </div>
    )}

    {/* Users Sidebar */}
    <div className="lg:w-64 w-full bg-slate-800 border-l border-slate-700 p-4 overflow-y-auto flex-shrink-0">
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
        <code className="text-purple-400 font-mono text-sm font-semibold break-all">
          {roomId}
        </code>
        <p className="text-xs text-slate-500 mt-2">
          Share this code with others to collaborate
        </p>
      </div>
    </div>
  </div>
</div>

{/* Output Panel - Below Editor */}
  {showOutput && (
    <CodeOutput files={files} entryPath={activePath} />
  )}
  
{/* Video Call Panel*/}
    {showVideo && (
      <VideoCall 
        socket={socket}
        roomId={roomId}
        username={username}
      />
    )}
    </div>
  );
}

export default EditorRoom;