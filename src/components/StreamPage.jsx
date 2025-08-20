import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Video, VideoOff, Mic, MicOff, ScreenShare, XCircle } from 'lucide-react';

// STUN & signaling URLs
const STUN_SERVER   = 'stun:stun.l.google.com:19302';
const WEBSOCKET_URL = 'wss://lobby.myshopflix.in/signaling';

// gradient from screenshot (#9dd6ff → #53a5fd)
const BG_GRADIENT   = 'bg-gradient-to-br from-[#9dd6ff] to-[#53a5fd]';

// Layout component
function VideoGridLayout({ children }) {
  const count = React.Children.count(children);

  return (
    <div className="w-full h-full p-2">
      <div className="grid gap-2 w-full h-full">
        {children}
      </div>
      <style jsx>{`
        .grid {
          display: grid;
          place-items: center;
        }

        /* MOBILE: explicit columns based on participant count */
        @media (max-width: 767px) {
          .grid {
            ${count <= 4
              ? `grid-template-columns: repeat(2, 1fr);`
              : count <= 6
              ? `grid-template-columns: repeat(3, 1fr);`
              : count <= 8
              ? `grid-template-columns: repeat(4, 1fr);`
              : `grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                 overflow-y: auto;`}
          }
        }

        /* LAPTOP: dynamic columns based on participant count */
        @media (min-width: 768px) {
          .grid {
            ${count <= 6
              ? `grid-template-columns: repeat(3, 1fr);`
              : count <= 8
              ? `grid-template-columns: repeat(4, 1fr);`
              : `grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                 overflow-y: auto;`}
          }
        }
      `}</style>
    </div>
  );
}

// Single video tile
function VideoPlayer({ stream, muted, label }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="relative w-full bg-gray-800 rounded-lg overflow-hidden aspect-video">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
        {label}
      </div>
    </div>
  );
}

export default function StreamPage() {
  const { roomId, userId } = useParams();
  const navigate            = useNavigate();

  const [localStream, setLocalStream]     = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [isMuted, setIsMuted]             = useState(false);
  const [isVideoOff, setIsVideoOff]       = useState(false);

  const ws               = useRef(null);
  const peerConnections  = useRef(new Map());
  const localStreamRef   = useRef(null);

  // send wrapper
  const send = useCallback((msg) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg));
    }
  }, []);

  // create or reuse RTCPeerConnection
  const createPeerConnection = useCallback((remoteUserId) => {
    if (peerConnections.current.has(remoteUserId)) {
      return peerConnections.current.get(remoteUserId);
    }

    const pc = new RTCPeerConnection({ iceServers: [{ urls: STUN_SERVER }] });
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        send({ type: 'ice_candidate', payload: { remoteUserId, candidate: e.candidate } });
      }
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        peerConnections.current.delete(remoteUserId);
        setRemoteStreams(s => {
          const m = new Map(s);
          m.delete(remoteUserId);
          return m;
        });
      }
    };
    localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));
    pc.ontrack = (e) => {
      setRemoteStreams(s => new Map(s).set(remoteUserId, e.streams[0]));
    };

    peerConnections.current.set(remoteUserId, pc);
    return pc;
  }, [send]);

  // toggle audio/video
  const toggleMute = () => {
    localStream?.getAudioTracks().forEach(t => {
      t.enabled = !t.enabled;
      setIsMuted(!t.enabled);
    });
  };
  const toggleVideo = () => {
    localStream?.getVideoTracks().forEach(t => {
      t.enabled = !t.enabled;
      setIsVideoOff(!t.enabled);
    });
  };

  // screen share on/off
  const handleShareScreen = async () => {
    if (!isSharingScreen) {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const screenTrack = screen.getVideoTracks()[0];
        peerConnections.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track.kind === 'video');
          sender?.replaceTrack(screenTrack);
        });
        screenTrack.onended = () => handleStopScreenShare();
        setLocalStream(screen);
        localStreamRef.current = screen;
        setIsSharingScreen(true);
      } catch (err) {
        console.error('Screen share failed', err);
      }
    } else {
      await handleStopScreenShare();
    }
  };
  const handleStopScreenShare = async () => {
    try {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      const camera = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const camTrack = camera.getVideoTracks()[0];
      peerConnections.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track.kind === 'video');
        sender?.replaceTrack(camTrack);
      });
      setLocalStream(camera);
      localStreamRef.current = camera;
      setIsSharingScreen(false);
    } catch (err) {
      console.error('Could not revert to camera', err);
    }
  };

  // end call cleanup
  const handleEndCall = useCallback(() => {
    ws.current?.close();
    ws.current = null;
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    navigate('/');
  }, [navigate]);

  // on mount: get media, connect WS, signaling
  useEffect(() => {
    if (!roomId || !userId) return;

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then(stream => {
        setLocalStream(stream);
        localStreamRef.current = stream;

        ws.current = new WebSocket(WEBSOCKET_URL);
        ws.current.onopen = () => send({ type: 'join', payload: { roomId, userId } });

        ws.current.onmessage = async ({ data }) => {
          const { type, payload } = JSON.parse(data);
          const remoteId = payload.userId;
          let pc;

          switch (type) {
            case 'existing_participants':
              for (const id of payload.userIds) {
                pc = createPeerConnection(id);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                send({ type: 'offer', payload: { remoteUserId: id, sdp: pc.localDescription } });
              }
              break;
            case 'offer':
              pc = createPeerConnection(remoteId);
              await pc.setRemoteDescription(payload.sdp);
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              send({ type: 'answer', payload: { remoteUserId: remoteId, sdp: pc.localDescription } });
              break;
            case 'answer':
              pc = peerConnections.current.get(remoteId);
              if (pc) await pc.setRemoteDescription(payload.sdp);
              break;
            case 'ice_candidate':
              pc = peerConnections.current.get(remoteId);
              if (pc) await pc.addIceCandidate(payload.candidate);
              break;
            case 'participant_left':
              peerConnections.current.get(remoteId)?.close();
              peerConnections.current.delete(remoteId);
              setRemoteStreams(s => {
                const m = new Map(s);
                m.delete(remoteId);
                return m;
              });
              break;
          }
        };

        ws.current.onerror = e => console.error('WS error', e);
        ws.current.onclose = () => console.log('WS closed');
      })
      .catch(err => {
        console.error('Media failure', err);
        alert('Cannot access camera/mic');
      });

    return () => handleEndCall();
  }, [roomId, userId, send, createPeerConnection, handleEndCall]);

  const remoteVideos = Array.from(remoteStreams.entries());

  return (
    <div className={`min-h-screen text-white flex flex-col ${BG_GRADIENT}`}>
      <header className="px-4 py-2 shrink-0">
        <h1 className="text-xl font-bold">
          Room: <span className="text-blue-100">{roomId}</span>
        </h1>
      </header>

      <main className="flex-1 min-h-0">
        <VideoGridLayout>
          {localStream && (
            <VideoPlayer
              stream={localStream}
              muted
              label={`You (${userId})`}
            />
          )}
          {remoteVideos.map(([id, stream]) => (
            <VideoPlayer
              key={id}
              stream={stream}
              muted={false}
              label={id}
            />
          ))}
        </VideoGridLayout>
      </main>

      <footer className="w-full flex justify-center p-4 shrink-0">
        <div className="bg-gray-800 bg-opacity-70 backdrop-blur-md p-3 rounded-full flex items-center gap-4">
          <button
            onClick={toggleMute}
            className={`p-3 rounded-full transition-colors ${
              isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <button
            onClick={toggleVideo}
            className={`p-3 rounded-full transition-colors ${
              isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>
          <button
            onClick={handleShareScreen}
            className={`p-3 rounded-full transition-colors ${
              isSharingScreen ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            <ScreenShare size={20} />
          </button>
          <button
            onClick={handleEndCall}
            className="p-3 bg-red-600 hover:bg-red-700 rounded-full transition-colors"
          >
            <XCircle size={20} />
          </button>
        </div>
      </footer>
    </div>
  );
}
