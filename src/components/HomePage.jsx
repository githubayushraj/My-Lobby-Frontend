import React, { useState, useRef, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { TextPlugin } from 'gsap/TextPlugin';
import { X, Sparkles, Copy, Loader2, Video, Heart, MessageCircle } from 'lucide-react';

// Register GSAP plugins
gsap.registerPlugin(TextPlugin);

// --- Helper Components ---

const buttonStyles = {
  base: "relative inline-flex items-center justify-center px-6 py-3 text-base font-bold text-white transition-all duration-300 ease-in-out border-2 border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 overflow-hidden shadow-lg",
  primary: "bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:scale-105 transform",
  secondary: "bg-white/20 backdrop-blur-lg border-2 border-white/30 hover:bg-white/30 text-white",
  success: "bg-gradient-to-r from-green-500 to-emerald-500 hover:scale-105 transform",
};

const BackgroundCloud = ({ delay, position, size }) => (
  <div
    className={`absolute ${position} ${size} bg-white/40 rounded-full animate-float z-0`}
    style={{ animationDelay: `${delay}s`, animationDuration: '12s' }}
  />
);

const Character = () => (
    <div className="flex flex-col items-center animate-breath">
        <div className="w-16 h-16 bg-white/30 rounded-full shadow-lg"/>
        <div className="w-24 h-12 bg-white/20 rounded-t-full -mt-4"/>
    </div>
);

const CurvedConnector = () => {
    const [path, setPath] = useState('');
    const containerRef = useRef(null);

    useEffect(() => {
        const updateLine = () => {
            if (containerRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect();
                const startX = width * 0.13;
                const startY = height * 0.5;
                const endX = width * 0.87;
                const endY = height * 0.5;
                const cp1X = width * 0.3;
                const cp1Y = height * 0.3;
                const cp2X = width * 0.7;
                const cp2Y = height * 0.7;
                setPath(`M ${startX},${startY} C ${cp1X},${cp1Y} ${cp2X},${cp2Y} ${endX},${endY}`);
            }
        };
        updateLine();
        window.addEventListener('resize', updateLine);
        return () => window.removeEventListener('resize', updateLine);
    }, []);

    return (
        <div ref={containerRef} className="absolute inset-0 z-0">
            <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
                 <defs>
                    <linearGradient id="wireGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#EC4899" /> 
                        <stop offset="50%" stopColor="#D946EF" />
                        <stop offset="100%" stopColor="#8B5CF6" />
                    </linearGradient>
                </defs>
                <path d={path} stroke="url(#wireGradient)" strokeWidth="4" fill="none" strokeDasharray="10 10" className="animate-dash"/>
            </svg>
        </div>
    );
};

// --- Main Page Component ---

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

  // --- Refs for GSAP animations ---
  const titleRef = useRef(null);
  const createModalRef = useRef(null);
  const joinModalRef = useRef(null);

  // --- GSAP Animations ---
  useEffect(() => {
    // Animate title with a typewriter effect
    const fullTitle = "Join lobby";
    gsap.to(titleRef.current, {
      duration: fullTitle.length * 0.1,
      text: { value: fullTitle, ease: "none" },
    });

    // Animate hero content on load
    gsap.fromTo(
      [".hero-subtitle", ".hero-buttons"],
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", stagger: 0.2, delay: 0.5 }
    );
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
  
  // Trigger animations when modals are shown
  useEffect(() => { if (showCreateModal) animateModalOpen(createModalRef.current); }, [showCreateModal]);
  useEffect(() => { if (showJoinModal) animateModalOpen(joinModalRef.current); }, [showJoinModal]);

  // --- API Handlers ---
  const handleCreateMeeting = async () => {
    setIsLoading(true);
    try {
      // CORRECTED API URL
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/meetings/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'New Cloud Meeting' }),
      });
      if (!response.ok) throw new Error('Failed to create meeting room from server.');

      const data = await response.json();
      setRoomId(data.friendlyRoomId);
      setShowCreateModal(true);
    } catch (error) {
      console.error(error);
      alert('Something went wrong. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const closeCreateModal = () => animateModalClose(createModalRef.current, () => setShowCreateModal(false));
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
      // CORRECTED API URL
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/meetings/join/${joinRoomId}`);

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
    <div className="min-h-screen bg-gradient-to-br from-sky-200 via-blue-300 to-indigo-400 relative overflow-hidden font-sans">
      <div className="absolute inset-0 z-0">
        <BackgroundCloud delay={0} position="top-10 left-1/4" size="w-32 h-32 md:w-48 md:h-48" />
        <BackgroundCloud delay={2} position="top-1/2 right-1/4" size="w-24 h-24 md:w-32 md:h-32" />
        <BackgroundCloud delay={4} position="bottom-20 left-1/3" size="w-28 h-28 md:w-40 md:h-40" />
      </div>
      
      <div className="hidden md:block absolute inset-0"> <CurvedConnector /> </div>

      <div className="relative z-10 flex items-center justify-center md:justify-between min-h-screen w-full p-4 text-white">
        <div className="hidden md:flex w-1/5 justify-center items-center"><Character/></div>
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 md:p-12 w-full max-w-xl mx-4 md:mx-0 border border-white/20 shadow-2xl text-center">
            <Sparkles className="mx-auto text-yellow-300 h-10 w-10 md:h-12 md:w-12 mb-4"/>
            <h1 ref={titleRef} className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4 tracking-tight min-h-[50px] md:min-h-[80px]"></h1>
            <p className="hero-subtitle max-w-xl mx-auto text-base md:text-xl mb-8 text-white/80">
                Seamlessly connect with others in your own private, secure cloud.
            </p>
            <div className="hero-buttons flex flex-col sm:flex-row gap-4 justify-center">
                <button onClick={handleCreateMeeting} disabled={isLoading} className={`${buttonStyles.base} ${buttonStyles.primary}`}>
                    {isLoading && !showJoinModal ? <Loader2 size={22} className="animate-spin mr-2" /> : <Video size={22} className="mr-2" />}
                    Create lobby
                </button>
                <button onClick={openJoinModal} className={`${buttonStyles.base} ${buttonStyles.secondary}`}>
                    <MessageCircle size={22} className="mr-2" />
                    Join lobby
                </button>
            </div>
        </div>
        <div className="hidden md:flex w-1/5 justify-center items-center"><Character/></div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div ref={createModalRef} className="relative bg-white/95 border border-blue-200 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl backdrop-blur-xl opacity-0">
            <button onClick={closeCreateModal} className="absolute top-4 right-4 p-2 rounded-full text-gray-500 hover:bg-gray-200 transition-colors" aria-label="Close modal"><X size={24} /></button>
            <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg"><Sparkles size={32} className="text-white" /></div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-gray-800">Your Cloud is Ready!</h2>
                <p className="text-gray-600 mb-8">Share this Room ID with others to invite them.</p>
                <div className="bg-blue-50 rounded-xl p-4 mb-6 border-2 border-blue-200">
                    <p className="text-sm font-bold text-gray-600 mb-2 tracking-wider">ROOM ID</p>
                    <div className="flex items-center justify-center gap-4">
                      <span className="text-3xl sm:text-4xl font-mono font-bold tracking-widest text-blue-700">{roomId}</span>
                      <button onClick={copyRoomId} className="relative p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        <Copy size={20} />
                        <span className="copy-feedback absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-3 py-1 rounded-md text-sm shadow-lg opacity-0">Copied!</span>
                      </button>
                    </div>
                </div>
                <button onClick={handleStartMeeting} className={`w-full ${buttonStyles.base} ${buttonStyles.success}`}>
                    <Video size={20} className="mr-2"/>
                    Enter Your Cloud
                </button>
            </div>
          </div>
        </div>
      )}

      {showJoinModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div ref={joinModalRef} className="relative bg-white/95 border border-blue-200 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl backdrop-blur-xl opacity-0">
                <button onClick={closeJoinModal} className="absolute top-4 right-4 p-2 rounded-full text-gray-500 hover:bg-gray-200 transition-colors" aria-label="Close modal"><X size={24} /></button>
                <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-center text-gray-800">Join the Conversation</h2>
                <form onSubmit={handleJoinSubmit} className="space-y-5">
                    <div>
                        <label htmlFor="join-room-id" className="block text-sm font-medium text-gray-700 mb-2 text-left">Room ID</label>
                        <input id="join-room-id" type="text" value={joinRoomId} onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())} placeholder="Enter Room ID" className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800" required/>
                    </div>
                    <div>
                        <label htmlFor="join-user-name" className="block text-sm font-medium text-gray-700 mb-2 text-left">Your Name</label>
                        <input id="join-user-name" type="text" value={joinUserName} onChange={(e) => setJoinUserName(e.target.value)} placeholder="Enter your name" className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800" required/>
                    </div>
                    {joinError && <p className="text-red-500 text-sm text-center">{joinError}</p>}
                    <button type="submit" disabled={isLoading} className={`w-full ${buttonStyles.base} ${buttonStyles.primary}`}>
                      {isLoading ? <Loader2 size={22} className="animate-spin mr-2" /> : <Heart size={22} className="mr-2" />}
                      {isLoading ? 'Joining Cloud...' : 'Float into Chat'}
                    </button>
                </form>
            </div>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap');
        body { font-family: 'Inter', sans-serif; }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-25px); } }
        .animate-float { animation: float 10s ease-in-out infinite; }
        @keyframes breath { 0%, 100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.03); opacity: 1; } }
        .animate-breath { animation: breath 4s ease-in-out infinite; }
        @keyframes dash { to { stroke-dashoffset: -20; } }
        .animate-dash { animation: dash 1s linear infinite; }
      `}</style>
    </div>
  );
}