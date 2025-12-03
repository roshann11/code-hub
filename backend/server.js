
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';

dotenv.config();

const app = express();
const allowedOrigins = [
  'http://localhost:5173',
  'https://code-96t8bkh39-roshann11s-projects.vercel.app',
  'https://code-hub-roshann11s-projects.vercel.app', // Vercel also creates this
  /https:\/\/.*\.vercel\.app$/ // Allow all Vercel preview deployments
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) return allowed.test(origin);
      return allowed === origin;
    })) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

const httpServer = createServer(app);



// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:5173","https://code-ml0y7046j-roshann11s-projects.vercel.app"],
    methods: ["GET", "POST"]
  }
});

// ============================================
// MODULE 2: ROOM STORAGE
// ============================================

// Store active rooms
const rooms = new Map();
/*
Room structure:
{
  roomId: {
    code: string,
    language: string,
    users: Map<socketId, { username, socketId }>,
    chatHistory: [],
    createdAt: Date
  }
}
*/

// Groq AI client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// ============================================
// REST API ENDPOINTS
// ============================================

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Server is running',
    activeRooms: rooms.size
  });
});

// ============================================
// MODULE 5: AI ASSISTANT ENDPOINT (GROQ)
// ============================================
app.post('/api/ai-assist', async (req, res) => {
  try {
    const { code, question } = req.body;
    
    // Validate input
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question is required' });
    }

    console.log('🤖 AI Request received:', { 
      questionLength: question.length,
      hasCode: !!code 
    });

    // Call Groq API with Llama 3
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful coding assistant. Provide clear, concise, and accurate answers about code. Format your responses in a readable way."
        },
        {
          role: "user",
          content: `I'm working on this code:

\`\`\`
${code || 'No code provided yet'}
\`\`\`

Question: ${question}

Please provide a clear and helpful response.`
        }
      ],
      model: "llama-3.3-70b-versatile", // Fast, free, and powerful!
      temperature: 0.7,
      max_tokens: 1024,
      top_p: 1,
      stream: false
    });

    // Extract response
    const responseText = chatCompletion.choices[0]?.message?.content || 'No response generated';

    console.log('✅ AI Response generated successfully');

    res.json({ 
      response: responseText,
      success: true,
      model: 'llama-3.3-70b-versatile',
      provider: 'Groq'
    });

  } catch (error) {
    console.error('❌ AI Error:', error.message);
    
    // Better error messages
    let errorMessage = 'AI request failed';
    
    if (error.message.includes('API key')) {
      errorMessage = 'Invalid or missing Groq API key. Please check your .env file.';
    } else if (error.message.includes('rate limit')) {
      errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
    } else if (error.message.includes('network')) {
      errorMessage = 'Network error. Please check your internet connection.';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      message: error.message,
      provider: 'Groq'
    });
  }
});

// ============================================
// CODE EXECUTION ENDPOINT
// ============================================
app.post('/api/execute-code', async (req, res) => {
  try {
    const { code, language } = req.body;
    
    // Validate input
    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Code is required' });
    }
    
    if (!language) {
      return res.status(400).json({ error: 'Language is required' });
    }

    console.log('🚀 Executing code:', { language, codeLength: code.length });

    // Map frontend language names to Piston API language names
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
      'sql': 'sqlite3',
      'bash': 'bash',
      'r': 'r',
      'kotlin': 'kotlin',
      'swift': 'swift'
    };

    const pistonLanguage = languageMap[language] || language;

    // Call Piston API
    const response = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language: pistonLanguage,
        version: '*', // Use latest version
        files: [
          {
            name: `main.${getFileExtension(language)}`,
            content: code
          }
        ],
        stdin: '',
        args: [],
        compile_timeout: 10000,
        run_timeout: 3000,
        compile_memory_limit: -1,
        run_memory_limit: -1
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Execution failed');
    }

    console.log('✅ Code executed successfully');

    // Format output
    const output = {
      success: true,
      stdout: data.run?.stdout || '',
      stderr: data.run?.stderr || '',
      output: data.run?.output || '',
      exitCode: data.run?.code || 0,
      executionTime: data.run?.time || 0,
      language: pistonLanguage,
      version: data.version || 'unknown'
    };

    res.json(output);

  } catch (error) {
    console.error('❌ Execution Error:', error.message);
    res.status(500).json({ 
      success: false,
      error: 'Code execution failed',
      message: error.message,
      stderr: error.message
    });
  }
});

// Helper function to get file extension
function getFileExtension(language) {
  const extensions = {
    'javascript': 'js',
    'typescript': 'ts',
    'python': 'py',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'csharp': 'cs',
    'go': 'go',
    'rust': 'rs',
    'php': 'php',
    'ruby': 'rb',
    'sql': 'sql',
    'bash': 'sh',
    'r': 'r',
    'kotlin': 'kt',
    'swift': 'swift'
  };
  return extensions[language] || 'txt';
}

// ============================================
// MODULE 2: SOCKET EVENTS FOR ROOMS
// ============================================

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // JOIN ROOM EVENT
  socket.on('join-room', ({ roomId, username }) => {
    console.log(`${username} joining room: ${roomId}`);
    
    // Join the socket.io room
    socket.join(roomId);
    
    // Create room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        code: '// Welcome to the collaborative editor!\n// Start coding together...\n\n',
        language: 'javascript',
        users: new Map(),
        chatHistory: [],
        createdAt: new Date()
      });
      console.log(`Created new room: ${roomId}`);
    }
    
    const room = rooms.get(roomId);
    
    // Add user to room
    room.users.set(socket.id, { 
      username, 
      socketId: socket.id 
    });
    
    // Send current room state to the new user
    socket.emit('room-state', {
      code: room.code,
      language: room.language,
      users: Array.from(room.users.values()),
      chatHistory: room.chatHistory
    });
    
    // Notify other users in the room
    socket.to(roomId).emit('user-joined', {
      username,
      socketId: socket.id,
      users: Array.from(room.users.values())
    });

    console.log(`Room ${roomId} now has ${room.users.size} user(s)`);
  });

    socket.on('code-change', ({ roomId, code }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.code = code;
      // Broadcast to all other users in the room (not sender)
      socket.to(roomId).emit('code-update', { code });
      console.log(`📝 Code updated in room ${roomId}`);
    }
  });

  // LANGUAGE CHANGE EVENT
  socket.on('language-change', ({ roomId, language }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.language = language;
      // Broadcast to all users in the room (including sender)
      io.to(roomId).emit('language-update', { language });
      console.log(`🔤 Language changed to ${language} in room ${roomId}`);
    }
  });

// CHAT MESSAGE EVENT
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
    
    // Send to all users in the room (including sender)
    io.to(roomId).emit('new-message', chatMessage);
    
    console.log(` Message in ${roomId} from ${username}`);
  }
});

  // CURSOR POSITION EVENT (optional - for showing where others are typing)
  socket.on('cursor-position', ({ roomId, position, username }) => {
    socket.to(roomId).emit('cursor-update', { 
      socketId: socket.id,
      position, 
      username 
    });
  });
  
  // DISCONNECT EVENT
  socket.on('disconnect', () => {
  console.log('❌ User disconnected:', socket.id);
  
  rooms.forEach((room, roomId) => {
    if (room.users.has(socket.id)) {
      const user = room.users.get(socket.id);
      room.users.delete(socket.id);
      
      io.to(roomId).emit('user-left', {
        socketId: socket.id,
        username: user.username,
        users: Array.from(room.users.values())
      });
      
      // Notify video call participants
      io.to(roomId).emit('user-left-video', { userId: socket.id });
      
      if (room.users.size === 0) {
        rooms.delete(roomId);
        console.log(`Deleted empty room: ${roomId}`);
      }
    }
  });
});

// ============================================
// MODULE 6: WEBRTC SIGNALING EVENTS
// ============================================

// User requests to join video call
socket.on('join-video-call', ({ roomId }) => {
  console.log(`📹 ${socket.id} joining video call in room ${roomId}`);
  
  const room = rooms.get(roomId);
  if (room) {
    // Get all other users in the room
    const otherUsers = Array.from(room.users.values())
      .filter(user => user.socketId !== socket.id)
      .map(user => user.socketId);
    
    // Send list of other users to the new caller
    socket.emit('all-users', { users: otherUsers });
  }
});

// WebRTC Offer (Initiator sends offer to receiver)
socket.on('sending-signal', ({ userToSignal, signal, callerID }) => {
  console.log(`📹 Sending signal from ${callerID} to ${userToSignal}`);
  io.to(userToSignal).emit('user-joined-video', { signal, callerID });
});

// WebRTC Answer (Receiver sends answer back to initiator)
socket.on('returning-signal', ({ signal, callerID }) => {
  console.log(`📹 Returning signal to ${callerID}`);
  io.to(callerID).emit('receiving-returned-signal', { signal, id: socket.id });
});

// User leaves video call
socket.on('leave-video-call', ({ roomId }) => {
  console.log(`📹 ${socket.id} leaving video call`);
  const room = rooms.get(roomId);
  if (room) {
    socket.to(roomId).emit('user-left-video', { userId: socket.id });
  }
});
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log('\n========================================');
  console.log(`\nServer running on port ${PORT}\n`);
  console.log(`   AI Provider: Groq (FREE & Fast!)`);
  console.log(`   Model: llama-3.3-70b-versatile`);
  console.log('   ========================================\n');
});
// Error handling
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});