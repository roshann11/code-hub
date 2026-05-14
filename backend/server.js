import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import crypto from 'crypto';
import Room from './src/models/Room.js';
// import { normalizeE164 } from './src/auth/phoneNormalize.js';
// import {
//   sendVerificationSms,
//   verifyOtp,
//   isTwilioConfigured,
// } from './src/auth/twilioVerify.js';
// import { signPhoneJwt, verifyPhoneJwt } from './src/auth/phoneJwt.js';

dotenv.config();

function hashAdminToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function generateAdminToken() {
  return crypto.randomBytes(32).toString('hex');
}

function normalizeDisplayName(username) {
  if (username == null) return '';
  const s = String(username).trim();
  if (!s || s.length > 40) return '';
  return s;
}

const MAIN_BY_LANG = {
  javascript: 'main.js',
  typescript: 'main.ts',
  python: 'main.py',
  java: 'Main.java',
  cpp: 'main.cpp',
  c: 'main.c',
  csharp: 'Program.cs',
  go: 'main.go',
  rust: 'main.rs',
  php: 'main.php',
  ruby: 'main.rb',
  html: 'index.html',
  css: 'styles.css',
  json: 'data.json',
  markdown: 'README.md',
  sql: 'query.sql',
};

function defaultMainPath(language) {
  return MAIN_BY_LANG[language] || 'main.txt';
}

function sanitizePath(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim().replace(/\\/g, '/');
  if (!trimmed || trimmed.includes('..')) return '';
  if (!/^[a-zA-Z0-9._\-/]+$/.test(trimmed)) return '';
  const parts = trimmed.split('/').filter(Boolean);
  if (parts.some((p) => p === '.' || p === '..')) return '';
  return parts.join('/');
}

function normalizeIncomingFiles(files) {
  if (!Array.isArray(files)) return null;
  const out = [];
  for (const f of files) {
    const path = sanitizePath(f?.path);
    if (!path) continue;
    out.push({
      path,
      content: typeof f?.content === 'string' ? f.content : '',
    });
  }
  return out.length ? out : null;
}

/** Migrate legacy `code` field into `files` when needed. */
async function ensureRoomFiles(room) {
  if (room.files?.length) return room;
  const lang = room.language || 'javascript';
  const path = defaultMainPath(lang);
  const content =
    room.code != null && String(room.code).length > 0
      ? room.code
      : '// Welcome to the collaborative editor!\n';
  room.files = [{ path, content }];
  room.markModified('files');
  await room.save();
  return room;
}

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

/*
const skipPhoneAuth = process.env.SKIP_PHONE_AUTH === 'true';
if (!skipPhoneAuth && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16)) {
  console.warn(
    '[auth] JWT_SECRET missing or too short; set JWT_SECRET (16+ chars) or SKIP_PHONE_AUTH=true for local dev.'
  );
}
if (!skipPhoneAuth && !isTwilioConfigured()) {
  console.warn(
    '[auth] Twilio Verify env vars missing; SMS will fail until TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID are set.'
  );
}

app.get('/api/auth/phone-status', (req, res) => {
  res.json({
    skipPhoneAuth,
    twilioConfigured: isTwilioConfigured(),
    jwtConfigured: !!(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16),
  });
});

app.post('/api/auth/send-otp', async (req, res) => {
  if (skipPhoneAuth) {
    return res.status(400).json({
      error: 'Phone auth disabled',
      message: 'Server has SKIP_PHONE_AUTH=true; no SMS needed.',
    });
  }
  try {
    const phone = normalizeE164(req.body?.phone);
    if (!phone) {
      return res.status(400).json({
        error: 'Invalid phone',
        message: 'Use international format with country code, e.g. +15551234567',
      });
    }
    await sendVerificationSms(phone);
    res.json({ success: true, message: 'Verification code sent.' });
  } catch (e) {
    if (e.code === 'TWILIO_NOT_CONFIGURED') {
      return res.status(503).json({
        error: 'SMS not configured',
        message: 'Set Twilio credentials on the server.',
      });
    }
    console.error('send-otp:', e);
    res.status(500).json({
      error: 'Failed to send SMS',
      message: e.message || 'Unknown error',
    });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  if (skipPhoneAuth) {
    return res.status(400).json({ error: 'Phone auth disabled' });
  }
  try {
    const phone = normalizeE164(req.body?.phone);
    const code = req.body?.code;
    if (!phone || !code) {
      return res.status(400).json({ error: 'Phone and verification code are required' });
    }
    const ok = await verifyOtp(phone, code);
    if (!ok) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }
    let token;
    try {
      token = signPhoneJwt(phone);
    } catch (signErr) {
      console.error('JWT sign error:', signErr);
      return res.status(500).json({
        error: 'Server misconfiguration',
        message: 'JWT_SECRET must be set (16+ characters) for phone login.',
      });
    }
    res.json({ success: true, token });
  } catch (e) {
    if (e.code === 'TWILIO_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'SMS not configured' });
    }
    console.error('verify-otp:', e);
    res.status(500).json({
      error: 'Verification failed',
      message: e.message || 'Unknown error',
    });
  }
});
*/

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

/*
io.use((socket, next) => {
  if (skipPhoneAuth) {
    socket.verifiedPhone = null;
    return next();
  }
  try {
    const token = socket.handshake.auth?.token;
    if (!token || typeof token !== 'string') {
      return next(
        new Error('Phone verification required. Verify your number on the join page first.')
      );
    }
    const { phone } = verifyPhoneJwt(token);
    socket.verifiedPhone = phone;
    next();
  } catch (e) {
    next(
      new Error(
        'Invalid or expired phone session. Verify your number again on the join page.'
      )
    );
  }
});
*/

// DATA STORAGE

const activeRooms = new Map(); // roomId -> { users: Map(socketId -> user), isFirstUser: boolean }

// REST API ENDPOINTS

// Delete room endpoint
app.delete('/api/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { username } = req.body;

    const room = await Room.findOne({ roomId: roomId.toUpperCase() });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.adminTokenHash) {
      const authHeader = req.headers.authorization || '';
      const bearer =
        typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
          ? authHeader.slice(7).trim()
          : '';
      if (!bearer || hashAdminToken(bearer) !== room.adminTokenHash) {
        return res.status(403).json({
          error: 'Admin token required',
          message: 'Use the device where you created the room, or recreate the room if you lost access.',
        });
      }
    } else {
      if (room.adminUsername !== username) {
        return res.status(403).json({ error: 'Only the admin can delete the room' });
      }
    }

    await Room.deleteOne({ roomId: roomId.toUpperCase() });

    const roomKey = roomId.toUpperCase();
    io.to(roomKey).emit('room-deleted', { message: 'Room has been deleted by admin' });

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
    const { code, question, files } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question is required' });
    }

    let codeBlock = '';
    if (Array.isArray(files) && files.length > 0) {
      const normalized = normalizeIncomingFiles(files);
      if (normalized?.length) {
        codeBlock = normalized
          .map((f) => `// --- ${f.path} ---\n${f.content}`)
          .join('\n\n');
      }
    }
    if (!codeBlock && typeof code === 'string') {
      codeBlock = code;
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
            content: `Project files:\n\`\`\`\n${codeBlock || 'No code provided'}\n\`\`\`\n\nQuestion: ${question}`
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
    const { code, language, files, entryPath } = req.body;

    const languageMap = {
      javascript: 'javascript',
      typescript: 'typescript',
      python: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      csharp: 'csharp',
      go: 'go',
      rust: 'rust',
      php: 'php',
      ruby: 'ruby',
      sql: 'sqlite3',
    };

    let pistonLanguage = languageMap[language] || language;
    let pistonFiles;

    if (Array.isArray(files) && files.length > 0) {
      const normalized = normalizeIncomingFiles(files);
      if (!normalized?.length) {
        return res.status(400).json({ error: 'No valid files to execute' });
      }
      const entry =
        normalized.find((f) => f.path === entryPath) || normalized[0];
      const ext = entry.path.includes('.')
        ? entry.path.slice(entry.path.lastIndexOf('.')).toLowerCase()
        : '';
      const extLang =
        {
          '.js': 'javascript',
          '.mjs': 'javascript',
          '.cjs': 'javascript',
          '.ts': 'typescript',
          '.tsx': 'typescript',
          '.py': 'python',
          '.java': 'java',
          '.cpp': 'cpp',
          '.cc': 'cpp',
          '.cxx': 'cpp',
          '.c': 'c',
          '.cs': 'csharp',
          '.go': 'go',
          '.rs': 'rust',
          '.php': 'php',
          '.rb': 'ruby',
          '.sql': 'sqlite3',
        }[ext] || null;
      if (extLang) pistonLanguage = languageMap[extLang] || extLang;

      const ordered = [
        ...normalized.filter((f) => f.path === entry.path),
        ...normalized.filter((f) => f.path !== entry.path),
      ];
      pistonFiles = ordered.map((f) => ({
        name: f.path.replace(/\\/g, '/'),
        content: f.content,
      }));
    } else {
      if (!code || !String(code).trim()) {
        return res.status(400).json({ error: 'Code is required' });
      }
      pistonFiles = [{ name: 'main', content: code }];
    }

    const response = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: pistonLanguage,
        version: '*',
        files: pistonFiles,
        stdin: '',
        args: [],
        compile_timeout: 10000,
        run_timeout: 3000,
      }),
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
  
  socket.on('join-room', async ({ roomId, username, adminToken: clientAdminToken }) => {
    try {
      const roomKey = String(roomId || '').trim().toUpperCase();
      if (!roomKey) return;

      const displayName = normalizeDisplayName(username);
      if (!displayName) {
        socket.emit('join-rejected', {
          message: 'Enter a display name (1–40 characters) to join.',
        });
        return;
      }

      let room = await Room.findOne({ roomId: roomKey });
      let isNewRoom = false;
      let adminTokenPlain = null;

      if (!room) {
        adminTokenPlain = generateAdminToken();
        room = new Room({
          roomId: roomKey,
          adminUsername: displayName,
          adminTokenHash: hashAdminToken(adminTokenPlain),
        });
        await room.save();
        isNewRoom = true;
        console.log(`Created new room: ${roomKey} with admin: ${displayName}`);
      } else {
        // Protect the admin name
        if (displayName.toLowerCase() === room.adminUsername.toLowerCase()) {
          // If the user is trying to join with the admin's name, they MUST have the token
          if (room.adminTokenHash) {
            if (!clientAdminToken || hashAdminToken(clientAdminToken) !== room.adminTokenHash) {
              socket.emit('join-rejected', {
                message: 'This name is reserved for the room administrator.',
              });
              return;
            }
          }
        }
      }

      room = await ensureRoomFiles(room);

      if (!activeRooms.has(roomKey)) {
        activeRooms.set(roomKey, {
          users: new Map(),
        });
      }

      const activeRoom = activeRooms.get(roomKey);
      for (const u of activeRoom.users.values()) {
        if (u.username.toLowerCase() === displayName.toLowerCase()) {
          socket.emit('join-rejected', {
            message: 'That display name is already in use in this room. Pick another name.',
          });
          return;
        }
      }

      console.log(` ${displayName} joining room: ${roomKey}`);
      socket.join(roomKey);

      activeRoom.users.set(socket.id, {
        username: displayName,
        socketId: socket.id,
      });

      const roomState = {
        files: room.files,
        language: room.language,
        users: Array.from(activeRoom.users.values()),
        chatHistory: room.chatHistory,
        isAdmin: displayName === room.adminUsername,
        requiresAdminToken: !!room.adminTokenHash,
      };
      if (isNewRoom && adminTokenPlain) {
        roomState.adminToken = adminTokenPlain;
      }

      socket.emit('room-state', roomState);

      socket.to(roomKey).emit('user-joined', {
        username: displayName,
        socketId: socket.id,
        users: Array.from(activeRoom.users.values()),
      });
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  socket.on('files-change', async ({ roomId, files }) => {
    try {
      const roomKey = String(roomId || '').trim().toUpperCase();
      if (!socket.rooms.has(roomKey)) return;

      const normalized = normalizeIncomingFiles(files);
      if (!roomKey || !normalized?.length) return;

      const room = await Room.findOne({ roomId: roomKey });
      if (!room) return;

      room.files = normalized;
      room.markModified('files');
      await room.save();

      socket.to(roomKey).emit('files-update', { files: room.files });
    } catch (error) {
      console.error('Error saving files:', error);
    }
  });

  socket.on('language-change', async ({ roomId, language }) => {
    try {
      const roomKey = String(roomId || '').trim().toUpperCase();
      if (!socket.rooms.has(roomKey)) return;

      const room = await Room.findOne({ roomId: roomKey });
      if (room) {
        room.language = language;
        await room.save();
        io.to(roomKey).emit('language-update', { language });
      }
    } catch (error) {
      console.error('Error saving language:', error);
    }
  });

  socket.on('chat-message', async ({ roomId, message, username }) => {
    try {
      const roomKey = String(roomId || '').trim().toUpperCase();
      if (!socket.rooms.has(roomKey)) return;

      const activeRoom = activeRooms.get(roomKey);
      const member = activeRoom?.users.get(socket.id);
      if (!member) return;

      const room = await Room.findOne({ roomId: roomKey });
      if (room) {
        const chatMessage = {
          id: Date.now(),
          username: member.username,
          message,
          timestamp: new Date(),
        };
        room.chatHistory.push(chatMessage);
        await room.save();
        io.to(roomKey).emit('new-message', chatMessage);
      }
    } catch (error) {
      console.error('Error saving chat message:', error);
    }
  });

// WebRTC with PeerJS
socket.on('join-video-call', ({ roomId, peerId }) => {
  const roomKey = String(roomId || '').trim().toUpperCase();
  console.log(` ${peerId} joining video call in room ${roomKey}`);

  const activeRoom = activeRooms.get(roomKey);
  if (activeRoom) {
    socket.to(roomKey).emit('user-joined-video-call', { peerId });
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
  const roomKey = String(roomId || '').trim().toUpperCase();
  console.log(` ${socket.id} leaving video call`);
  socket.to(roomKey).emit('user-left-video', { peerId: socket.id });
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