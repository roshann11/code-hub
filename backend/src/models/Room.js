import mongoose from 'mongoose';

const fileEntrySchema = new mongoose.Schema(
  {
    path: { type: String, required: true },
    content: { type: String, default: '' },
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
  },
  /** @deprecated Use `files`; kept for migration from older documents. */
  code: {
    type: String,
    default: '// Welcome to the collaborative editor!\n// Start coding together...\n\n',
  },
  language: {
    type: String,
    default: 'javascript',
  },
  files: {
    type: [fileEntrySchema],
    default: undefined,
  },
  chatHistory: [
    {
      id: Number,
      username: String,
      message: String,
      timestamp: Date,
    },
  ],
  adminUsername: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('Room', roomSchema);
