/**
 * Voice Chat Service using WebRTC P2P (Mesh)
 * Powered by Supabase Realtime broadcast signaling.
 * Ultra-low latency, 100% free, no 3rd-party subscription required.
 */
import { multiplayerAdapter } from './multiplayerAdapter.js';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.services.mozilla.com' },
  ],
};

class VoiceChatService {
  constructor() {
    this.roomCode = null;
    this.myPlayerId = null;
    this.myPlayerName = null;
    this.localStream = null;
    this.audioContext = null;
    this.analyser = null;
    this.animFrameId = null;

    this.isMuted = true;
    this.isConnected = false;
    this.isSpeaking = false;

    // Map: peerId -> RTCPeerConnection
    this.peerConnections = new Map();
    // Map: peerId -> HTMLAudioElement
    this.remoteAudios = new Map();
    // Map: peerId -> Array of RTCIceCandidateInit (queued candidates before remote description is set)
    this.pendingCandidates = new Map();

    // Callbacks
    this.onSpeakingChange = null; // (playerId, isSpeaking) => void
    this.onStatusChange = null;   // ({ isConnected, isMuted, error }) => void
    this.speakingPeers = new Set();
  }

  isSupported() {
    return (
      typeof window !== 'undefined' &&
      !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) &&
      !!window.RTCPeerConnection
    );
  }

  /**
   * Initializes microphone and joins room voice channel
   */
  async joinRoom(roomCode, myPlayerId, myPlayerName, callbacks = {}) {
    if (!this.isSupported()) {
      if (callbacks.onStatusChange) {
        callbacks.onStatusChange({
          isConnected: false,
          isMuted: true,
          error: 'Browser tidak mendukung WebRTC Voice Chat.',
        });
      }
      return false;
    }

    this.roomCode = roomCode.trim().toUpperCase();
    this.myPlayerId = myPlayerId;
    this.myPlayerName = myPlayerName;
    this.onSpeakingChange = callbacks.onSpeakingChange || null;
    this.onStatusChange = callbacks.onStatusChange || null;

    try {
      // 1. Request microphone stream
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      // Default to UNMUTED when intentionally clicking join, or MUTED if requested
      this.isMuted = false;
      this.setMute(false);

      // 2. Setup audio analyser for speaking indicator
      this.setupAudioAnalysis(this.localStream);

      this.isConnected = true;
      if (this.onStatusChange) {
        this.onStatusChange({
          isConnected: true,
          isMuted: this.isMuted,
          error: null,
        });
      }

      // 3. Broadcast voice_join to all peers in the room
      await this.sendSignal({
        type: 'voice_join',
        senderId: this.myPlayerId,
        senderName: this.myPlayerName,
      });

      return true;
    } catch (err) {
      console.warn('[VoiceChat] Mic permission error or cancelled:', err);
      this.isConnected = false;
      if (this.onStatusChange) {
        this.onStatusChange({
          isConnected: false,
          isMuted: true,
          error: 'Izin mikrofon ditolak atau tidak tersedia.',
        });
      }
      return false;
    }
  }

  /**
   * Toggle mute / unmute
   */
  toggleMute() {
    return this.setMute(!this.isMuted);
  }

  setMute(muted) {
    this.isMuted = muted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }

    if (this.isMuted && this.isSpeaking) {
      this.isSpeaking = false;
      if (this.onSpeakingChange) this.onSpeakingChange(this.myPlayerId, false);
      this.broadcastSpeaking(false);
    }

    if (this.onStatusChange) {
      this.onStatusChange({
        isConnected: this.isConnected,
        isMuted: this.isMuted,
        error: null,
      });
    }
    return this.isMuted;
  }

  /**
   * Leave voice chat & release microphone
   */
  async leaveRoom() {
    if (this.isConnected && this.roomCode) {
      try {
        await this.sendSignal({
          type: 'voice_leave',
          senderId: this.myPlayerId,
        });
      } catch (e) {}
    }

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch (e) {}
    }
    this.audioContext = null;
    this.analyser = null;

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Close all peer connections
    this.peerConnections.forEach((pc) => {
      try {
        pc.close();
      } catch (e) {}
    });
    this.peerConnections.clear();
    this.pendingCandidates.clear();

    // Remove remote audio elements
    this.remoteAudios.forEach((audioEl) => {
      try {
        audioEl.pause();
        audioEl.srcObject = null;
        audioEl.remove();
      } catch (e) {}
    });
    this.remoteAudios.clear();

    this.speakingPeers.clear();
    this.isConnected = false;
    this.isMuted = true;
    this.isSpeaking = false;

    if (this.onStatusChange) {
      this.onStatusChange({
        isConnected: false,
        isMuted: true,
        error: null,
      });
    }
  }

  /**
   * Handle incoming WebRTC signaling message
   */
  async handleIncomingSignal(signal) {
    if (!signal || !this.isConnected || !this.localStream) return;
    const { type, senderId, targetId, data } = signal;

    // Ignore signals sent by self
    if (senderId === this.myPlayerId) return;

    // If signal is targeted and not meant for this player, ignore
    if (targetId && targetId !== this.myPlayerId) return;

    try {
      if (type === 'voice_join') {
        // A peer joined or announced their voice presence.
        // As an active connected peer with a microphone, initiate a call to the newcomer!
        await this.initiateCall(senderId);
      } else if (type === 'voice_offer') {
        await this.handleOffer(senderId, data);
      } else if (type === 'voice_answer') {
        await this.handleAnswer(senderId, data);
      } else if (type === 'voice_ice') {
        await this.handleIceCandidate(senderId, data);
      } else if (type === 'voice_speaking') {
        const isPeerSpeaking = !!signal.isSpeaking;
        if (this.onSpeakingChange) {
          this.onSpeakingChange(senderId, isPeerSpeaking);
        }
      } else if (type === 'voice_leave') {
        this.closePeer(senderId);
        if (this.onSpeakingChange) {
          this.onSpeakingChange(senderId, false);
        }
      }
    } catch (err) {
      console.warn('[VoiceChat] Signal error:', type, err);
    }
  }

  /**
   * Create or retrieve peer connection
   */
  getOrCreatePeerConnection(peerId) {
    if (this.peerConnections.has(peerId)) {
      return this.peerConnections.get(peerId);
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local audio tracks to send voice
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });
    }

    // Send local ICE candidates to remote peer
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          type: 'voice_ice',
          senderId: this.myPlayerId,
          targetId: peerId,
          data: event.candidate,
        });
      }
    };

    // Receive remote audio track
    pc.ontrack = (event) => {
      let audioEl = this.remoteAudios.get(peerId);
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.playsInline = true;
        audioEl.setAttribute('playsinline', 'true');
        audioEl.setAttribute('autoplay', 'true');
        audioEl.volume = 1.0;
        audioEl.muted = false;
        // Avoid display: none because mobile WebKit (Safari/iOS) can suspend audio playback on hidden elements
        audioEl.style.position = 'fixed';
        audioEl.style.top = '-9999px';
        audioEl.style.left = '-9999px';
        audioEl.style.width = '1px';
        audioEl.style.height = '1px';
        audioEl.style.opacity = '0.01';
        audioEl.style.pointerEvents = 'none';
        document.body.appendChild(audioEl);
        this.remoteAudios.set(peerId, audioEl);
      }

      const stream =
        event.streams && event.streams[0]
          ? event.streams[0]
          : new MediaStream([event.track]);

      audioEl.srcObject = stream;

      // Ensure playback starts even under strict browser autoplay policies
      const playPromise = audioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('[VoiceChat] Audio playback waiting for user gesture:', err);
          const resumeAudio = () => {
            audioEl.play().catch(() => {});
            document.removeEventListener('click', resumeAudio);
            document.removeEventListener('touchstart', resumeAudio);
          };
          document.addEventListener('click', resumeAudio, { once: true });
          document.addEventListener('touchstart', resumeAudio, { once: true });
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        this.closePeer(peerId);
      }
    };

    this.peerConnections.set(peerId, pc);
    return pc;
  }

  async initiateCall(peerId) {
    try {
      const pc = this.getOrCreatePeerConnection(peerId);
      if (pc.signalingState !== 'stable') {
        return;
      }

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        voiceActivityDetection: true,
      });
      await pc.setLocalDescription(offer);

      await this.sendSignal({
        type: 'voice_offer',
        senderId: this.myPlayerId,
        targetId: peerId,
        data: offer,
      });
    } catch (err) {
      console.warn('[VoiceChat] Failed to initiate call to', peerId, err);
    }
  }

  async handleOffer(peerId, offer) {
    try {
      const pc = this.getOrCreatePeerConnection(peerId);

      const isCollision =
        offer.type === 'offer' &&
        (pc.signalingState !== 'stable' || pc.connectionState === 'connecting');

      const isPolite = this.myPlayerId < peerId;

      if (isCollision) {
        if (!isPolite) {
          // Impolite peer ignores colliding incoming offer
          return;
        }
        try {
          await pc.setLocalDescription({ type: 'rollback' });
        } catch (e) {
          // Fallback if rollback is not supported
        }
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await this.flushPendingCandidates(peerId);

      const answer = await pc.createAnswer({
        offerToReceiveAudio: true,
      });
      await pc.setLocalDescription(answer);

      await this.sendSignal({
        type: 'voice_answer',
        senderId: this.myPlayerId,
        targetId: peerId,
        data: answer,
      });
    } catch (err) {
      console.warn('[VoiceChat] Failed to handle offer from', peerId, err);
    }
  }

  async handleAnswer(peerId, answer) {
    try {
      const pc = this.peerConnections.get(peerId);
      if (pc && pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await this.flushPendingCandidates(peerId);
      }
    } catch (err) {
      console.warn('[VoiceChat] Failed to handle answer from', peerId, err);
    }
  }

  async handleIceCandidate(peerId, candidate) {
    if (!candidate) return;
    await this.addIceCandidateSafe(peerId, candidate);
  }

  async addIceCandidateSafe(peerId, candidate) {
    const pc = this.peerConnections.get(peerId);
    // If connection doesn't exist yet, or remote description is not ready yet:
    if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
      if (!this.pendingCandidates.has(peerId)) {
        this.pendingCandidates.set(peerId, []);
      }
      this.pendingCandidates.get(peerId).push(candidate);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('[VoiceChat] Failed to add ICE candidate:', err);
    }
  }

  async flushPendingCandidates(peerId) {
    const pc = this.peerConnections.get(peerId);
    if (!pc || !pc.remoteDescription) return;

    const queued = this.pendingCandidates.get(peerId);
    if (queued && queued.length > 0) {
      this.pendingCandidates.delete(peerId);
      for (const cand of queued) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (err) {
          console.warn('[VoiceChat] Failed to add queued ICE candidate:', err);
        }
      }
    }
  }

  closePeer(peerId) {
    this.pendingCandidates.delete(peerId);

    const pc = this.peerConnections.get(peerId);
    if (pc) {
      try {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.close();
      } catch (e) {}
      this.peerConnections.delete(peerId);
    }

    const audioEl = this.remoteAudios.get(peerId);
    if (audioEl) {
      try {
        audioEl.pause();
        audioEl.srcObject = null;
        audioEl.remove();
      } catch (e) {}
      this.remoteAudios.delete(peerId);
    }
  }

  /**
   * Monitor speaking volume via Web Audio API Analyser
   */
  setupAudioAnalysis(stream) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.4;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let speakingCounter = 0;
      let silentCounter = 0;

      const checkVolume = () => {
        if (!this.isConnected || !this.analyser) return;

        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        // Threshold for human speech volume
        const isCurrentlyLoud = average > 14 && !this.isMuted;

        if (isCurrentlyLoud) {
          speakingCounter++;
          silentCounter = 0;
          if (speakingCounter >= 2 && !this.isSpeaking) {
            this.isSpeaking = true;
            if (this.onSpeakingChange) this.onSpeakingChange(this.myPlayerId, true);
            this.broadcastSpeaking(true);
          }
        } else {
          silentCounter++;
          if (silentCounter >= 12 && this.isSpeaking) {
            this.isSpeaking = false;
            speakingCounter = 0;
            if (this.onSpeakingChange) this.onSpeakingChange(this.myPlayerId, false);
            this.broadcastSpeaking(false);
          }
        }

        this.animFrameId = requestAnimationFrame(checkVolume);
      };

      this.animFrameId = requestAnimationFrame(checkVolume);
    } catch (e) {
      console.warn('[VoiceChat] Could not setup analyser:', e);
    }
  }

  async broadcastSpeaking(isSpeaking) {
    if (!this.isConnected || !this.roomCode) return;
    try {
      await this.sendSignal({
        type: 'voice_speaking',
        senderId: this.myPlayerId,
        isSpeaking,
      });
    } catch (e) {}
  }

  async sendSignal(payload) {
    if (!this.roomCode) return false;
    return await multiplayerAdapter.sendVoiceSignal(this.roomCode, payload);
  }
}

export const voiceChat = new VoiceChatService();
