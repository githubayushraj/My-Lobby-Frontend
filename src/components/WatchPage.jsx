import React, { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import gsap from "gsap";

export default function WatchPage() {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("roomId");

  const ws = useRef(null);
  const pc = useRef(null);

  const containerRef = useRef(null);
  const titleRef = useRef(null);
  const textRef = useRef(null);

  // ✅ Page Animations
  useEffect(() => {
    gsap.from(containerRef.current, { opacity: 0, y: 40, duration: 1, ease: "power3.out" });
    gsap.from(titleRef.current, { opacity: 0, scale: 0.8, duration: 1, delay: 0.2, ease: "back.out(1.7)" });
    gsap.from(textRef.current, { opacity: 0, y: 20, duration: 1, delay: 0.4 });
  }, []);

  useEffect(() => {
    async function initConnection() {
      try {
        pc.current = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });

        // ✅ Play remote audio
        pc.current.ontrack = (event) => {
          const audioElem = document.createElement("audio");
          audioElem.srcObject = event.streams[0];
          audioElem.autoplay = true;
          document.body.appendChild(audioElem);
        };

        pc.current.onicecandidate = (event) => {
          if (event.candidate && ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
          }
        };

        ws.current = new WebSocket(`ws://localhost:8080/ws?roomId=${roomId}`);

        ws.current.onmessage = async (msg) => {
          const { type, sdp, candidate } = JSON.parse(msg.data);

          if (type === "offer") {
            await pc.current.setRemoteDescription({ type, sdp });
            const answer = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answer);
            ws.current.send(JSON.stringify({ type: "answer", sdp: answer.sdp }));
          } else if (type === "answer") {
            await pc.current.setRemoteDescription({ type, sdp });
          } else if (type === "candidate") {
            await pc.current.addIceCandidate(candidate);
          }
        };

        ws.current.onopen = async () => {
          const offer = await pc.current.createOffer();
          await pc.current.setLocalDescription(offer);
          ws.current.send(JSON.stringify({ type: "offer", sdp: offer.sdp }));
        };
      } catch (err) {
        console.error("WebRTC error:", err);
        alert("Failed to connect to the stream. Please check console.");
      }
    }

    initConnection();

    return () => {
      ws.current?.close();
      pc.current?.close();
    };
  }, [roomId]);

  return (
    <div
      ref={containerRef}
      style={{
        padding: "30px",
        textAlign: "center",
        background: "#f9f9f9",
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1
        ref={titleRef}
        style={{ fontSize: "28px", color: "#333", marginBottom: "10px" }}
      >
        🎧 Watching Room: <span style={{ color: "#2196F3" }}>{roomId}</span>
      </h1>
      <p
        ref={textRef}
        style={{ fontSize: "18px", color: "#555" }}
      >
        ✅ You are connected! Listening to the conversation...
      </p>
    </div>
  );
}
