'use client';

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Whiteboard from '@/components/Whiteboard';
import { toast } from 'sonner';
import { ArrowRight, Plus, Users } from 'lucide-react';

export default function Home() {
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [joined, setJoined] = useState(false);

  const createRoom = () => {
    if (!userName) return toast.error('Please enter your name');
    const newRoomId = uuidv4();
    setRoomId(newRoomId);
    setJoined(true);

    // Auto copy and notify
    navigator.clipboard.writeText(newRoomId);
    toast.success('Room created! ID copied to clipboard.');
  };

  const joinRoom = () => {
    if (!userName) return toast.error('Please enter your name');
    if (!roomId) return toast.error('Please enter a room ID');
    setJoined(true);
  };

  const handleLeave = () => {
    setJoined(false);
    setRoomId('');
    toast.info('You left the room');
  };

  if (joined) {
    return <Whiteboard roomId={roomId} userName={userName} onLeave={handleLeave} />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-blue-600 p-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Whiteboard</h1>
          <p className="text-blue-100">Collaborate in real-time</p>
        </div>

        <div className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Your Name</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-gray-50 focus:bg-white text-black"
              placeholder="Enter your name"
            />
          </div>

          <div className="space-y-4">
            <button
              onClick={createRoom}
              className="w-full py-3.5 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-semibold shadow-lg shadow-blue-200 flex items-center justify-center gap-2 group"
            >
              <Plus size={20} className="group-hover:scale-110 transition-transform" />
              Create New Room
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink-0 mx-4 text-gray-400 text-sm font-medium">OR JOIN EXISTING</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all bg-gray-50 focus:bg-white text-black"
                  placeholder="Enter Room ID"
                />
              </div>
              <button
                onClick={joinRoom}
                className="px-6 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-semibold shadow-lg shadow-green-200 flex items-center justify-center"
              >
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 p-4 text-center text-xs text-gray-500 border-t border-gray-100">
          Secure • Fast • Real-time
        </div>
      </div>
    </main>
  );
}
