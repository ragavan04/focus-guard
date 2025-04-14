import React from "react";
import {
  useBackground,
  BACKGROUND_OPTIONS,
} from "../../contexts/BackgroundContext";
import { useDarkMode } from "../../contexts/darkMode.context";

// Import background images directly
import backgroundLight from "../../assets/background-light.svg";
import backgroundDark from "../../assets/background-dark.svg";
import background2Light from "../../assets/background2-light.svg";
import background2Dark from "../../assets/background2-dark.svg";
import background3Light from "../../assets/background3-light.svg";
import background3Dark from "../../assets/background3-dark.svg";
import background4Light from "../../assets/background4-light.svg";
import background4Dark from "../../assets/background4-dark.svg";
import background5Light from "../../assets/background5-light.svg";
import background5Dark from "../../assets/background5-dark.svg";

// Map for direct image access
const BACKGROUND_IMAGES = {
  background1: {
    light: backgroundLight,
    dark: backgroundDark,
  },
  background2: {
    light: background2Light,
    dark: background2Dark,
  },
  background3: {
    light: background3Light,
    dark: background3Dark,
  },
  background4: {
    light: background4Light,
    dark: background4Dark,
  },
  background5: {
    light: background5Light,
    dark: background5Dark,
  },
};

const BackgroundSelection = () => {
  const { backgroundId, updateBackground } = useBackground();
  const { darkMode } = useDarkMode();

  return (
    <div className="setting-section">
      <h3>Background Customization</h3>

      <div className="background-options">
        {BACKGROUND_OPTIONS.map((background) => (
          <div
            key={background.id}
            className={`background-option ${
              backgroundId === background.id ? "selected" : ""
            }`}
            onClick={() => updateBackground(background.id)}
          >
            <div className="background-preview">
              <img
                src={
                  darkMode
                    ? BACKGROUND_IMAGES[background.id].dark
                    : BACKGROUND_IMAGES[background.id].light
                }
                alt={background.name}
              />
            </div>
            <div className="background-name">{background.name}</div>
          </div>
        ))}
      </div>

      <p className="setting-description">
        Select a background to personalize your Focus Guard experience. The
        background will update in all screens and will respect your light/dark
        mode preference.
      </p>
    </div>
  );
};

export default BackgroundSelection;
