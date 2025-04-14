import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const SpotifyCallback = () => {
  const navigate = useNavigate();
  const hasExchanged = useRef(false); // ✅ Prevent double call

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const codeVerifier = localStorage.getItem("code_verifier");

    if (code && codeVerifier && !hasExchanged.current) {
      hasExchanged.current = true; // ✅ Only run once

      console.log("Code:", code);
      console.log("Code Verifier:", codeVerifier);

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

            navigate("/"); // ✅ Redirect after success
          } else {
            console.error("Token exchange failed", data);
          }
        })
        .catch((err) => console.error("API error", err));
    }
  }, [navigate]);

  return <div>Logging in with Spotify...</div>;
};

export default SpotifyCallback;
