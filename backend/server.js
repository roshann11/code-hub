// ============================================
// IMPORTS
// ============================================
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// ============================================
// CORS CONFIGURATION - CRITICAL FOR PRODUCTION
// ============================================
const allowedOrigins = [
  'http://localhost:5173',
  'https://code-96t8bkh39-roshann11s-projects.vercel.app',
  'https://code-hub-roshann11s-projects.vercel.app',
  // Allow all Vercel preview deployments
  /^https:\/\/code-hub-.*\.vercel\.app$/,
  /^https:\/\/.*-roshann11s-projects\.vercel\.app$/
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is allowed
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return allowed === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('❌ CORS blocked origin:', origin);
      callback(null, true); // Allow anyway for debugging - REMOVE IN PRODUCTION
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const httpServer = createServer(app);

// ============================================
// SOCKET.IO CONFIGURATION - CRITICAL FOR PRODUCTION
// ============================================
const io = new Server(httpServer, {
  cors: {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      
      const isAllowed = allowedOrigins.some(allowed => {
        if (allowed instanceof RegExp) return allowed.test(origin);
        return allowed === origin;
      });
      
      if (isAllowed) {
        callback(null, true);
      } else {
        console.log('❌ Socket.IO CORS blocked:', origin);
        callback(null, true); // Allow anyway for debugging
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["*"]
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

// ============================================
// DATA STORAGE
// ============================================
const rooms = new Map();

// ============================================
// REST API ENDPOINTS
// ============================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    activeRooms: rooms.size,
    aiProvider: 'Groq (FREE)',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// AI ASSISTANT ENDPOINT
// ============================================
app.post('/api/ai-assist', async (req, res) => {
  try {
    const { code, question } = req.body;
    
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question is required' });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ 
        error: 'Groq API key not configured',
        message: 'Please add GROQ_API_KEY to environment variables'
      });
    }

    console.log('🤖 AI Request received');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful coding assistant. Provide clear, concise answers.'
          },
          {
            role: 'user',
            content: `Code:\n\`\`\`\n${code || 'No code provided'}\n\`\`\`\n\nQuestion: ${question}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || 'No response generated';

    console.log('✅ AI Response generated');

    res.json({ 
      response: responseText,
      success: true,
      model: 'llama-3.1-70b-versatile',
      provider: 'Groq'
    });

  } catch (error) {
    console.error('❌ AI Error:', error.message);
    res.status(500).json({ 
      error: 'AI request failed',
      message: error.message
    });
  }
});

// ============================================
// CODE EXECUTION ENDPOINT
// ============================================
app.post('/api/execute-code', async (req, res) => {
  try {
    const { code, language } = req.body;
    
    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const languageMap = {
      'javascript': 'javascript',
      'typescript': 'typescript',
      'python': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'csharp': 'csharp',
      'go': 'go',
      'rust': 'rust',
      'php': 'php',
      'ruby': 'ruby',
      'sql': 'sqlite3'
    };

    const pistonLanguage = languageMap[language] || language;

    const response = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: pistonLanguage,
        version: '*',
        files: [{ name: 'main', content: code }],
        stdin: '',
        args: [],
        compile_timeout: 10000,
        run_timeout: 3000
      })
    });

    const data = await response.json();

    res.json({
      success: true,
      stdout: data.run?.stdout || '',
      stderr: data.run?.stderr || '',
      output: data.run?.output || '',
      exitCode: data.run?.code || 0,
      language: pistonLanguage
    });

  } catch (error) {
    console.error('❌ Execution Error:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Code execution failed',
      message: error.message
    });
  }
});

// ============================================
// SOCKET.IO EVENTS
// ============================================

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);
  
  socket.on('join-room', ({ roomId, username }) => {
    console.log(`👤 ${username} joining room: ${roomId}`);
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        code: '// Welcome to the collaborative editor!\n// Start coding together...\n\n',
        language: 'javascript',
        users: new Map(),
        chatHistory: [],
        createdAt: new Date()
      });
    }
    
    const room = rooms.get(roomId);
    room.users.set(socket.id, { username, socketId: socket.id });
    
    socket.emit('room-state', {
      code: room.code,
      language: room.language,
      users: Array.from(room.users.values()),
      chatHistory: room.chatHistory
    });
    
    socket.to(roomId).emit('user-joined', {
      username,
      socketId: socket.id,
      users: Array.from(room.users.values())
    });
  });

  socket.on('code-change', ({ roomId, code }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.code = code;
      socket.to(roomId).emit('code-update', { code });
    }
  });

  socket.on('language-change', ({ roomId, language }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.language = language;
      io.to(roomId).emit('language-update', { language });
    }
  });

  socket.on('chat-message', ({ roomId, message, username }) => {
    const room = rooms.get(roomId);
    if (room) {
      const chatMessage = {
        id: Date.now(),
        username,
        message,
        timestamp: new Date()
      };
      room.chatHistory.push(chatMessage);
      io.to(roomId).emit('new-message', chatMessage);
    }
  });

// ============================================
// WEBRTC SIGNALING EVENTS (UPDATED FOR PRODUCTION)
// ============================================

// WebRTC with PeerJS
socket.on('join-video-call', ({ roomId, peerId }) => {
  console.log(` ${peerId} joining video call in room ${roomId}`);
  
  const room = rooms.get(roomId);
  if (room) {
    // Notify all other users about the new peer
    socket.to(roomId).emit('user-joined-video-call', { peerId });
  }
});

// Initiator sends offer to receiver
socket.on('sending-signal', ({ userToSignal, signal, callerID }) => {
  console.log(` Sending signal from ${callerID} to ${userToSignal}`);
  io.to(userToSignal).emit('user-joined-video', { 
    signal, 
    callerID 
  });
});

// Receiver sends answer back to initiator
socket.on('returning-signal', ({ signal, callerID }) => {
  console.log(` Returning signal to ${callerID} from ${socket.id}`);
  io.to(callerID).emit('receiving-returned-signal', { 
    signal, 
    id: socket.id 
  });
});

// User leaves video call
socket.on('leave-video-call', ({ roomId }) => {
  console.log(` ${socket.id} leaving video call`);
  socket.to(roomId).emit('user-left-video', { peerId: socket.id });
});

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    rooms.forEach((room, roomId) => {
      if (room.users.has(socket.id)) {
        const user = room.users.get(socket.id);
        room.users.delete(socket.id);
        
        io.to(roomId).emit('user-left', {
          socketId: socket.id,
          username: user.username,
          users: Array.from(room.users.values())
        });
        
        io.to(roomId).emit('user-left-video', { userId: socket.id });
        
        if (room.users.size === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log('\n🚀 ========================================');
  console.log(`   Server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('   ========================================\n');
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
});