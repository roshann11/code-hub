
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
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
      model: "llama-3.1-70b-versatile", // Fast, free, and powerful!
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
      model: 'llama-3.1-70b-versatile',
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
    console.log('User disconnected:', socket.id);
    
    // Find and remove user from all rooms
    rooms.forEach((room, roomId) => {
      if (room.users.has(socket.id)) {
        const user = room.users.get(socket.id);
        room.users.delete(socket.id);
        
        // Notify other users
        io.to(roomId).emit('user-left', {
          socketId: socket.id,
          username: user.username,
          users: Array.from(room.users.values())
        });
        
        console.log(`Room ${roomId} now has ${room.users.size} user(s)`);
        
        // Clean up empty rooms
        if (room.users.size === 0) {
          rooms.delete(roomId);
          console.log(`Deleted empty room: ${roomId}`);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log('\n========================================');
  console.log(`\nServer running on port ${PORT}\n`);
  console.log(`   AI Provider: Groq (FREE & Fast!)`);
  console.log(`   Model: llama-3.1-70b-versatile`);
  console.log('   ========================================\n');
});
// Error handling
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});