import React, { useEffect, useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
// import * as faceMesh from "@mediapipe/face_mesh"; // Remove FaceMesh import
import * as faceDetection from "@mediapipe/face_detection"; // Add FaceDetection import
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
  // const faceMeshRef = useRef(null); // Remove FaceMesh ref
  const faceDetectionRef = useRef(null); // Add FaceDetection ref
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

  const onResults = useCallback(
    (results) => {
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

      // Check if faces were detected by BlazeFace
      if (results.detections && results.detections.length > 0) {
        setFaceDetected(true);
        setMultipleFaces(results.detections.length > 1);

        // Use the first detection for attention tracking
        const detection = results.detections[0];

        // Draw bounding box
        drawingUtils.drawRectangle(
          canvasCtx,
          detection.boundingBox,
          { color: "black", lineWidth: 2, fillColor: "#00000000" } // Black bounding box
        );

        // Define connections for the 6 BlazeFace landmarks
        // 0: Right Eye, 1: Left Eye, 2: Nose, 3: Mouth, 4: Right Ear, 5: Left Ear
        const blazeFaceConnections = [
          [0, 1], // Right Eye to Left Eye
          [0, 2], // Right Eye to Nose
          [1, 2], // Left Eye to Nose
          [2, 3], // Nose to Mouth
          [0, 4], // Right Eye to Right Ear
          [1, 5], // Left Eye to Left Ear
          // Optional: Add connections for a basic jawline if desired
          // [4, 3], // Right Ear to Mouth
          // [5, 3], // Left Ear to Mouth
        ];

        // Draw landmarks (dots)
        drawingUtils.drawLandmarks(canvasCtx, detection.landmarks, {
          color: "#30FF30", // Green dots
          radius: 3, // Adjust size as needed
        });

        // Draw connectors (lines)
        drawingUtils.drawConnectors(
          canvasCtx,
          detection.landmarks,
          blazeFaceConnections,
          {
            color: "#FFFFFF", // White lines
            lineWidth: 1,
          }
        );

        // Analyze face position using nose landmark (index 2 in BlazeFace landmarks)
        // Landmarks: 0: right eye, 1: left eye, 2: nose, 3: mouth, 4: right ear, 5: left ear
        const nose = detection.landmarks[2];
        // No need for left/right eye for this simplified logic
        // const leftEye = detection.landmarks[1];
        // const rightEye = detection.landmarks[0];

        if (nose) {
          // Use normalized coordinates (0.0 to 1.0)
          const lookingHorizontally =
            Math.abs(nose.x - 0.5) < horizontalThresholdRef.current;
          const lookingVertically = // Simplified tilt detection based on nose vertical position
            Math.abs(nose.y - 0.5) < tiltThresholdRef.current; // Compare nose y to vertical center

          const isAttentive = lookingHorizontally && lookingVertically;
          setIsAttentionOn(isAttentive);
        } else {
          // If landmarks aren't available for some reason, assume not attentive
          setIsAttentionOn(false);
        }
      } else {
        setFaceDetected(false);
        setMultipleFaces(false);
        setIsAttentionOn(false);
      }

      canvasCtx.restore();
    },
    [] // Remove dependencies on threshold refs here, they are accessed directly inside
  );

  // Initialize FaceDetection (BlazeFace)
  useEffect(() => {
    // Always create a new FaceDetection instance when needed
    faceDetectionRef.current = new faceDetection.FaceDetection({
      locateFile: (file) => {
        // Use the face_detection model files
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
      },
    });

    faceDetectionRef.current.setOptions({
      model: "short", // Use the short-range model
      minDetectionConfidence: 0.5,
    });

    faceDetectionRef.current.onResults(onResults);

    // Cleanup camera when component unmounts
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

    // Don't proceed if video or FaceDetection isn't ready
    if (
      !webcamRef.current ||
      !webcamRef.current.video ||
      // !faceMeshRef.current // Check FaceDetection ref instead
      !faceDetectionRef.current
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
            // faceMeshRef.current // Check FaceDetection ref instead
            faceDetectionRef.current
          ) {
            try {
              await faceDetectionRef.current.send({
                // Send to FaceDetection
                image: webcamRef.current.video,
              });
            } catch (err) {
              // console.error("FaceMesh send error:", err); // Update error message source
              console.error("FaceDetection send error:", err);
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
