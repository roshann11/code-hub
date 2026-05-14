import React, { useState, useEffect, useCallback } from 'react';
import RoomJoin from './components/room/RoomJoin';
import EditorRoom from './pages/EditorRoom';
import { adminTokenStorageKey } from './utils/roomAdminToken';
import { getStoredPhoneJwt } from './utils/phoneAuth';

const SESSION_KEY = 'coders-hub-session';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function readStoredSession() {
  if (typeof window === 'undefined') {
    return { stage: 'join', roomId: '', username: '' };
  }
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return { stage: 'join', roomId: '', username: '' };
    const data = JSON.parse(raw);
    const roomId =
      typeof data.roomId === 'string' ? data.roomId.trim().toUpperCase() : '';
    const username =
      typeof data.username === 'string' ? data.username.trim() : '';
    if (data.stage === 'editor' && roomId && username) {
      return { stage: 'editor', roomId, username };
    }
  } catch {
    /* ignore corrupt storage */
  }
  return { stage: 'join', roomId: '', username: '' };
}

const initialSession = readStoredSession();

function App() {
  const [stage, setStage] = useState(initialSession.stage); // 'join' or 'editor'
  const [roomId, setRoomId] = useState(initialSession.roomId);
  const [username, setUsername] = useState(initialSession.username);

  // Keep tab refresh in the editor; cleared when leaving the room or not in editor
  useEffect(() => {
    if (stage === 'editor' && roomId.trim() && username.trim()) {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          stage: 'editor',
          roomId: roomId.trim().toUpperCase(),
          username: username.trim(),
        })
      );
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, [stage, roomId, username]);

  const handleJoinRoom = async () => {
    /*
    try {
      const res = await fetch(`${API_BASE}/api/auth/phone-status`);
      const status = await res.json();
      if (!status.skipPhoneAuth && !getStoredPhoneJwt()) {
        alert('Verify your phone number first.');
        return;
      }
    } catch {
      if (!getStoredPhoneJwt()) {
        alert('Could not reach the server to verify phone login.');
        return;
      }
    }
    */
    const r = roomId.trim().toUpperCase();
    const u = username.trim().slice(0, 40);
    if (r && u) {
      setRoomId(r);
      setUsername(u);
      setStage('editor');
    }
  };

  const handleCreateRoom = () => {
    // Generate a random 6-character room code
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(newRoomId);
  };

  const handleLeaveRoom = useCallback(() => {
    try {
      const id = roomId.trim().toUpperCase();
      if (id) sessionStorage.removeItem(adminTokenStorageKey(id));
    } catch {
      /* ignore */
    }
    setStage('join');
    setRoomId('');
  }, [roomId]);

  // Show join screen
  if (stage === 'join') {
    return (
      <RoomJoin 
        roomId={roomId}
        setRoomId={setRoomId}
        username={username}
        setUsername={setUsername}
        onJoin={handleJoinRoom}
        onCreateRoom={handleCreateRoom}
      />
    );
  }

  // Show editor room
  return (
    <EditorRoom
      roomId={roomId}
      username={username}
      onLeaveRoom={handleLeaveRoom}
    />
  );
}

export default App;