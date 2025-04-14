import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/spotify.css";

const SpotifyCallback = () => {
  const navigate = useNavigate();
  const hasExchanged = useRef(false);
  const [status, setStatus] = useState("processing"); // "processing", "success", "error"
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const codeVerifier = localStorage.getItem("code_verifier");

    if (code && codeVerifier && !hasExchanged.current) {
      hasExchanged.current = true;

      setStatus("processing");

      fetch("/api/spotify/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, codeVerifier }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.access_token) {
            localStorage.setItem("spotify_access_token", data.access_token);
            localStorage.setItem("spotify_refresh_token", data.refresh_token);

            // Dispatch a custom event to notify that login was successful
            window.dispatchEvent(new CustomEvent("spotifyLoginSuccess"));

            setStatus("success");

            // Add a small delay before redirecting for a better UX
            setTimeout(() => {
              navigate("/");
            }, 1500);
          } else {
            setStatus("error");
            setErrorMessage(data.error || "Failed to connect with Spotify");
          }
        })
        .catch((err) => {
          console.error("API error", err);
          setStatus("error");
          setErrorMessage("Connection error. Please try again.");
        });
    } else if (!code) {
      setStatus("error");
      setErrorMessage("No authorization code received from Spotify");
    } else if (!codeVerifier) {
      setStatus("error");
      setErrorMessage("Authentication session expired. Please try again.");
    }
  }, [navigate]);

  const handleRetry = () => {
    window.location.href = "/";
  };

  return (
    <div className="spotify-callback-container">
      <div className="spotify-callback-card">
        <div className="spotify-logo">
          <svg viewBox="0 0 24 24" width="48" height="48">
            <path
              fill="#1DB954"
              d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.66.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
            />
          </svg>
        </div>

        <h2 className="spotify-callback-title">
          {status === "processing" && "Connecting with Spotify..."}
          {status === "success" && "Connected Successfully!"}
          {status === "error" && "Connection Failed"}
        </h2>

        {status === "processing" && (
          <div className="spotify-loader">
            <div className="spotify-loader-inner"></div>
          </div>
        )}

        {status === "success" && (
          <div className="spotify-success">
            <svg viewBox="0 0 24 24" width="64" height="64">
              <path
                fill="#1DB954"
                d="M12,0A12,12,0,1,0,24,12,12,12,0,0,0,12,0Zm5.92,8.38L11.47,17.31a1,1,0,0,1-1.45.08h0l-3.92-3.92a1,1,0,0,1,0-1.42,1,1,0,0,1,1.42,0L10.47,15l5.53-7.71a1,1,0,1,1,1.61,1.18Z"
              />
            </svg>
            <p>Redirecting you back to Focus Guard...</p>
          </div>
        )}

        {status === "error" && (
          <div className="spotify-error">
            <svg viewBox="0 0 24 24" width="64" height="64">
              <path
                fill="#e74c3c"
                d="M12,0A12,12,0,1,0,24,12,12,12,0,0,0,12,0Zm4.71,15.29a1,1,0,0,1-1.42,1.42L12,13.41,8.71,16.71A1,1,0,0,1,7.29,15.29L10.59,12,7.29,8.71A1,1,0,0,1,8.71,7.29L12,10.59l3.29-3.3a1,1,0,0,1,1.42,1.42L13.41,12Z"
              />
            </svg>
            <p>{errorMessage}</p>
            <button onClick={handleRetry} className="spotify-retry-button">
              Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpotifyCallback;
