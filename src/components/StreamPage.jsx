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

export default function StreamPage() {
  const { roomId, userId } = useParams(); // Get room/user ID from URL
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());

  // Refs to hold WebSocket, PeerConnections, and local stream without causing re-renders
  const ws = useRef(null);
  const peerConnections = useRef(new Map());
  const localStreamRef = useRef(null);

  // Helper to send messages to the signaling server
  const send = useCallback((message) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  }, []);

  // Creates and configures a new PeerConnection
  const createPeerConnection = useCallback((remoteUserId, isProducer) => {
    console.log(`-- Creating PeerConnection for: ${remoteUserId}`);
    const pc = new RTCPeerConnection({ iceServers: [{ urls: STUN_SERVER }] });

    pc.onicecandidate = event => {
      if (event.candidate) {
        // Send ICE candidate to the other peer via the signaling server
        send({ type: 'ice_candidate', payload: { remoteUserId, candidate: event.candidate } });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`-- PeerConnection [${remoteUserId}] state changed to: ${pc.connectionState}`);
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        // Clean up on failure or closure
        peerConnections.current.delete(remoteUserId);
        setRemoteStreams(prev => {
          const newStreams = new Map(prev);
          newStreams.delete(remoteUserId);
          return newStreams;
        });
      }
    };

    if (isProducer) {
        // If we are producing, add our local tracks to the connection
        localStreamRef.current?.getTracks().forEach(track => {
            pc.addTrack(track, localStreamRef.current);
        });
    } else {
        // If we are consuming, listen for tracks from the remote peer
        pc.ontrack = (event) => {
            console.log(`✅ TRACK RECEIVED from: ${remoteUserId}`);
            setRemoteStreams(prev => new Map(prev).set(remoteUserId, event.streams[0]));
        };
    }

    peerConnections.current.set(remoteUserId, pc);
    return pc;
  }, [send]);

  // The main effect for managing the WebSocket connection and signaling
  useEffect(() => {
    if (!roomId || !userId) return;

    // Start getting local media as soon as the component loads
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        setLocalStream(stream);
        localStreamRef.current = stream;

        // Establish WebSocket connection ONLY after getting media
        ws.current = new WebSocket(WEBSOCKET_URL);

        ws.current.onopen = () => {
          console.log("✅ WebSocket connected");
          // Join the room once connected
          send({ type: 'join', payload: { roomId, userId } });
        };

        ws.current.onmessage = async (event) => {
          const { type, payload } = JSON.parse(event.data);
          console.log(`⬇️ Received message: ${type}`, payload);

          let pc;

          switch (type) {
            // Server tells us who is already in the room
            case 'existing_participants': {
              const { userIds } = payload;
              // For each existing user, create a PeerConnection and send an offer
              for (const remoteUserId of userIds) {
                pc = createPeerConnection(remoteUserId, true);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                send({ type: 'offer', payload: { remoteUserId, sdp: pc.localDescription } });
              }
              break;
            }

            // A new user has joined the room
            case 'new_participant': {
              const { userId: remoteUserId } = payload;
              console.log(`A new user joined: ${remoteUserId}`);
              // We don't do anything yet; the new user will send us an offer
              break;
            }

            // We received an offer from a new participant
            case 'offer': {
                const { userId: remoteUserId, sdp } = payload;
                pc = createPeerConnection(remoteUserId, false);
                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                send({ type: 'answer', payload: { remoteUserId, sdp: pc.localDescription } });
                break;
            }

            // We received an answer to our offer
            case 'answer': {
              const { userId: remoteUserId, sdp } = payload;
              pc = peerConnections.current.get(remoteUserId);
              if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
              }
              break;
            }

            // We received an ICE candidate from a peer
            case 'ice_candidate': {
              const { userId: remoteUserId, candidate } = payload;
              pc = peerConnections.current.get(remoteUserId);
              if (pc && candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              }
              break;
            }
            
            // A user has left the room
            case 'participant_left': {
                const { userId: remoteUserId } = payload;
                console.log(`User left: ${remoteUserId}`);
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
              console.warn('Unknown message type:', type);
          }
        };

        ws.current.onerror = (error) => console.error('WebSocket error:', error);
        ws.current.onclose = () => console.log('WebSocket closed');
      })
      .catch(err => {
        console.error('Failed to get local stream', err);
        alert('Could not access your camera or microphone.');
      });

    // Cleanup function when the component unmounts
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