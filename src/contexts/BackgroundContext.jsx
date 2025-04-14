import React, { createContext, useState, useEffect, useContext } from "react";
import settingsService from "../services/settingsService";

// Import background images directly
import backgroundLight from "../assets/background-light.svg";
import backgroundDark from "../assets/background-dark.svg";
import background2Light from "../assets/background2-light.svg";
import background2Dark from "../assets/background2-dark.svg";
import background3Light from "../assets/background3-light.svg";
import background3Dark from "../assets/background3-dark.svg";
import background4Light from "../assets/background4-light.svg";
import background4Dark from "../assets/background4-dark.svg";
import background5Light from "../assets/background5-light.svg";
import background5Dark from "../assets/background5-dark.svg";

// Create the context
const BackgroundContext = createContext();

// Background options
export const BACKGROUND_OPTIONS = [
  {
    id: "background1",
    name: "Default",
    lightSrc: backgroundLight,
    darkSrc: backgroundDark,
  },
  {
    id: "background2",
    name: "Waves",
    lightSrc: background2Light,
    darkSrc: background2Dark,
  },
  {
    id: "background3",
    name: "Nature",
    lightSrc: background3Light,
    darkSrc: background3Dark,
  },
  {
    id: "background4",
    name: "Abstract",
    lightSrc: background4Light,
    darkSrc: background4Dark,
  },
  {
    id: "background5",
    name: "Geometric",
    lightSrc: background5Light,
    darkSrc: background5Dark,
  },
];

// Provider component
export const BackgroundProvider = ({ children }) => {
  const [backgroundId, setBackgroundId] = useState("background1");

  // Load background selection from settings on mount
  useEffect(() => {
    const settings = settingsService.loadSettings();
    setBackgroundId(settings.backgroundSelection || "background1");
  }, []);

  // Update background in settings when changed
  const updateBackground = (newBackgroundId) => {
    setBackgroundId(newBackgroundId);
    settingsService.updateSettings({ backgroundSelection: newBackgroundId });

    // Update CSS variables for background images
    const selectedBackground = BACKGROUND_OPTIONS.find(
      (bg) => bg.id === newBackgroundId
    );
    if (selectedBackground) {
      document.documentElement.style.setProperty(
        "--background-light",
        `url(${selectedBackground.lightSrc})`
      );
      document.documentElement.style.setProperty(
        "--background-dark",
        `url(${selectedBackground.darkSrc})`
      );
    }
  };

  // Set initial CSS variables on mount
  useEffect(() => {
    const selectedBackground = BACKGROUND_OPTIONS.find(
      (bg) => bg.id === backgroundId
    );
    if (selectedBackground) {
      document.documentElement.style.setProperty(
        "--background-light",
        `url(${selectedBackground.lightSrc})`
      );
      document.documentElement.style.setProperty(
        "--background-dark",
        `url(${selectedBackground.darkSrc})`
      );
    }
  }, [backgroundId]);

  return (
    <BackgroundContext.Provider
      value={{ backgroundId, updateBackground, BACKGROUND_OPTIONS }}
    >
      {children}
    </BackgroundContext.Provider>
  );
};

// Custom hook for using the background context
export const useBackground = () => useContext(BackgroundContext);

export default BackgroundContext;
