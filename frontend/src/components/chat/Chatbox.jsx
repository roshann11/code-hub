import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send } from 'lucide-react';

function ChatBox({ socket, roomId, username }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    // Load initial chat history
    socket.on('room-state', ({ chatHistory }) => {
      if (chatHistory) {
        setMessages(chatHistory);
      }
    });

    // Listen for new messages
    socket.on('new-message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    return () => {
      socket.off('room-state');
      socket.off('new-message');
    };
  }, [socket]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    
    if (inputMessage.trim() && socket) {
      socket.emit('chat-message', {
        roomId,
        message: inputMessage.trim(),
        username
      });
      setInputMessage('');
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-800">
      
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-purple-400" />
        <h3 className="text-white font-semibold">Chat</h3>
        <span className="text-xs text-slate-400 ml-auto">
          {messages.length} {messages.length === 1 ? 'message' : 'messages'}
        </span>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-slate-500 text-sm py-8">
            No messages yet. Start the conversation! 👋
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id}
              className={`rounded-lg p-3 ${
                msg.username === username 
                  ? 'bg-purple-600/20 ml-4' 
                  : 'bg-slate-700/50 mr-4'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`font-semibold text-sm ${
                  msg.username === username 
                    ? 'text-purple-300' 
                    : 'text-purple-400'
                }`}>
                  {msg.username}
                  {msg.username === username && (
                    <span className="text-xs text-slate-400 ml-1">(You)</span>
                  )}
                </span>
                <span className="text-xs text-slate-500">
                  {formatTime(msg.timestamp)}
                </span>
              </div>
              <p className="text-slate-200 text-sm whitespace-pre-wrap break-words">
                {msg.message}
              </p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            maxLength={500}
          />
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
            title="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

export default ChatBox;