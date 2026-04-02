import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Room from './src/models/Room.js';

dotenv.config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/codershub';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const app = express();


// CORS CONFIGURATION 
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
      console.log('CORS blocked origin:', origin);
      callback(null, true); // Allow anyway for debugging - REMOVE IN PRODUCTION
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const httpServer = createServer(app);

// SOCKET.IO CONFIGURATION 
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
        console.log('Socket.IO CORS blocked:', origin);
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

// DATA STORAGE

const activeRooms = new Map(); // roomId -> { users: Map(socketId -> user), isFirstUser: boolean }

// REST API ENDPOINTS

// Delete room endpoint
app.delete('/api/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { username } = req.body; // Assume username is sent in body
    
    const room = await Room.findOne({ roomId: roomId.toUpperCase() });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    if (room.adminUsername !== username) {
      return res.status(403).json({ error: 'Only the admin can delete the room' });
    }
    
    await Room.deleteOne({ roomId: roomId.toUpperCase() });
    
    // Notify users in the room
    io.to(roomId).emit('room-deleted', { message: 'Room has been deleted by admin' });
    
    res.json({ success: true, message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    activeRooms: activeRooms.size,
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

    console.log('AI Request received');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
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

    console.log('AI Response generated');

    res.json({ 
      response: responseText,
      success: true,
      model: 'llama-3.3-70b-versatile',
      provider: 'Groq'
    });

  } catch (error) {
    console.error('AI Error:', error.message);
    res.status(500).json({ 
      error: 'AI request failed',
      message: error.message
    });
  }
});

// CODE EXECUTION ENDPOINT

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
    console.error('Execution Error:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Code execution failed',
      message: error.message
    });
  }
});


// SOCKET.IO EVENTS

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-room', async ({ roomId, username }) => {
    try {
      console.log(` ${username} joining room: ${roomId}`);
      socket.join(roomId);
      
      let room = await Room.findOne({ roomId: roomId.toUpperCase() });
      let isFirstUser = false;
      
      if (!room) {
        // Create new room
        room = new Room({
          roomId: roomId.toUpperCase(),
          adminUsername: username
        });
        await room.save();
        isFirstUser = true;
        console.log(`Created new room: ${roomId} with admin: ${username}`);
      }
      
      // Initialize active room if not exists
      if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, {
          users: new Map(),
          isFirstUser: isFirstUser
        });
      }
      
      const activeRoom = activeRooms.get(roomId);
      activeRoom.users.set(socket.id, { username, socketId: socket.id });
      
      socket.emit('room-state', {
        code: room.code,
        language: room.language,
        users: Array.from(activeRoom.users.values()),
        chatHistory: room.chatHistory,
        isAdmin: username === room.adminUsername
      });
      
      socket.to(roomId).emit('user-joined', {
        username,
        socketId: socket.id,
        users: Array.from(activeRoom.users.values())
      });
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  socket.on('code-change', async ({ roomId, code }) => {
    try {
      const room = await Room.findOne({ roomId: roomId.toUpperCase() });
      if (room) {
        room.code = code;
        await room.save();
        socket.to(roomId).emit('code-update', { code });
      }
    } catch (error) {
      console.error('Error saving code:', error);
    }
  });

  socket.on('language-change', async ({ roomId, language }) => {
    try {
      const room = await Room.findOne({ roomId: roomId.toUpperCase() });
      if (room) {
        room.language = language;
        await room.save();
        io.to(roomId).emit('language-update', { language });
      }
    } catch (error) {
      console.error('Error saving language:', error);
    }
  });

  socket.on('chat-message', async ({ roomId, message, username }) => {
    try {
      const room = await Room.findOne({ roomId: roomId.toUpperCase() });
      if (room) {
        const chatMessage = {
          id: Date.now(),
          username,
          message,
          timestamp: new Date()
        };
        room.chatHistory.push(chatMessage);
        await room.save();
        io.to(roomId).emit('new-message', chatMessage);
      }
    } catch (error) {
      console.error('Error saving chat message:', error);
    }
  });

// WebRTC with PeerJS
socket.on('join-video-call', ({ roomId, peerId }) => {
  console.log(` ${peerId} joining video call in room ${roomId}`);
  
  const activeRoom = activeRooms.get(roomId);
  if (activeRoom) {
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
    
    activeRooms.forEach((activeRoom, roomId) => {
      if (activeRoom.users.has(socket.id)) {
        const user = activeRoom.users.get(socket.id);
        activeRoom.users.delete(socket.id);
        
        io.to(roomId).emit('user-left', {
          socketId: socket.id,
          username: user.username,
          users: Array.from(activeRoom.users.values())
        });
        
        io.to(roomId).emit('user-left-video', { userId: socket.id });
        
        if (activeRoom.users.size === 0) {
          activeRooms.delete(roomId);
        }
      }
    });
  });
});

// START SERVER
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`   Server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});