import React, { useEffect, useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import * as faceMesh from "@mediapipe/face_mesh";
import * as cam from "@mediapipe/camera_utils";
import * as drawingUtils from "@mediapipe/drawing_utils";
import "../../styles/faceTracking.css";

const FaceTracking = ({
  isRunning,
  currentTimer,
  onAttentionChange,
  soundEnabled,
}) => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const faceMeshRef = useRef(null);
  const [isAttentionOn, setIsAttentionOn] = useState(true);
  const [lastAttentionState, setLastAttentionState] = useState(true);
  const [faceDetected, setFaceDetected] = useState(false);
  const [multipleFaces, setMultipleFaces] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Use refs for threshold values to avoid component re-renders
  const horizontalThresholdRef = useRef(
    parseFloat(localStorage.getItem("focus-guard-horizontal") || "0.25")
  );
  const tiltThresholdRef = useRef(
    parseFloat(localStorage.getItem("focus-guard-tilt") || "0.1")
  );

  // UI state for sliders
  const [horizontalThresholdUI, setHorizontalThresholdUI] = useState(
    horizontalThresholdRef.current
  );
  const [tiltThresholdUI, setTiltThresholdUI] = useState(
    tiltThresholdRef.current
  );

  // Debounce timers
  const horizontalDebounceRef = useRef(null);
  const tiltDebounceRef = useRef(null);

  // Sound effect for notification
  const alertSound = useRef(new Audio("/sounds/attention-alert.mp3"));

  const playAlertSound = useCallback(() => {
    // Only play sound if enabled in settings
    if (soundEnabled !== false) {
      try {
        if (alertSound.current) {
          alertSound.current.currentTime = 0;
          alertSound.current.play().catch((err) => {
            console.log("Audio play error, possibly file not found:", err);
          });
        }
      } catch (err) {
        console.log("Error playing alert sound:", err);
      }
    }
  }, [soundEnabled]);

  const showNotification = useCallback(
    (message) => {
      // Visual notification using browser notification API
      if (Notification.permission === "granted") {
        new Notification("Focus Guard", {
          body: message,
          icon: "/logo192.png",
        });
      }
      // Play sound
      playAlertSound();
    },
    [playAlertSound]
  );

  // Request notification permission
  useEffect(() => {
    if (
      Notification.permission !== "granted" &&
      Notification.permission !== "denied"
    ) {
      Notification.requestPermission();
    }
  }, []);

  const onResults = useCallback((results) => {
    if (
      !canvasRef.current ||
      !webcamRef.current?.video ||
      !webcamRef.current.video.videoWidth ||
      !webcamRef.current.video.videoHeight
    )
      return;

    const videoWidth = webcamRef.current.video.videoWidth;
    const videoHeight = webcamRef.current.video.videoHeight;

    // Set canvas width and height
    canvasRef.current.width = videoWidth;
    canvasRef.current.height = videoHeight;

    const canvasCtx = canvasRef.current.getContext("2d");
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, videoWidth, videoHeight);

    // Mirror the canvas to match the mirrored webcam
    canvasCtx.scale(-1, 1);
    canvasCtx.translate(-videoWidth, 0);

    // Check if faces were detected
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      setFaceDetected(true);
      setMultipleFaces(results.multiFaceLandmarks.length > 1);

      // Draw face mesh
      for (const landmarks of results.multiFaceLandmarks) {
        drawingUtils.drawConnectors(
          canvasCtx,
          landmarks,
          faceMesh.FACEMESH_TESSELATION,
          { color: "#C0C0C070", lineWidth: 1 }
        );

        // Eye landmarks
        drawingUtils.drawConnectors(
          canvasCtx,
          landmarks,
          faceMesh.FACEMESH_RIGHT_EYE,
          { color: "#FF3030", lineWidth: 2 }
        );
        drawingUtils.drawConnectors(
          canvasCtx,
          landmarks,
          faceMesh.FACEMESH_LEFT_EYE,
          { color: "#30FF30", lineWidth: 2 }
        );

        // Analyze eye direction and head pose to determine attention
        // We'll use simplified logic based on face landmarks

        // Get face orientation from nose and eye positions
        const nose = landmarks[1];
        const leftEye = landmarks[159];
        const rightEye = landmarks[386];

        // Use the refs for threshold values to avoid component re-renders
        const faceForward =
          Math.abs(nose.z - (leftEye.z + rightEye.z) / 2) <
            tiltThresholdRef.current &&
          Math.abs(nose.x - 0.5) < horizontalThresholdRef.current;

        // For attention detection, only consider face direction, not eye openness
        // This allows natural blinking without losing attention tracking
        const isAttentive = faceForward;

        setIsAttentionOn(isAttentive);
      }
    } else {
      setFaceDetected(false);
      setMultipleFaces(false);
      setIsAttentionOn(false);
    }

    canvasCtx.restore();
  }, []);

  // Initialize FaceMesh
  useEffect(() => {
    // Always create a new FaceMesh instance when needed
    faceMeshRef.current = new faceMesh.FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      },
    });

    faceMeshRef.current.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMeshRef.current.onResults(onResults);

    // Only clean up camera when component unmounts
    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
        cameraRef.current = null;
      }
    };
  }, [onResults]); // Only depend on onResults, not on isRunning or currentTimer

  // Setup/cleanup camera based on timer running state
  useEffect(() => {
    // Stop camera when not running or not in focus mode
    if (!isRunning || currentTimer !== "focus") {
      if (cameraRef.current) {
        cameraRef.current.stop();
        cameraRef.current = null;
      }
      return;
    }

    // Don't proceed if video or FaceMesh isn't ready
    if (
      !webcamRef.current ||
      !webcamRef.current.video ||
      !faceMeshRef.current
    ) {
      return;
    }

    // If camera already exists, no need to reinitialize
    if (cameraRef.current) {
      return;
    }

    // Initialize camera with polling for video readiness
    const initCamera = () => {
      // Make sure video has dimensions
      if (
        !webcamRef.current ||
        !webcamRef.current.video ||
        !webcamRef.current.video.videoWidth ||
        !webcamRef.current.video.videoHeight
      ) {
        // Wait for video to be ready and try again
        setTimeout(initCamera, 100);
        return;
      }

      // Only create camera when video is fully ready
      const camera = new cam.Camera(webcamRef.current.video, {
        onFrame: async () => {
          if (
            webcamRef.current &&
            webcamRef.current.video &&
            webcamRef.current.video.readyState === 4 &&
            faceMeshRef.current
          ) {
            try {
              await faceMeshRef.current.send({
                image: webcamRef.current.video,
              });
            } catch (err) {
              console.error("FaceMesh send error:", err);
            }
          }
        },
        width: 640,
        height: 480,
      });

      camera
        .start()
        .then(() => {
          cameraRef.current = camera;
        })
        .catch((error) => {
          console.error("Camera start error:", error);
          setPermissionDenied(true);
        });
    };

    // Start camera initialization
    initCamera();

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
        cameraRef.current = null;
      }
    };
  }, [isRunning, currentTimer]);

  // Effect for handling attention state changes
  useEffect(() => {
    if (lastAttentionState !== isAttentionOn) {
      // Notify parent component of attention change
      onAttentionChange(isAttentionOn);

      // Show notification when attention is lost
      if (!isAttentionOn) {
        showNotification("Come back! Your focus timer is paused.");
      }

      setLastAttentionState(isAttentionOn);
    }
  }, [isAttentionOn, lastAttentionState, onAttentionChange, showNotification]);

  // Handle edge cases with notifications - use a ref to prevent too many notifications
  const notificationTimeoutRef = useRef(null);

  useEffect(() => {
    if (isRunning && currentTimer === "focus") {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }

      if (!faceDetected) {
        notificationTimeoutRef.current = setTimeout(() => {
          showNotification("Please keep your face visible to the camera.");
        }, 3000); // Wait 3 seconds before showing this notification
      } else if (multipleFaces) {
        notificationTimeoutRef.current = setTimeout(() => {
          showNotification("Only one person should be visible to the camera.");
        }, 3000);
      }
    }

    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, [faceDetected, multipleFaces, isRunning, currentTimer, showNotification]);

  const handleVideoLoad = useCallback(() => {
    // Video is ready, but we don't need to track this in state anymore
  }, []);

  // Reset tracking state when not running
  useEffect(() => {
    if (!isRunning || currentTimer !== "focus") {
      // Reset face tracking states when we're not in focus mode
      setFaceDetected(false);
      setMultipleFaces(false);
    }
  }, [isRunning, currentTimer]);

  // Handler for threshold changes with debouncing
  const handleHorizontalChange = (e) => {
    const newValue = parseFloat(e.target.value);
    setHorizontalThresholdUI(newValue);

    // Clear any existing debounce timer
    if (horizontalDebounceRef.current) {
      clearTimeout(horizontalDebounceRef.current);
    }

    // Set a new debounce timer
    horizontalDebounceRef.current = setTimeout(() => {
      horizontalThresholdRef.current = newValue;
      localStorage.setItem("focus-guard-horizontal", newValue.toString());
    }, 200); // 200ms debounce
  };

  const handleTiltChange = (e) => {
    const newValue = parseFloat(e.target.value);
    setTiltThresholdUI(newValue);

    // Clear any existing debounce timer
    if (tiltDebounceRef.current) {
      clearTimeout(tiltDebounceRef.current);
    }

    // Set a new debounce timer
    tiltDebounceRef.current = setTimeout(() => {
      tiltThresholdRef.current = newValue;
      localStorage.setItem("focus-guard-tilt", newValue.toString());
    }, 200); // 200ms debounce
  };

  const toggleSettings = () => {
    setShowSettings((prev) => !prev);
  };

  // Clean up debounce timers on unmount
  useEffect(() => {
    return () => {
      if (horizontalDebounceRef.current) {
        clearTimeout(horizontalDebounceRef.current);
      }
      if (tiltDebounceRef.current) {
        clearTimeout(tiltDebounceRef.current);
      }
    };
  }, []);

  if (!isRunning || currentTimer !== "focus") {
    return null;
  }

  return (
    <div className="face-tracking-container">
      <div className="webcam-container">
        <Webcam
          ref={webcamRef}
          audio={false}
          width={320}
          height={240}
          mirrored={true}
          screenshotFormat="image/jpeg"
          className="webcam"
          onLoadedMetadata={handleVideoLoad}
          onLoadedData={handleVideoLoad}
          videoConstraints={{
            width: 640,
            height: 480,
            facingMode: "user",
          }}
        />
        <canvas ref={canvasRef} className="face-mesh-canvas" />
      </div>

      <div className="tracking-status">
        {permissionDenied ? (
          <div className="status-message error">
            <span className="status-icon">⚠️</span>
            Camera access denied. Please enable camera permissions and reload.
          </div>
        ) : faceDetected ? (
          multipleFaces ? (
            <div className="status-message warning">
              <span className="status-icon">⚠️</span>
              Multiple faces detected. Please ensure only one face is visible.
            </div>
          ) : (
            <div
              className={`status-message ${
                isAttentionOn ? "success" : "warning"
              }`}
            >
              <span className="status-icon">{isAttentionOn ? "✅" : "⚠️"}</span>
              {isAttentionOn
                ? "Attention detected"
                : "Looking away - timer paused"}
            </div>
          )
        ) : (
          <div className="status-message warning">
            <span className="status-icon">⚠️</span>
            No face detected. Please position your face in front of the camera.
          </div>
        )}
      </div>

      <div className="tracking-settings">
        <button className="settings-toggle" onClick={toggleSettings}>
          {showSettings ? "Hide Settings" : "Customize Safe Zone"}
        </button>

        {showSettings && (
          <div className="settings-panel">
            <div className="setting">
              <label>
                Left/Right Movement Tolerance:{" "}
                {horizontalThresholdUI.toFixed(2)}
                <input
                  type="range"
                  min="0.05"
                  max="0.4"
                  step="0.01"
                  value={horizontalThresholdUI}
                  onChange={handleHorizontalChange}
                />
              </label>
              <div className="slider-labels">
                <span>Strict</span>
                <span>Lenient</span>
              </div>
            </div>

            <div className="setting">
              <label>
                Head Tilt Tolerance: {tiltThresholdUI.toFixed(2)}
                <input
                  type="range"
                  min="0.05"
                  max="0.4"
                  step="0.01"
                  value={tiltThresholdUI}
                  onChange={handleTiltChange}
                />
              </label>
              <div className="slider-labels">
                <span>Strict</span>
                <span>Lenient</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FaceTracking;
