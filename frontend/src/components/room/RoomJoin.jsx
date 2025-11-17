import React from 'react';
import { Monitor, Users } from 'lucide-react';

function RoomJoin({ 
  roomId, 
  setRoomId, 
  username, 
  setUsername, 
  onJoin, 
  onCreateRoom 
}) {
  
  const handleJoinClick = () => {
    if (roomId.trim() && username.trim()) {
      onJoin();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleJoinClick();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-md w-full border border-purple-500/20">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500/20 rounded-full mb-4">
            <Monitor className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Collaborative Editor
          </h1>
          <p className="text-slate-400">
            Code together in real-time
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          
          {/* Username Input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter your name"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
              maxLength={20}
            />
          </div>

          {/* Room Code Input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Room Code
            </label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              placeholder="Enter 6-digit code"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 uppercase font-mono tracking-wider transition-all"
              maxLength={6}
            />
            {roomId && roomId.length < 6 && (
              <p className="text-xs text-slate-400 mt-1">
                Room code should be 6 characters
              </p>
            )}
          </div>

          {/* Join Button */}
          <button
            onClick={handleJoinClick}
            disabled={!roomId.trim() || !username.trim() || roomId.length < 6}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all transform hover:scale-[1.02] disabled:transform-none"
          >
            Join Room
          </button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-slate-800 text-slate-400">or</span>
            </div>
          </div>

          {/* Create Room Button */}
          <button
            onClick={onCreateRoom}
            className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
          >
            <Users className="w-5 h-5" />
            Create New Room
          </button>

          {/* Info text */}
          <div className="text-center text-xs text-slate-500 mt-4">
            Create a room and share the code with your team
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoomJoin;