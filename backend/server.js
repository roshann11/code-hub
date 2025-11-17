
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

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
  console.log(`\nServer running on port ${PORT}\n`);
});