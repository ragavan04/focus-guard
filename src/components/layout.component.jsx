import React from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
import "../styles/base.css";
import SpotifyLoginButton from "./home-page/spotifyPlayer";

const Layout = ({ currentMode }) => {
  const location = useLocation();
  const isMainPage = location.pathname === "/";

  return (
    <div className="app-container">
      <div className="app-header">
        <div className="app-logo">
          <img src="/logo.svg" alt="Focus Guard Logo" />
        </div>
        <h1 className={`light-mode-title ${currentMode}`}>Focus Guard</h1>
        <h1 className={`dark-mode-title ${currentMode}`}>Focus Guard</h1>

        {!isMainPage && (
          <Link to="/" className="back-button-link">
            <button className="back-button">← Back to Timer</button>
          </Link>
        )}
      </div>
      <Outlet />
      <div className="spotify-button-container">
        <SpotifyLoginButton />
      </div>

      <footer className="footer">
        Stay focused and productive with Focus Guard
        <div className="feature-note">
          Focus Guard monitors your attention to ensure you stay focused during
          work sessions
        </div>
      </footer>
    </div>
  );
};

export default Layout;
