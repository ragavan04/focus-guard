import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Timer from "./components/home-page/timer.components";
import Stats from "./components/dashboard/Stats";
import Settings from "./components/dashboard/Settings";
import "./styles/base.css";
import "./styles/light-theme.css";
import SignIn from "./components/auth-flow/sign-in.component";
import Layout from "./components/layout.component";
import UserProfile from "./components/auth-flow/user-profile.component";
import Friends from "./components/dashboard/Friends";
import SpotifyCallback from "./services/spotifyCallback";
import { DarkModeProvider } from "./contexts/darkMode.context";
import { BackgroundProvider } from "./contexts/BackgroundContext";

function App() {
  const [currentMode, setCurrentMode] = useState("focus");

  // Function to be passed to Timer component
  const handleModeChange = (mode) => {
    setCurrentMode(mode);
  };

  return (
    <DarkModeProvider>
      <BackgroundProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Layout currentMode={currentMode} />}>
              <Route
                index
                element={<Timer onModeChange={handleModeChange} />}
              />
              <Route path="/stats" element={<Stats />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/sign-in" element={<SignIn />} />
              <Route path="/profile" element={<UserProfile />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/callback" element={<SpotifyCallback />} />
            </Route>
          </Routes>
        </Router>
      </BackgroundProvider>
    </DarkModeProvider>
  );
}

export default App;
