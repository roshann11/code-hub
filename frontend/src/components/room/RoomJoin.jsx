import React, { useState, useEffect } from 'react';
import { Monitor, Users, Smartphone, Loader } from 'lucide-react';
import {
  getStoredPhoneJwt,
  setStoredPhoneJwt,
  clearStoredPhoneJwt,
} from '../../utils/phoneAuth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function RoomJoin({
  roomId,
  setRoomId,
  username,
  setUsername,
  onJoin,
  onCreateRoom,
}) {
  const [phoneAuthLoading, setPhoneAuthLoading] = useState(true);
  const [skipPhoneAuth, setSkipPhoneAuth] = useState(false);
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpHint, setOtpHint] = useState('');
  const [cooldownSec, setCooldownSec] = useState(0);

  const phoneVerified = skipPhoneAuth || !!getStoredPhoneJwt();

  useEffect(() => {
    if (cooldownSec <= 0) return undefined;
    const id = setInterval(() => {
      setCooldownSec((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownSec]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/auth/phone-status`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setSkipPhoneAuth(!!data.skipPhoneAuth);
          setPhoneAuthLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setPhoneAuthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [, force] = useState(0);
  const bump = () => force((x) => x + 1);

  const handleSendOtp = async () => {
    const trimmed = phone.trim();
    if (!trimmed.startsWith('+')) {
      setOtpHint('Include country code with + (example: +15551234567)');
      return;
    }
    setOtpBusy(true);
    setOtpHint('');
    try {
      const res = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOtpHint(data.message || data.error || 'Could not send SMS');
        return;
      }
      setOtpHint('Check your phone for the code.');
      setCooldownSec(45);
    } catch {
      setOtpHint('Network error sending SMS');
    } finally {
      setOtpBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    const trimmed = phone.trim();
    if (!trimmed || !otpCode.trim()) {
      setOtpHint('Enter phone and the code from SMS');
      return;
    }
    setOtpBusy(true);
    setOtpHint('');
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: trimmed, code: otpCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOtpHint(data.message || data.error || 'Verification failed');
        return;
      }
      if (data.token) {
        setStoredPhoneJwt(data.token);
        bump();
        setOtpHint('Phone verified. You can join a room below.');
        setOtpCode('');
      }
    } catch {
      setOtpHint('Network error verifying code');
    } finally {
      setOtpBusy(false);
    }
  };

  const handleSignOutPhone = () => {
    clearStoredPhoneJwt();
    bump();
    setOtpHint('');
  };

  const handleJoinClick = () => {
    if (!phoneVerified) {
      setOtpHint('Verify your phone number first.');
      return;
    }
    if (roomId.trim() && username.trim()) {
      onJoin();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleJoinClick();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-md w-full border border-purple-500/20 max-h-[95vh] overflow-y-auto">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500/20 rounded-full mb-4">
            <Monitor className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Collaborative Editor</h1>
          <p className="text-slate-400">Code together in real-time</p>
        </div>

        {!phoneAuthLoading && !skipPhoneAuth && (
          <div className="mb-6 p-4 rounded-xl border border-slate-600 bg-slate-900/50 space-y-3">
            <div className="flex items-center gap-2 text-white font-medium text-sm">
              <Smartphone className="w-4 h-4 text-purple-400" />
              Phone verification (Twilio)
            </div>
            {phoneVerified ? (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-green-400 text-sm">Signed in with a verified phone.</p>
                <button
                  type="button"
                  onClick={handleSignOutPhone}
                  className="text-xs text-slate-400 hover:text-white underline"
                >
                  Use different number
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500">
                  Use E.164 format with country code (e.g. +1 for US, +44 for UK).
                </p>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+15551234567"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  autoComplete="tel"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={otpBusy || cooldownSec > 0}
                    className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm rounded-lg"
                  >
                    {cooldownSec > 0 ? `Resend (${cooldownSec}s)` : 'Send code'}
                  </button>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="6-digit code"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  maxLength={10}
                />
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={otpBusy}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2"
                >
                  {otpBusy ? <Loader className="w-4 h-4 animate-spin" /> : null}
                  Verify code
                </button>
              </>
            )}
            {otpHint && <p className="text-xs text-slate-400">{otpHint}</p>}
          </div>
        )}

        {!phoneAuthLoading && skipPhoneAuth && (
          <p className="mb-4 text-xs text-amber-400/90 text-center">
            Phone auth is off on this server (SKIP_PHONE_AUTH). Enable Twilio + JWT for production.
          </p>
        )}

        {phoneAuthLoading && (
          <div className="flex justify-center py-4 text-slate-400 text-sm mb-4">
            <Loader className="w-5 h-5 animate-spin mr-2" />
            Loading…
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Your Name</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter your name"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
              maxLength={40}
            />
            <p className="text-xs text-slate-500 mt-1">
              Names must be unique in a room. Room creator gets a secret delete key on this device
              only.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Room Code</label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              placeholder="Enter 6-digit code"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 uppercase font-mono tracking-wider transition-all"
              maxLength={6}
            />
            {roomId && roomId.length < 6 && (
              <p className="text-xs text-slate-400 mt-1">Room code should be 6 characters</p>
            )}
          </div>

          <button
            onClick={handleJoinClick}
            disabled={!phoneVerified || !roomId.trim() || !username.trim() || roomId.length < 6}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all transform hover:scale-[1.02] disabled:transform-none"
          >
            Join Room
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-slate-800 text-slate-400">or</span>
            </div>
          </div>

          <button
            onClick={onCreateRoom}
            className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
          >
            <Users className="w-5 h-5" />
            Create New Room
          </button>

          <div className="text-center text-xs text-slate-500 mt-4">
            Create a room and share the code with your team
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoomJoin;
