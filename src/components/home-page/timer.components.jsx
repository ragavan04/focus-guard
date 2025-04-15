import React, { useEffect, useState, useRef, useMemo, useContext } from "react";
import { Link } from "react-router-dom";
import FaceTracking from "./faceTracking.component";
import statsService from "../../services/statsService";
import settingsService from "../../services/settingsService";
import skipButton from "../../assets/skip-button.svg";
import profileIcon from "../../assets/profile-icon.svg";
import profile from "../../assets/profile.svg";
import stats from "../../assets/stats.svg";
import friends from "../../assets/friends.svg";
import settings from "../../assets/settings.svg";
import { UserContext } from "../../contexts/user.context";
import { useDarkMode } from "../../contexts/darkMode.context";
import "../../styles/timer.css";

const Timer = ({ onModeChange }) => {
  const { currentUser } = useContext(UserContext);
  // Use the dark mode context instead of local state
  const { darkMode, toggleDarkMode } = useDarkMode();

  const [timerSettings, setTimerSettings] = useState({
    focus: 25 * 60,
    shortBreak: 5 * 60,
    longBreak: 15 * 60,
    faceTrackingEnabled: true,
    soundEnabled: true,
  });

  const [timeLeft, setTimeLeft] = useState(timerSettings.focus);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTimer, setCurrentTimer] = useState("focus");
  const [isPausedByAttention, setIsPausedByAttention] = useState(false);
  const [initialAttentionPause, setInitialAttentionPause] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  // Track completed focus sessions for the pomodoro cycle
  const [completedFocusSessions, setCompletedFocusSessions] = useState(0);

  // Reference to track the current session
  const currentSessionRef = useRef(null);
  // Track the initial time of the session for duration calculation
  const initialTimeRef = useRef(null);
  // Reference for the menu dropdown
  const menuRef = useRef(null);
  // Sound effect for timer completion
  const timerCompleteSound = useRef(new Audio("/sounds/notification.mp3"));

  // Load settings from localStorage on mount
  useEffect(() => {
    const loadedSettings = settingsService.loadSettings();
    setTimerSettings(loadedSettings);
    setTimeLeft(loadedSettings.focus);
  }, []);

  // Request notification permission
  useEffect(() => {
    if (
      Notification.permission !== "granted" &&
      Notification.permission !== "denied"
    ) {
      Notification.requestPermission();
    }
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuRef]);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const startTimer = () => {
    const isStarting = !isRunning;
    setIsRunning(isStarting);

    // Reset attention pause state when manually starting/stopping the timer
    if (isPausedByAttention) {
      setIsPausedByAttention(false);
      setInitialAttentionPause(true);
    }

    // If we're starting a focus timer, create a new session
    if (isStarting && currentTimer === "focus") {
      if (!currentSessionRef.current) {
        console.log("Starting a new focus session");

        // Track if we're using face tracking or basic tracking
        const usingFaceTracking = timerSettings.faceTrackingEnabled;
        console.log(`Face tracking enabled: ${usingFaceTracking}`);

        statsService
          .startSession(usingFaceTracking)
          .then((sessionId) => {
            console.log("Session started with ID:", sessionId);
            currentSessionRef.current = sessionId;
            initialTimeRef.current = timerSettings.focus;
          })
          .catch((error) => {
            console.error("Error starting session:", error);
          });
      }
    }

    // If we're stopping a focus timer, record it as not completed
    if (!isStarting && currentTimer === "focus" && currentSessionRef.current) {
      // Will be marked as completed only if the timer reaches 0
      console.log("Timer paused, session continues");
    }
  };

  const resetTimer = () => {
    setTimeLeft(timerSettings[currentTimer]);
    setIsRunning(false);
    setIsPausedByAttention(false);
    setInitialAttentionPause(true);

    // Reset the current session if we're in a focus timer
    if (currentTimer === "focus" && currentSessionRef.current) {
      currentSessionRef.current = null;
      initialTimeRef.current = null;
    }
  };

  // Helper function to determine the next timer in the pomodoro sequence
  const getNextTimerInSequence = () => {
    if (currentTimer === "focus") {
      if (completedFocusSessions === 3) {
        // After 4th focus session (index 3), go to long break
        return "longBreak";
      } else {
        // After 1st, 2nd, or 3rd focus session, go to short break
        return "shortBreak";
      }
    } else if (currentTimer === "shortBreak" || currentTimer === "longBreak") {
      // After any break, go back to focus
      return "focus";
    }

    // Default fallback
    return "focus";
  };

  const skipTimer = () => {
    // Use the helper function to determine the next timer
    const nextTimer = getNextTimerInSequence();

    // If we're skipping a focus timer, record it as not completed
    if (currentTimer === "focus" && currentSessionRef.current) {
      currentSessionRef.current = null;
      initialTimeRef.current = null;
    }

    // If we're skipping a completed focus session, increment the counter
    if (currentTimer === "focus") {
      const newCompletedSessions = (completedFocusSessions + 1) % 4;
      setCompletedFocusSessions(newCompletedSessions);
    }

    // If we're skipping a long break, reset the counter
    if (currentTimer === "longBreak") {
      setCompletedFocusSessions(0);
    }

    setCurrentTimer(nextTimer);
    setTimeLeft(timerSettings[nextTimer]);
    setIsRunning(false);
    setIsPausedByAttention(false);
    setInitialAttentionPause(true);
  };

  const changeTimer = (timer) => {
    // If we're changing from a focus timer, reset the current session
    if (currentTimer === "focus" && currentSessionRef.current) {
      currentSessionRef.current = null;
      initialTimeRef.current = null;
    }

    // Reset completed sessions counter when manually changing timers
    if (timer === "focus") {
      setCompletedFocusSessions(0);
    }

    setCurrentTimer(timer);
    setTimeLeft(timerSettings[timer]);
    setIsRunning(false);
    setIsPausedByAttention(false);
    setInitialAttentionPause(true);
  };

  // Handle attention changes from the FaceTracking component
  const handleAttentionChange = (isAttentionOn) => {
    // Only handle attention changes if face tracking is enabled
    if (
      timerSettings.faceTrackingEnabled &&
      currentTimer === "focus" &&
      isRunning
    ) {
      if (!isAttentionOn && !isPausedByAttention) {
        // User looked away, pause the timer
        setIsPausedByAttention(true);
        setInitialAttentionPause(false);

        // Record attention loss in stats
        if (currentSessionRef.current) {
          console.log("Recording attention loss start");
          statsService
            .recordAttentionLoss(currentSessionRef.current, true)
            .then((success) => {
              console.log("Attention loss recorded:", success);
            })
            .catch((error) => {
              console.error("Error recording attention loss:", error);
            });
        }
      } else if (
        isAttentionOn &&
        isPausedByAttention &&
        !initialAttentionPause
      ) {
        // User looked back, resume the timer
        setIsPausedByAttention(false);

        // Record end of attention loss in stats
        if (currentSessionRef.current) {
          console.log("Recording attention loss end");
          statsService
            .recordAttentionLoss(currentSessionRef.current, false)
            .then((success) => {
              console.log("Attention loss end recorded:", success);
            })
            .catch((error) => {
              console.error("Error recording end of attention loss:", error);
            });
        }
      }
    }
  };

  // Main timer effect
  useEffect(() => {
    // Don't run the timer if it's paused (manually or by attention)
    if (!isRunning || isPausedByAttention || timeLeft === 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, isPausedByAttention, timeLeft]);

  useEffect(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    document.title = `${minutes}:${seconds < 10 ? "0" + seconds : seconds} - ${
      currentTimer.charAt(0).toUpperCase() + currentTimer.slice(1)
    } - Focus Guard`;

    // If timer reaches zero
    if (timeLeft === 0) {
      setIsRunning(false);
      setIsPausedByAttention(false);

      // Play timer completion sound if enabled in settings
      if (timerSettings.soundEnabled) {
        try {
          timerCompleteSound.current.currentTime = 0;
          timerCompleteSound.current.play().catch((err) => {
            console.log("Error playing timer complete sound:", err);
          });
        } catch (err) {
          console.log("Error with audio playback:", err);
        }
      }

      // Show browser notification if permission is granted
      if (Notification.permission === "granted") {
        new Notification("Focus Guard", {
          body: `${
            currentTimer.charAt(0).toUpperCase() + currentTimer.slice(1)
          } timer complete!`,
          icon: "/logo192.png",
        });
      }

      // If it was a focus timer, mark it as completed
      if (currentTimer === "focus" && currentSessionRef.current) {
        // Calculate the duration based on the initial time
        const duration = initialTimeRef.current;
        console.log(
          `Completing session ${currentSessionRef.current} with duration ${duration} seconds`
        );

        statsService
          .completeSession(currentSessionRef.current, duration)
          .then((success) => {
            console.log("Session completed successfully:", success);
          })
          .catch((error) => {
            console.error("Error completing session:", error);
          });

        currentSessionRef.current = null;
        initialTimeRef.current = null;

        // Increment completed focus sessions and wrap around after 4
        const newCompletedSessions = (completedFocusSessions + 1) % 4;
        setCompletedFocusSessions(newCompletedSessions);
      }

      // Reset completed sessions counter after long break
      if (currentTimer === "longBreak") {
        setCompletedFocusSessions(0);
      }

      // Automatically transition to the next timer
      const nextTimer = getNextTimerInSequence();
      setCurrentTimer(nextTimer);
      setTimeLeft(timerSettings[nextTimer]);
    }
  }, [timeLeft, currentTimer, completedFocusSessions, timerSettings]);

  // Notify parent component when timer mode changes
  useEffect(() => {
    if (onModeChange) {
      onModeChange(currentTimer);
    }
  }, [currentTimer, onModeChange]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const totalTime = timerSettings[currentTimer];
  const progress = ((totalTime - timeLeft) / totalTime) * 100;

  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes}:${seconds < 10 ? "0" + seconds : seconds}`;
  };

  // Create memoized star elements to prevent re-rendering
  const starElements = useMemo(() => {
    const regularStars = [...Array(50)].map((_, i) => (
      <div
        key={i}
        className={`star star-${Math.floor(Math.random() * 3) + 1}`}
        style={{
          top: `${Math.random() * 40}%`,
          left: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 5}s`,
        }}
      ></div>
    ));

    // Special larger stars with fixed positions
    const specialStars = [
      { top: "15%", left: "15%", delay: "0.5s" },
      { top: "25%", left: "75%", delay: "1.5s" },
      { top: "45%", left: "42%", delay: "2.5s" },
      { top: "65%", left: "55%", delay: "4.5s" },
      { top: "35%", left: "65%", delay: "3.7s" },
    ].map((pos, i) => (
      <div
        key={`special-${i}`}
        className="star star-special"
        style={{
          top: pos.top,
          left: pos.left,
          animationDelay: pos.delay,
        }}
      ></div>
    ));

    return [...regularStars, ...specialStars];
  }, []);

  return (
    <div className={`timer ${currentTimer} ${darkMode ? "dark-mode" : ""}`}>
      {/* Birds animation - only visible in light mode */}
      {!darkMode && (
        <div className="bird-container">
          <div className="bird"></div>
          <div className="bird"></div>
          <div className="bird"></div>
        </div>
      )}

      {/* Gradient elements for smooth transitions between modes */}
      <div className="timer-long-break-gradient"></div>
      <div className="timer-dark-mode-gradient"></div>
      <div className="timer-dark-focus-gradient"></div>
      <div className="timer-dark-short-break-gradient"></div>
      <div className="timer-dark-long-break-gradient"></div>

      {/* Stars animation - only visible in dark mode */}
      {darkMode && (
        <>
          <div className="star-container">{starElements}</div>
          <div className="noise-overlay"></div>
          <div className="aurora"></div>
          <div className="horizon-glow"></div>
        </>
      )}

      {/* Light mode atmosphere effects - only visible in light mode */}
      {!darkMode && (
        <>
          <div className="light-atmosphere"></div>
          <div className="light-noise"></div>
          <div className="vignette"></div>

          {/* Cloud/fog elements */}
          <div className="clouds-container">
            <div className="cloud cloud-1"></div>
            <div className="cloud cloud-2"></div>
            <div className="cloud cloud-3"></div>
          </div>
        </>
      )}

      {/* Top-right menu */}
      <div className="menu-container top-right" ref={menuRef}>
        {/* Dark mode toggle - moved beside menu */}
        <div className="mode-toggle">
          <button onClick={toggleDarkMode} className="mode-toggle-button">
            <div className="toggle-option">☀️</div>
            <div className="toggle-option">🌙</div>
            <div className="active-background"></div>
          </button>
        </div>

        <div className="profile-menu-container">
          <button className="menu-button" onClick={toggleMenu}>
            {currentUser ? (
              currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt="Profile"
                  className="profile-icon user-photo"
                />
              ) : (
                <div className="profile-initial-small">
                  {currentUser.displayName
                    ? currentUser.displayName.charAt(0).toUpperCase()
                    : currentUser.email.charAt(0).toUpperCase()}
                </div>
              )
            ) : (
              <img src={profileIcon} alt="Profile" className="profile-icon" />
            )}
          </button>

          {menuOpen && (
            <div className="menu-dropdown">
              {currentUser ? (
                <Link to="/profile" className="menu-item">
                  <span className="menu-icon">
                    <img src={profile} alt="Profile" width="48" height="48" />
                  </span>
                  <span className="menu-text">Your Profile</span>
                </Link>
              ) : (
                <Link to="/sign-in" className="menu-item">
                  <span className="menu-icon">
                    <img src={profile} alt="Profile" width="48" height="48" />
                  </span>
                  <span className="menu-text">Sign In / Sign Up</span>
                </Link>
              )}
              <Link to="/stats" className="menu-item">
                <span className="menu-icon">
                  <img src={stats} alt="Stats" width="48" height="48" />
                </span>
                <span className="menu-text">Stats</span>
              </Link>
              {currentUser && (
                <Link to="/friends" className="menu-item">
                  <span className="menu-icon">
                    <img src={friends} alt="Friends" width="48" height="48" />
                  </span>
                  <span className="menu-text">Your Friends</span>
                </Link>
              )}
              <Link to="/settings" className="menu-item">
                <span className="menu-icon">
                  <img src={settings} alt="Settings" width="48" height="48" />
                </span>
                <span className="menu-text">Settings</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="nav-header">
        <div className="button-types">
          <button
            className={currentTimer === "focus" ? "active" : ""}
            onClick={() => changeTimer("focus")}
          >
            Focus
          </button>
          <button
            className={currentTimer === "shortBreak" ? "active" : ""}
            onClick={() => changeTimer("shortBreak")}
          >
            Short Break
          </button>
          <button
            className={currentTimer === "longBreak" ? "active" : ""}
            onClick={() => changeTimer("longBreak")}
          >
            Long Break
          </button>
        </div>
      </div>

      <h2 data-text={formatTime(timeLeft)}>{formatTime(timeLeft)}</h2>

      <div className="progress-bar">
        <div className="progress" style={{ width: `${progress}%` }}></div>
      </div>

      <div className="timer-controls">
        <div className="buttons-container">
          <button className="start-pause" onClick={startTimer}>
            {isRunning ? "Pause" : "Start"}
          </button>
          <div className="skip-container">
            <button
              className={`skip ${isRunning ? "fade-in" : "fade-out"}`}
              onClick={skipTimer}
              aria-label="Skip to next timer"
              style={{ display: timeLeft > 0 ? "flex" : "none" }}
            >
              <img src={skipButton} alt="" className="skip-icon" />
            </button>
          </div>
        </div>
      </div>

      {/* Face Tracking Component - only render if enabled in settings */}
      {timerSettings.faceTrackingEnabled && (
        <FaceTracking
          isRunning={isRunning}
          currentTimer={currentTimer}
          onAttentionChange={handleAttentionChange}
          soundEnabled={timerSettings.soundEnabled}
        />
      )}
    </div>
  );
};

export default Timer;
