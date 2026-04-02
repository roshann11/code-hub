import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  code: {
    type: String,
    default: '// Welcome to the collaborative editor!\n// Start coding together...\n\n'
  },
  language: {
    type: String,
    default: 'javascript'
  },
  chatHistory: [{
    id: Number,
    username: String,
    message: String,
    timestamp: Date
  }],
  adminUsername: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Room', roomSchema);