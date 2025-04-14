import React, { useEffect, useState } from "react";
import { redirectToSpotifyLogin } from "../auth-flow/spotifyAuth";
import { useDarkMode } from "../../contexts/darkMode.context";
import "../../styles/spotify.css";

// Generate a persistent device ID or use existing one
const getDeviceId = () => {
  const existingId = localStorage.getItem("spotify_device_id");
  if (existingId) return existingId;

  // Generate a unique ID if none exists
  const newId = "focus_guard_" + Math.random().toString(36).substring(2, 15);
  localStorage.setItem("spotify_device_id", newId);
  return newId;
};

const DEVICE_ID = getDeviceId();
const DEVICE_NAME = "Focus Guard Player";

const SpotifyLoginButton = () => {
  // Use the dark mode context directly
  const { darkMode } = useDarkMode();

  const [profile, setProfile] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMiniPlayer, setIsMiniPlayer] = useState(false);
  const [isVinylMode, setIsVinylMode] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Function to fetch Spotify profile
  const fetchSpotifyProfile = () => {
    const accessToken = localStorage.getItem("spotify_access_token");
    if (!accessToken) return;

    // Fetch Spotify profile
    fetch("https://api.spotify.com/v1/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Token may be expired or invalid");
        return res.json();
      })
      .then((data) => {
        setProfile(data);
      })
      .catch((err) => {
        console.error("Error fetching profile:", err);
        localStorage.removeItem("spotify_access_token"); // Logout on fail
      });
  };

  // Initial profile fetch on component mount
  useEffect(() => {
    fetchSpotifyProfile();
  }, []);

  // Listen for login success event
  useEffect(() => {
    const handleLoginSuccess = () => {
      console.log("Spotify login success event received");
      fetchSpotifyProfile();
    };

    window.addEventListener("spotifyLoginSuccess", handleLoginSuccess);

    return () => {
      window.removeEventListener("spotifyLoginSuccess", handleLoginSuccess);
    };
  }, []);

  // Fetch playlists when expanded and logged in
  useEffect(() => {
    if (isExpanded && profile) {
      setIsLoadingPlaylists(true);
      const accessToken = localStorage.getItem("spotify_access_token");

      // Function to fetch all playlists using pagination
      const fetchAllPlaylists = async () => {
        let allPlaylists = [];
        let nextUrl = "https://api.spotify.com/v1/me/playlists?limit=50"; // Increase initial limit

        while (nextUrl) {
          try {
            const response = await fetch(nextUrl, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            });

            if (!response.ok) {
              throw new Error("Failed to fetch playlists");
            }

            const data = await response.json();
            allPlaylists = [...allPlaylists, ...data.items];

            // Update nextUrl for pagination or set to null if we're done
            nextUrl = data.next;
          } catch (err) {
            console.error("Error fetching playlists:", err);
            break;
          }
        }

        setPlaylists(allPlaylists);
        setIsLoadingPlaylists(false);
      };

      fetchAllPlaylists();
    }
  }, [isExpanded, profile]);

  // Fetch tracks when a playlist is selected
  useEffect(() => {
    if (selectedPlaylist) {
      setIsLoadingTracks(true);
      const accessToken = localStorage.getItem("spotify_access_token");

      // Function to fetch all tracks using pagination
      const fetchAllTracks = async () => {
        let allTracks = [];
        let nextUrl = `https://api.spotify.com/v1/playlists/${selectedPlaylist.id}/tracks?limit=100`; // Increase initial limit

        while (nextUrl) {
          try {
            const response = await fetch(nextUrl, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            });

            if (!response.ok) {
              throw new Error("Failed to fetch tracks");
            }

            const data = await response.json();
            allTracks = [...allTracks, ...data.items];

            // Update nextUrl for pagination or set to null if we're done
            nextUrl = data.next;
          } catch (err) {
            console.error("Error fetching tracks:", err);
            break;
          }
        }

        setTracks(allTracks);
        setIsLoadingTracks(false);
      };

      fetchAllTracks();
    }
  }, [selectedPlaylist]);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const handleLogout = () => {
    // Clear Spotify tokens from localStorage
    localStorage.removeItem("spotify_access_token");
    localStorage.removeItem("spotify_refresh_token");
    // Reset profile state
    setProfile(null);
    // Close the expanded panel
    setIsExpanded(false);
  };

  const handlePlaylistClick = (playlist) => {
    setSelectedPlaylist(playlist);
  };

  const handleBackToPlaylists = () => {
    setSelectedPlaylist(null);
    setTracks([]);
  };

  const playTrack = (track, playContext = false) => {
    const accessToken = localStorage.getItem("spotify_access_token");
    const uri = track.track.uri;

    // Payload to send to the API
    let payload;

    if (playContext && selectedPlaylist) {
      // Play the track in context of the playlist for auto continuation
      payload = {
        context_uri: `spotify:playlist:${selectedPlaylist.id}`,
        offset: { uri: uri },
        device_id: DEVICE_ID,
      };
    } else {
      // Just play the individual track
      payload = {
        uris: [uri],
        device_id: DEVICE_ID,
      };
    }

    fetch("https://api.spotify.com/v1/me/player/play", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (res.status === 204 || res.ok) {
          setCurrentlyPlaying(track);
          setIsPlaying(true);
        } else {
          throw new Error("Failed to play track");
        }
      })
      .catch((err) => {
        console.error("Error playing track:", err);
        alert(
          "To play music, open the Spotify app on your device and start playing any song first. Then try again."
        );
      });
  };

  const togglePlayPause = () => {
    const accessToken = localStorage.getItem("spotify_access_token");
    const endpoint = isPlaying ? "pause" : "play";

    fetch(`https://api.spotify.com/v1/me/player/${endpoint}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        device_id: DEVICE_ID,
      }),
    })
      .then((res) => {
        if (res.status === 204 || res.ok) {
          setIsPlaying(!isPlaying);
        } else {
          throw new Error(`Failed to ${isPlaying ? "pause" : "play"}`);
        }
      })
      .catch((err) => {
        console.error(`Error ${isPlaying ? "pausing" : "playing"}:`, err);
      });
  };

  const skipToNext = () => {
    const accessToken = localStorage.getItem("spotify_access_token");

    fetch("https://api.spotify.com/v1/me/player/next", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    })
      .then((res) => {
        if (res.status === 204 || res.ok) {
          // Update currently playing after a slight delay to allow Spotify to update
          setTimeout(() => {
            fetchCurrentlyPlaying();
          }, 1000); // Increase delay to 1000ms for more reliable update
        } else {
          throw new Error("Failed to skip to next track");
        }
      })
      .catch((err) => {
        console.error("Error skipping to next track:", err);
      });
  };

  const skipToPrevious = () => {
    const accessToken = localStorage.getItem("spotify_access_token");

    fetch("https://api.spotify.com/v1/me/player/previous", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    })
      .then((res) => {
        if (res.status === 204 || res.ok) {
          // Update currently playing after a slight delay to allow Spotify to update
          setTimeout(() => {
            fetchCurrentlyPlaying();
          }, 1000); // Increase delay to 1000ms for more reliable update
        } else {
          throw new Error("Failed to skip to previous track");
        }
      })
      .catch((err) => {
        console.error("Error skipping to previous track:", err);
      });
  };

  const fetchCurrentlyPlaying = () => {
    const accessToken = localStorage.getItem("spotify_access_token");

    fetch(`https://api.spotify.com/v1/me/player?device_id=${DEVICE_ID}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then((res) => {
        if (res.status === 204) {
          // No track is playing
          setCurrentlyPlaying(null);
          setIsPlaying(false);
          return null;
        }
        if (!res.ok) throw new Error("Failed to fetch currently playing");
        return res.json();
      })
      .then((data) => {
        if (data) {
          // Check if it's a new track (different from the current one)
          const isNewTrack =
            !currentlyPlaying || currentlyPlaying.track.uri !== data.item.uri;

          setCurrentlyPlaying({
            track: {
              name: data.item.name,
              artists: data.item.artists,
              album: data.item.album,
              uri: data.item.uri,
            },
            progress: data.progress_ms,
            duration: data.item.duration_ms,
          });
          setIsPlaying(data.is_playing);

          // Check if track is near the end (last 3 seconds)
          if (
            data.progress_ms > 0 &&
            data.item.duration_ms - data.progress_ms < 3000 &&
            data.is_playing
          ) {
            console.log("Track ending soon, preparing to play next track");
          }
        }
      })
      .catch((err) => {
        console.error("Error fetching currently playing:", err);
      });
  };

  // Add transfer playback function when user logs in
  useEffect(() => {
    if (profile) {
      const accessToken = localStorage.getItem("spotify_access_token");

      // Set this as the active device when the profile is loaded
      fetch("https://api.spotify.com/v1/me/player", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          device_ids: [DEVICE_ID],
          play: false,
        }),
      }).catch((err) => {
        console.error("Error transferring playback:", err);
      });
    }
  }, [profile]);

  // Poll for currently playing track every 5 seconds when expanded
  useEffect(() => {
    if (isExpanded && profile) {
      fetchCurrentlyPlaying();

      const interval = setInterval(() => {
        fetchCurrentlyPlaying();
      }, 3000); // Check every 3 seconds

      return () => clearInterval(interval);
    }
  }, [isExpanded, profile]);

  const toggleMiniPlayer = () => {
    setIsMiniPlayer(!isMiniPlayer);
  };

  // Add function to set up auto-continuation when selecting a track
  const handleTrackClick = (track, index) => {
    // Play the track in context of the playlist for auto continuation
    playTrack(track, true);
  };

  // If not logged in
  if (!profile) {
    return (
      <div className={`spotify-icon-container ${darkMode ? "dark-mode" : ""}`}>
        {!isExpanded && (
          <button
            onClick={handleToggle}
            className="spotify-icon-button"
            aria-label="Spotify"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="#1DB954"
            >
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
          </button>
        )}

        {isExpanded && (
          <div
            className={`spotify-expanded-panel ${darkMode ? "dark-mode" : ""}`}
          >
            <button
              onClick={redirectToSpotifyLogin}
              className="spotify-login-button"
            >
              🎵 Login with Spotify
            </button>
          </div>
        )}
      </div>
    );
  }

  // If logged in
  return (
    <div className={`spotify-icon-container ${darkMode ? "dark-mode" : ""}`}>
      {!isExpanded && (
        <button
          onClick={handleToggle}
          className="spotify-icon-button"
          aria-label="Spotify"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="#1DB954"
          >
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
        </button>
      )}

      {isExpanded && (
        <div
          className={`spotify-expanded-panel ${
            isMiniPlayer ? "mini-player-mode" : ""
          } ${darkMode ? "dark-mode" : ""}`}
        >
          <div className="spotify-panel-header">
            {!isMiniPlayer && (
              <button onClick={handleLogout} className="spotify-logout-button">
                Logout
              </button>
            )}
            <button onClick={handleToggle} className="spotify-close-button">
              Close
            </button>

            {currentlyPlaying && (
              <>
                <span className="spotify-username">{profile.display_name}</span>
                <button
                  onClick={() => setIsVinylMode(!isVinylMode)}
                  className="vinyl-mode-toggle"
                  title={isVinylMode ? "Exit vinyl mode" : "Enter vinyl mode"}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="#1DB954"
                  >
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z" />
                  </svg>
                </button>
                <button
                  onClick={toggleMiniPlayer}
                  className="mini-player-toggle"
                  title={
                    isMiniPlayer ? "Expand player" : "Collapse to mini player"
                  }
                >
                  {isMiniPlayer ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="currentColor"
                    >
                      <path d="M3 19h18v-2H3v2zm0-6h18v-2H3v2zm0-8v2h18V5H3z" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="currentColor"
                    >
                      <path d="M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z" />
                    </svg>
                  )}
                </button>
              </>
            )}
          </div>

          {currentlyPlaying && (
            <div className="spotify-now-playing">
              {isVinylMode ? (
                <div className="vinyl-player">
                  <div className="vinyl-record-container">
                    <div
                      className={`vinyl-record ${
                        isPlaying ? "playing" : "stopping"
                      }`}
                    >
                      <div
                        className="vinyl-album-art"
                        style={{
                          backgroundImage: `url(${currentlyPlaying.track.album?.images[0].url})`,
                        }}
                      />
                    </div>
                    <div className={`vinyl-arm ${isPlaying ? "" : "lifted"}`} />
                  </div>
                  <div className="vinyl-track-info">
                    <p className="vinyl-track-name">
                      {currentlyPlaying.track.name}
                    </p>
                    <p className="vinyl-track-artist">
                      {currentlyPlaying.track.artists
                        .map((artist) => artist.name)
                        .join(", ")}
                    </p>
                  </div>
                  <div className="vinyl-controls">
                    <button
                      onClick={skipToPrevious}
                      className="playback-control-button"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="currentColor"
                      >
                        <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                      </svg>
                    </button>
                    <button
                      onClick={togglePlayPause}
                      className="playback-control-button playback-play-pause"
                    >
                      {isPlaying ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          width="18"
                          height="18"
                          fill="currentColor"
                        >
                          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          width="18"
                          height="18"
                          fill="currentColor"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={skipToNext}
                      className="playback-control-button"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="currentColor"
                      >
                        <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="now-playing-info">
                    {currentlyPlaying.track.album?.images &&
                      currentlyPlaying.track.album.images.length > 0 && (
                        <img
                          src={currentlyPlaying.track.album.images[0].url}
                          alt={currentlyPlaying.track.album.name}
                          className="now-playing-image"
                        />
                      )}
                    <div className="now-playing-details">
                      <p className="now-playing-title">
                        {currentlyPlaying.track.name}
                      </p>
                      <p className="now-playing-artist">
                        {currentlyPlaying.track.artists
                          .map((artist) => artist.name)
                          .join(", ")}
                      </p>
                    </div>
                  </div>
                  <div className="playback-controls">
                    <button
                      onClick={skipToPrevious}
                      className="playback-control-button"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="currentColor"
                      >
                        <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                      </svg>
                    </button>
                    <button
                      onClick={togglePlayPause}
                      className="playback-control-button playback-play-pause"
                    >
                      {isPlaying ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          width="18"
                          height="18"
                          fill="currentColor"
                        >
                          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          width="18"
                          height="18"
                          fill="currentColor"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={skipToNext}
                      className="playback-control-button"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="currentColor"
                      >
                        <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {!isMiniPlayer && (
            <>
              {selectedPlaylist ? (
                <div className="spotify-tracks">
                  <div className="playlist-header">
                    <button
                      onClick={handleBackToPlaylists}
                      className="back-to-playlists-button"
                    >
                      ←
                    </button>
                    <h3>{selectedPlaylist.name}</h3>
                  </div>

                  {isLoadingTracks ? (
                    <div className="spotify-loading">Loading tracks...</div>
                  ) : tracks.length > 0 ? (
                    <ul className="track-list">
                      {tracks.map((track, index) => (
                        <li
                          key={track.track.id}
                          className={`track-item ${
                            currentlyPlaying &&
                            currentlyPlaying.track.uri === track.track.uri
                              ? "track-playing"
                              : ""
                          }`}
                          onClick={() => handleTrackClick(track, index)}
                        >
                          {track.track.album.images.length > 0 && (
                            <img
                              src={
                                track.track.album.images[
                                  track.track.album.images.length - 1
                                ].url
                              }
                              alt={track.track.album.name}
                              className="track-image"
                            />
                          )}
                          <div className="track-info">
                            <span className="track-name">
                              {track.track.name}
                            </span>
                            <span className="track-artist">
                              {track.track.artists
                                .map((artist) => artist.name)
                                .join(", ")}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="no-tracks">No tracks found</div>
                  )}
                </div>
              ) : (
                <div className="spotify-playlists">
                  <h3>Your Playlists</h3>
                  {isLoadingPlaylists ? (
                    <div className="spotify-loading">Loading playlists...</div>
                  ) : playlists.length > 0 ? (
                    <ul className="playlist-list">
                      {playlists.map((playlist) => (
                        <li
                          key={playlist.id}
                          className="playlist-item"
                          onClick={() => handlePlaylistClick(playlist)}
                        >
                          {playlist.images.length > 0 && (
                            <img
                              src={playlist.images[0].url}
                              alt={playlist.name}
                              className="playlist-image"
                            />
                          )}
                          <div className="playlist-info">
                            <span className="playlist-name">
                              {playlist.name}
                            </span>
                            <span className="playlist-tracks">
                              {playlist.tracks.total} tracks
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="no-playlists">No playlists found</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SpotifyLoginButton;
