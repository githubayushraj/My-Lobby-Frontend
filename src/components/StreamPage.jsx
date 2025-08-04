import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';

const STUN_SERVER = 'stun:stun.l.google.com:19302';
const WEBSOCKET_URL = 'ws://localhost:8080/signaling';

// Helper component to render video streams
function VideoPlayer({ stream, muted, label }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <div style={{ border: '2px solid #61dafb', borderRadius: 8, padding: 5, backgroundColor: '#3a3f4a' }}>
      <h3>{label}</h3>
      <video ref={ref} autoPlay playsInline muted={muted} style={{ width: 300, borderRadius: 4 }} />
    </div>
  );
}

export default function streamPage() {
  const { roomId, userId } = useParams();
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());

  const ws = useRef(null);
  const peerConnections = useRef(new Map());
  const localStreamRef = useRef(null);

  const send = useCallback((message) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  }, []);

  const createPeerConnection = useCallback((remoteUserId) => {
    console.log(`-- Creating PeerConnection for: ${remoteUserId}`);
    if (peerConnections.current.has(remoteUserId)) {
      return peerConnections.current.get(remoteUserId);
    }
    
    const pc = new RTCPeerConnection({ iceServers: [{ urls: STUN_SERVER }] });

    pc.onicecandidate = event => {
      if (event.candidate) {
        console.log(`... Sending ICE candidate to ${remoteUserId}`);
        send({ type: 'ice_candidate', payload: { remoteUserId, candidate: event.candidate } });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`-- PeerConnection [${remoteUserId}] state changed to: ${pc.connectionState}`);
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        peerConnections.current.delete(remoteUserId);
        setRemoteStreams(prev => {
          const newStreams = new Map(prev);
          newStreams.delete(remoteUserId);
          return newStreams;
        });
      }
    };
    
    // Add local tracks to send to the other peer
    localStreamRef.current?.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
    });

    // Handle receiving tracks from the other peer
    pc.ontrack = (event) => {
        console.log(`✅✅✅ TRACK RECEIVED from: ${remoteUserId} ✅✅✅`);
        setRemoteStreams(prev => new Map(prev).set(remoteUserId, event.streams[0]));
    };

    peerConnections.current.set(remoteUserId, pc);
    return pc;
  }, [send]);

  // The main effect for managing the WebSocket connection and signaling
  useEffect(() => {
    if (!roomId || !userId) return;

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        setLocalStream(stream);
        localStreamRef.current = stream;
        ws.current = new WebSocket(WEBSOCKET_URL);

        ws.current.onopen = () => {
          console.log("✅ WebSocket connected");
          send({ type: 'join', payload: { roomId, userId } });
        };

        ws.current.onmessage = async (event) => {
          const { type, payload } = JSON.parse(event.data);
          // Use a detailed log to see the raw data
          console.log(`⬇️ Message received: type=${type}, payload=`, payload);

          let pc;
          const remoteUserId = payload.userId; // Get the sender's ID

          switch (type) {
            case 'existing_participants': {
              const { userIds } = payload;
              console.log(`... This room has existing participants:`, userIds);
              for (const existingUserId of userIds) {
                pc = createPeerConnection(existingUserId); 
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                console.log(`... Sending offer to existing user: ${existingUserId}`);
                send({ type: 'offer', payload: { remoteUserId: existingUserId, sdp: pc.localDescription } });
              }
              break;
            }

            case 'new_participant': {
              console.log(`... A new user joined: ${remoteUserId}. Waiting for their offer.`);
              break;
            }

            case 'offer': {
                console.log(`... Received offer from: ${remoteUserId}`);
                pc = createPeerConnection(remoteUserId); 
                await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                console.log(`... Sending answer to: ${remoteUserId}`);
                send({ type: 'answer', payload: { remoteUserId, sdp: pc.localDescription } });
                break;
            }

            case 'answer': {
              console.log(`... Received answer from: ${remoteUserId}`);
              pc = peerConnections.current.get(remoteUserId);
              if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
              }
              break;
            }

            case 'ice_candidate': {
              console.log(`... Received ICE candidate from: ${remoteUserId}`);
              pc = peerConnections.current.get(remoteUserId);
              // Strengthened race condition guard
              if (pc && pc.remoteDescription && payload.candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
              } else {
                 console.warn(`... Could not add ICE candidate for ${remoteUserId}. PC not ready or candidate missing.`);
              }
              break;
            }
            
            case 'participant_left': {
                console.log(`... User left: ${remoteUserId}`);
                peerConnections.current.get(remoteUserId)?.close();
                peerConnections.current.delete(remoteUserId);
                setRemoteStreams(prev => {
                    const newStreams = new Map(prev);
                    newStreams.delete(remoteUserId);
                    return newStreams;
                });
                break;
            }

            default:
              console.warn('... Unknown message type:', type);
          }
        };

        ws.current.onerror = (error) => console.error('❌ WebSocket error:', error);
        ws.current.onclose = () => console.log('❌ WebSocket closed');
      })
      .catch(err => {
        console.error('❌ Failed to get local stream', err);
        alert('Could not access your camera or microphone.');
      });

    return () => {
      console.log("Cleaning up component...");
      ws.current?.close();
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      peerConnections.current.forEach(pc => pc.close());
      peerConnections.current.clear();
    };
  }, [roomId, userId, send, createPeerConnection]);

  const remoteVideos = Array.from(remoteStreams.entries());

  return (
    <div style={{ padding: 20, backgroundColor: '#282c34', color: 'white', minHeight: '100vh' }}>
      <h1>Room: {roomId}</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 20 }}>
        {localStream && <VideoPlayer stream={localStream} muted label={`You (${userId})`} />}
        {remoteVideos.map(([id, stream]) => (
          <VideoPlayer key={id} stream={stream} muted={false} label={`Remote (${id})`} />
        ))}
      </div>
    </div>
  );
}