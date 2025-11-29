import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, Sparkles, Loader, AlertCircle, Zap } from 'lucide-react';

const API_URL = 'http://localhost:3001';

function AIAssistant({ code }) {
  const [question, setQuestion] = useState('');
  const [conversation, setConversation] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const conversationEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const askAI = async (e) => {
    e.preventDefault();
    
    if (!question.trim() || loading) return;

    // Add user message
    const userMessage = { 
      type: 'user', 
      content: question,
      timestamp: new Date()
    };
    setConversation(prev => [...prev, userMessage]);
    
    const currentQuestion = question;
    setQuestion('');
    setLoading(true);
    setError(null);

    try {
      // Call backend AI endpoint
      const response = await fetch(`${API_URL}/api/ai-assist`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          code, 
          question: currentQuestion 
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get AI response');
      }

      // Add AI response
      const aiMessage = { 
        type: 'ai', 
        content: data.response,
        timestamp: new Date(),
        model: data.model,
        provider: data.provider
      };
      setConversation(prev => [...prev, aiMessage]);

    } catch (error) {
      console.error('AI request error:', error);
      setError(error.message);
      
      const errorMessage = { 
        type: 'error', 
        content: `Sorry, I encountered an error: ${error.message}`,
        timestamp: new Date()
      };
      setConversation(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      askAI(e);
    }
  };

  const clearConversation = () => {
    setConversation([]);
    setError(null);
    inputRef.current?.focus();
  };

  const quickPrompts = [
    "Explain this code",
    "Find any bugs",
    "Suggest improvements",
    "Add comments",
    "Optimize this code",
    "Convert to TypeScript"
  ];

  const handleQuickPrompt = (prompt) => {
    setQuestion(prompt);
    inputRef.current?.focus();
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-800">
      
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-400" />
            <h3 className="text-white font-semibold">AI Assistant</h3>
            <Sparkles className="w-4 h-4 text-yellow-400" />
          </div>
          {conversation.length > 0 && (
            <button
              onClick={clearConversation}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        
        {/* Groq Badge */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 rounded-full">
            <Zap className="w-3 h-3 text-green-400" />
            <span className="text-green-400 font-medium">Powered by Groq</span>
          </div>
          <span className="text-slate-500">100% FREE & Lightning Fast ⚡</span>
        </div>
      </div>

      {/* Conversation Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* Welcome Message */}
        {conversation.length === 0 && (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500/20 rounded-full mb-4">
              <Bot className="w-8 h-8 text-purple-400" />
            </div>
            <h4 className="text-white font-semibold mb-2">
              Ask me anything about your code!
            </h4>
            <p className="text-slate-400 text-sm mb-2">
              Powered by Groq's lightning-fast Llama 3.1 model
            </p>
            <p className="text-green-400 text-xs mb-6 flex items-center justify-center gap-1">
              <Zap className="w-3 h-3" />
              100% FREE • No limits • Super fast responses
            </p>
            
            {/* Quick Prompts */}
            <div className="space-y-2">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Quick prompts:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {quickPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickPrompt(prompt)}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Messages */}
        {conversation.map((msg, idx) => (
          <div
            key={idx}
            className={`rounded-lg p-4 ${
              msg.type === 'user'
                ? 'bg-purple-600/20 ml-8'
                : msg.type === 'error'
                ? 'bg-red-900/20 border border-red-700/50'
                : 'bg-slate-700/50 mr-8'
            }`}
          >
            {/* Message Header */}
            <div className="flex items-center gap-2 mb-2">
              {msg.type === 'ai' && (
                <>
                  <Bot className="w-4 h-4 text-purple-400" />
                  <Zap className="w-3 h-3 text-green-400" />
                </>
              )}
              {msg.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
              <span className={`font-semibold text-sm ${
                msg.type === 'user' ? 'text-purple-300' : 
                msg.type === 'error' ? 'text-red-400' : 
                'text-purple-400'
              }`}>
                {msg.type === 'user' ? 'You' : msg.type === 'error' ? 'Error' : 'AI Assistant'}
              </span>
              {msg.type === 'ai' && msg.provider && (
                <span className="text-xs text-green-400">({msg.provider})</span>
              )}
              <span className="text-xs text-slate-500 ml-auto">
                {formatTime(msg.timestamp)}
              </span>
            </div>
            
            {/* Message Content */}
            <div className="text-slate-200 text-sm whitespace-pre-wrap break-words leading-relaxed">
              {msg.content}
            </div>
          </div>
        ))}
        
        {/* Loading Indicator */}
        {loading && (
          <div className="bg-slate-700/50 rounded-lg p-4 mr-8">
            <div className="flex items-center gap-3">
              <Bot className="w-4 h-4 text-purple-400" />
              <Zap className="w-4 h-4 text-green-400" />
              <span className="text-sm text-purple-400 font-semibold">AI is thinking</span>
              <Loader className="w-4 h-4 text-purple-400 animate-spin" />
            </div>
            <p className="text-xs text-slate-400 mt-2">⚡ Groq's super-fast response incoming...</p>
          </div>
        )}
        
        <div ref={conversationEndRef} />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-2 bg-red-900/30 border-t border-red-700/50 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex flex-col gap-2">
          <textarea
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about your code... (Shift+Enter for new line)"
            rows="3"
            disabled={loading}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            maxLength={2000}
          />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-xs text-slate-500">
                Press Enter to send
              </p>
              <span className="text-xs text-slate-600">•</span>
              <p className="text-xs text-slate-500">
                {question.length}/2000
              </p>
            </div>
            <button
              onClick={askAI}
              disabled={loading || !question.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Thinking...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Ask AI
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIAssistant;
//console.groq.com/keys