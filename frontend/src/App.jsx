import React, { useState } from 'react';
import RoomJoin from './components/room/RoomJoin';
import EditorRoom from './pages/EditorRoom';

function App() {
  const [stage, setStage] = useState('join'); // 'join' or 'editor'
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  
  const handleJoinRoom = () => {
    if (roomId.trim() && username.trim()) {
      setStage('editor');
    }
  };

  const handleCreateRoom = () => {
    // Generate a random 6-character room code
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(newRoomId);
  };

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
  return <EditorRoom roomId={roomId} username={username} />;
}

export default App;