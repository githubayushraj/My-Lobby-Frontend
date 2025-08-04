import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { TextPlugin } from 'gsap/TextPlugin';
import { X, Sparkles, Copy, Loader2 } from 'lucide-react';

// Register the GSAP TextPlugin to enable the typewriter effect
gsap.registerPlugin(TextPlugin);

// --- Reusable Tailwind CSS classes for consistent button styling ---
const glowingButtonStyles = "relative px-8 py-4 font-bold text-white transition-all duration-300 ease-in-out rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 overflow-hidden";
const glowingButtonPseudo = "absolute inset-0 w-full h-full bg-gradient-to-r from-blue-600 to-violet-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-pulse";

export default function HomePage() {
  const navigate = useNavigate();

  // --- State Management ---
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinUserName, setJoinUserName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [joinError, setJoinError] = useState('');

  // --- Refs for DOM elements to be animated ---
  const modalRef = useRef(null);
  const joinModalRef = useRef(null);
  const titleRef = useRef(null);

  // --- GSAP Animations ---
  useEffect(() => {
    // Animate the title with a typewriter effect
    const fullTitle = "NEXT-GEN";
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 2 });
    tl.to(titleRef.current, {
      duration: fullTitle.length * 0.15,
      text: { value: fullTitle, ease: "none" },
    });

    // Animate the subtitle and buttons on initial load
    gsap.fromTo(
      [".hero-subtitle", ".hero-buttons"],
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.2, delay: 0.5 }
    );

    // Cleanup animations on component unmount
    return () => tl.kill();
  }, []);

  const animateModalOpen = (modalElement) => {
    gsap.fromTo(modalElement,
      { scale: 0.9, opacity: 0, y: -20 },
      { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }
    );
  };

  const animateModalClose = (modalElement, onComplete) => {
    gsap.to(modalElement, {
      scale: 0.95, opacity: 0, y: 20, duration: 0.3, ease: "power3.in", onComplete,
    });
  };

  // Trigger animations when modals are shown/hidden
  useEffect(() => { if (showCreateModal) animateModalOpen(modalRef.current); }, [showCreateModal]);
  useEffect(() => { if (showJoinModal) animateModalOpen(joinModalRef.current); }, [showJoinModal]);

  // --- API Interaction & Event Handlers ---

  const handleCreateMeeting = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8080/api/meetings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'New Meeting' }),
      });
      if (!response.ok) throw new Error('Failed to create meeting room.');

      const data = await response.json();
      setRoomId(data.friendlyRoomId);
      setShowCreateModal(true);
    } catch (error) {
      console.error(error);
      alert('Error: Could not create a meeting room. Ensure the backend server is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const closeCreateModal = () => animateModalClose(modalRef.current, () => setShowCreateModal(false));
  const openJoinModal = () => setShowJoinModal(true);
  const closeJoinModal = () => animateModalClose(joinModalRef.current, () => setShowJoinModal(false));

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    const feedbackEl = document.querySelector('.copy-feedback');
    gsap.fromTo(feedbackEl, { opacity: 0, y: 10 }, {
      opacity: 1, y: 0, duration: 0.3, onComplete: () => {
        gsap.to(feedbackEl, { opacity: 0, y: -10, duration: 0.3, delay: 1.5 });
      }
    });
  };

  const handleJoinSubmit = async (e) => {
    e.preventDefault();
    if (!joinRoomId.trim() || !joinUserName.trim()) return;

    setIsLoading(true);
    setJoinError('');
    try {
      const response = await fetch(`http://localhost:8080/api/meetings/join/${joinRoomId}`);

      if (response.status === 404) {
        setJoinError('Invalid Room ID. Please check the ID and try again.');
        return;
      }
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      
      const data = await response.json();
      if (data.isValid) {
        const userId = `${joinUserName.replace(/\s+/g, '_')}_${Math.random().toString(36).substring(2, 6)}`;
        navigate(`/stream/${joinRoomId}/${userId}`);
      } else {
        setJoinError('Room ID is not valid.');
      }
    } catch (error) {
      console.error("Fetch API Error:", error);
      setJoinError('Network error. Is the server running?');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartMeeting = () => {
    const creatorUserId = `Creator_${Math.random().toString(36).substring(2, 7)}`;
    navigate(`/stream/${roomId}/${creatorUserId}`);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white relative overflow-hidden">
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-gray-900 via-gray-900 to-blue-900/50"></div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8 text-center">
        <style>{`.typing-cursor::after { content: '_'; animation: blink 0.7s step-end infinite; } @keyframes blink { 50% { opacity: 0; } }`}</style>
        <h1 className="text-5xl md:text-7xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 min-h-[80px]">
          <span ref={titleRef} className="typing-cursor"></span>
          <span> Video Meetings</span>
        </h1>
        <p className="hero-subtitle text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mb-10">
          Experience seamless, secure, and feature-rich video conferencing with stunning clarity.
        </p>

        <div className="hero-buttons flex flex-col sm:flex-row gap-6">
          <button onClick={handleCreateMeeting} disabled={isLoading} className={`group bg-gradient-to-r from-blue-500 to-violet-500 hover:scale-105 ${glowingButtonStyles}`}>
            <span className={glowingButtonPseudo}></span>
            <span className="relative z-10 flex items-center gap-2">
              {isLoading && !showJoinModal ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
              Create Meeting
            </span>
          </button>
          <button onClick={openJoinModal} className="bg-gray-800/50 border border-gray-700 backdrop-blur-sm hover:bg-gray-700/60 py-4 px-8 rounded-xl font-bold transition-all duration-300 hover:scale-105">
            Join Meeting
          </button>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div ref={modalRef} className="bg-gray-800/70 border border-gray-700/60 rounded-2xl p-8 max-w-md w-full shadow-2xl shadow-blue-500/10">
            <button onClick={closeCreateModal} className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:bg-gray-700/50 transition-colors"><X size={24} /></button>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center mx-auto mb-6"><Sparkles size={32} /></div>
              <h2 className="text-3xl font-bold mb-2">Meeting Ready!</h2>
              <p className="text-gray-400 mb-8">Share this Room ID with participants.</p>
              <div className="bg-gray-900/80 rounded-xl p-5 mb-6 border border-gray-700">
                <p className="text-sm text-gray-400 mb-2">Room ID</p>
                <div className="flex items-center justify-center gap-4">
                  <span className="text-4xl font-mono font-bold tracking-widest">{roomId}</span>
                  <button onClick={copyRoomId} className="relative p-3 bg-blue-600/50 text-white rounded-lg hover:bg-blue-500 transition-colors"><Copy size={20} />
                    <span className="copy-feedback absolute -bottom-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-3 py-1 rounded-md text-sm opacity-0 shadow-lg">Copied!</span>
                  </button>
                </div>
              </div>
              <button onClick={handleStartMeeting} className={`w-full group bg-gradient-to-r from-green-500 to-emerald-500 hover:scale-105 ${glowingButtonStyles}`}>
                <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-green-600 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></span>
                <span className="relative z-10">Start Meeting</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showJoinModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div ref={joinModalRef} className="bg-gray-800/70 border border-gray-700/60 rounded-2xl p-8 max-w-md w-full shadow-2xl shadow-blue-500/10">
            <button onClick={closeJoinModal} className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:bg-gray-700/50 transition-colors"><X size={24} /></button>
            <div>
              <h2 className="text-3xl font-bold mb-6 text-center">Join Meeting</h2>
              <form onSubmit={handleJoinSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Room ID</label>
                  <input type="text" value={joinRoomId} onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())} placeholder="Enter Room ID"
                    className="w-full px-4 py-3 bg-gray-900/80 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Your Name</label>
                  <input type="text" value={joinUserName}
                    // ✅ FIX: Corrected "e.taget.value" to "e.target.value"
                    onChange={(e) => setJoinUserName(e.target.value)}
                    placeholder="Enter your display name"
                    className="w-full px-4 py-3 bg-gray-900/80 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                {joinError && <p className="text-red-400 text-sm text-center">{joinError}</p>}
                <button type="submit" disabled={isLoading} className={`w-full group bg-gradient-to-r from-blue-500 to-violet-500 hover:scale-105 ${glowingButtonStyles}`}>
                  <span className={glowingButtonPseudo}></span>
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isLoading ? <Loader2 size={20} className="animate-spin" /> : 'Confirm & Join'}
                  </span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}