'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Hand, Info, RefreshCw } from 'lucide-react';
import {
  DrawingUtils,
  FilesetResolver,
  HandLandmarker,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';

// These are four demo hand poses, not verified ASL translations.
const DEMO_POSES = [
  { name: 'Hello', icon: '🖐️', instruction: 'Open your palm and spread all five fingers.' },
  { name: 'Yes', icon: '✊', instruction: 'Make a closed fist, including the thumb.' },
  { name: 'Question', icon: '☝️', instruction: 'Raise only your index finger.' },
  { name: 'Repeat', icon: '✌️', instruction: 'Raise your index and middle fingers together.' },
];

const isRaised = (points: NormalizedLandmark[], tip: number, joint: number) =>
  points[tip].y < points[joint].y;

function classify(points: NormalizedLandmark[]): string | null {
  const index = isRaised(points, 8, 6);
  const middle = isRaised(points, 12, 10);
  const ring = isRaised(points, 16, 14);
  const pinky = isRaised(points, 20, 18);
  const thumb = Math.abs(points[4].x - points[2].x) > 0.06;

  if (index && middle && ring && pinky && thumb) return 'Hello';
  if (!index && !middle && !ring && !pinky && !thumb) return 'Yes';
  if (index && !middle && !ring && !pinky) return 'Question';
  if (index && middle && !ring && !pinky) return 'Repeat';
  return null;
}

function cameraError(error: unknown): string {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Camera access requires HTTPS or localhost. Open the app at http://localhost:3000 on this computer.';
  }
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')
      return 'Camera permission was blocked. Allow camera access in your browser site settings, then retry.';
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError')
      return 'No webcam was detected. Connect a webcam or enable your built-in camera.';
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError')
      return 'Your camera is already in use or unavailable. Close other camera apps and retry.';
    if (error.name === 'OverconstrainedError')
      return 'This camera does not support the requested settings.';
  }
  return error instanceof Error ? error.message : 'Could not start the camera. Please try again.';
}

export default function WebcamPanel({ onSign }: { onSign: (word: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const callbackRef = useRef(onSign);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showGuide, setShowGuide] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => { callbackRef.current = onSign; }, [onSign]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let handTracker: HandLandmarker | null = null;
    let stream: MediaStream | null = null;
    let frameId = 0;
    let previousVideoTime = -1;
    let previousLabel: string | null = null;
    let lastEmitted: string | null = null;
    let stableSince = 0;
    let neutralSince = 0;
    let stage: 'camera' | 'model' | 'processing' = 'camera';

    // Strict Mode can clean up an effect while getUserMedia is still pending.
    // Any camera acquired after cleanup must be released immediately.

    async function startCamera() {
      setLoading(true);
      setLabel(null);
      setError('');

      try {
        // Ask for camera access first so permission problems are easy to diagnose.
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera API is unavailable. Use Chrome or Edge on HTTPS or localhost.');
        }
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        stage = 'model';

        // Hand tracking happens in the browser; video frames are never uploaded.
        const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm',
        );
        if (cancelled) return;
        handTracker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        });
        if (cancelled) {
          handTracker.close();
          return;
        }

        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) throw new Error('Unable to initialize the camera overlay.');
        const drawing = new DrawingUtils(context);
        setLoading(false);
        stage = 'processing';

        function processFrame() {
          if (cancelled || !handTracker || !canvas || !context || !video) return;
          if (video.readyState >= 2 && video.currentTime !== previousVideoTime) {
            previousVideoTime = video.currentTime;
            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
            }
            context.clearRect(0, 0, canvas.width, canvas.height);
            let result;
            try {
              result = handTracker.detectForVideo(video, performance.now());
            } catch (cause) {
              setError(`Hand tracking stopped: ${cameraError(cause)}`);
              return;
            }
            const points = result.landmarks[0];
            if (points) {
              drawing.drawConnectors(points, HandLandmarker.HAND_CONNECTIONS, {
                color: '#55e7d0', lineWidth: 3,
              });
              drawing.drawLandmarks(points, { color: '#ffffff', radius: 3 });
            }

            const detected = points ? classify(points) : null;
            setLabel(detected);
            const now = performance.now();
            if (detected !== previousLabel) {
              previousLabel = detected;
              stableSince = now;
            }
            if (detected && now - stableSince >= 650 && detected !== lastEmitted) {
              lastEmitted = detected;
              callbackRef.current(detected);
            }
            if (!detected) {
              if (!neutralSince) neutralSince = now;
              if (now - neutralSince > 550) lastEmitted = null;
            } else {
              neutralSince = 0;
            }
          }
          frameId = requestAnimationFrame(processFrame);
        }
        processFrame();
      } catch (cause) {
        if (!cancelled) {
          const message = cameraError(cause);
          setError(stage === 'model'
            ? `Camera opened, but the hand-tracking model failed to load: ${message}`
            : stage === 'processing'
              ? `Hand tracking failed: ${message}`
              : `Camera failed to start: ${message}`);
          setLoading(false);
        }
        // Leave the video visible if only the model failed. The camera is
        // released when the user presses Stop or retries.
        if (stage === 'camera') {
          stream?.getTracks().forEach(track => track.stop());
        }
      }
    }

    void startCamera();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      stream?.getTracks().forEach(track => track.stop());
      handTracker?.close();
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [enabled, attempt]);

  return (
    <div className="camera-widget">
      <div className="camera-head">
        <span><Camera size={18} /> Demo sign camera</span>
        <button
          type="button"
          className={enabled ? 'camera-toggle is-on' : 'camera-toggle'}
          onClick={() => { setEnabled(value => !value); setError(''); }}
          aria-pressed={enabled}
        >
          {enabled ? 'Stop camera' : 'Start camera'}
        </button>
      </div>

      {enabled ? (
        <div className="camera-frame">
          <video ref={videoRef} muted playsInline autoPlay className="camera-video" />
          <canvas ref={canvasRef} className="camera-overlay" aria-hidden="true" />
          <div className="camera-label">
            {loading ? 'Starting camera / loading hand tracker…' : error ? 'Camera or hand tracking needs attention' : label ? `Detected: ${label}` : 'Show a supported demo pose'}
          </div>
        </div>
      ) : (
        <div className="camera-placeholder">
          <CameraOff size={32} />
          <p>Your camera stays off until you start it.</p>
        </div>
      )}

      {error && (
        <div className="camera-error" role="alert">
          <p>{error}</p>
          <button type="button" className="camera-toggle" onClick={() => setAttempt(value => value + 1)}>
            <RefreshCw size={14} /> Retry camera
          </button>
        </div>
      )}

      <div className="pose-guide">
        <button
          type="button"
          className="pose-guide-toggle"
          aria-expanded={showGuide}
          onClick={() => setShowGuide(value => !value)}
        >
          <Hand size={16} /> Demo gestures you can try <span>{showGuide ? 'Hide' : 'Show'}</span>
        </button>
        {showGuide && (
          <div className="pose-guide-grid">
            {DEMO_POSES.map(pose => (
              <div className="pose-guide-item" key={pose.name}>
                <span className="pose-guide-emoji" aria-hidden="true">{pose.icon}</span>
                <div><strong>{pose.name}</strong><p>{pose.instruction}</p></div>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="camera-disclaimer"><Info size={14} /> These are approximate demo poses, not validated ASL signs. Keep your palm facing the camera with fingers upright and hold a pose for one second. Detection can be unreliable with rotated hands or different thumb positions. Video is processed locally; only recognized labels are sent to the room.</p>
    </div>
  );
}
