import React, { useState, useEffect } from "react";
import settingsService from "../../services/settingsService";
import "../../styles/Settings.css";
import BackgroundSelection from "./BackgroundSelection";

const Settings = () => {
  // Convert seconds to minutes for display
  const secondsToMinutes = (seconds) => Math.floor(seconds / 60);

  // State for timer settings (in minutes)
  const [settings, setSettings] = useState({
    focus: 25,
    shortBreak: 5,
    longBreak: 15,
    faceTrackingEnabled: true,
    soundEnabled: true,
  });

  // Load settings on component mount
  useEffect(() => {
    const loadedSettings = settingsService.loadSettings();
    // Convert to minutes for the form
    setSettings({
      focus: secondsToMinutes(loadedSettings.focus),
      shortBreak: secondsToMinutes(loadedSettings.shortBreak),
      longBreak: secondsToMinutes(loadedSettings.longBreak),
      faceTrackingEnabled:
        loadedSettings.faceTrackingEnabled !== undefined
          ? loadedSettings.faceTrackingEnabled
          : true,
      soundEnabled:
        loadedSettings.soundEnabled !== undefined
          ? loadedSettings.soundEnabled
          : true,
    });
  }, []);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    // Ensure value is a positive number
    const numValue = Math.max(1, parseInt(value) || 1);
    setSettings((prev) => ({
      ...prev,
      [name]: numValue,
    }));
  };

  // Handle checkbox changes
  const handleToggleChange = (e) => {
    const { name, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  // Save settings
  const handleSave = () => {
    // Convert minutes back to seconds for storage
    const updatedSettings = {
      focus: settings.focus * 60,
      shortBreak: settings.shortBreak * 60,
      longBreak: settings.longBreak * 60,
      faceTrackingEnabled: settings.faceTrackingEnabled,
      soundEnabled: settings.soundEnabled,
    };

    if (settingsService.saveSettings(updatedSettings)) {
      alert("Settings saved successfully!");
    } else {
      alert("Failed to save settings. Please try again.");
    }
  };

  // Reset settings to defaults
  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset to default settings?")) {
      settingsService.resetSettings();
      const defaults = settingsService.DEFAULT_SETTINGS;
      setSettings({
        focus: secondsToMinutes(defaults.focus),
        shortBreak: secondsToMinutes(defaults.shortBreak),
        longBreak: secondsToMinutes(defaults.longBreak),
        faceTrackingEnabled: defaults.faceTrackingEnabled,
        soundEnabled: defaults.soundEnabled,
      });
      alert("Settings reset to defaults.");
    }
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h2>Timer Settings</h2>
      </div>

      <div className="settings-form">
        <div className="setting-group">
          <label htmlFor="focus">Focus Duration (minutes)</label>
          <input
            type="number"
            id="focus"
            name="focus"
            min="1"
            value={settings.focus}
            onChange={handleChange}
          />
        </div>

        <div className="setting-group">
          <label htmlFor="shortBreak">Short Break Duration (minutes)</label>
          <input
            type="number"
            id="shortBreak"
            name="shortBreak"
            min="1"
            value={settings.shortBreak}
            onChange={handleChange}
          />
        </div>

        <div className="setting-group">
          <label htmlFor="longBreak">Long Break Duration (minutes)</label>
          <input
            type="number"
            id="longBreak"
            name="longBreak"
            min="1"
            value={settings.longBreak}
            onChange={handleChange}
          />
        </div>

        <div className="setting-section">
          <h3>Focus Tracking</h3>

          <div className="setting-group toggle-setting">
            <div className="toggle-container">
              <label htmlFor="faceTrackingEnabled" className="toggle-label">
                <input
                  type="checkbox"
                  id="faceTrackingEnabled"
                  name="faceTrackingEnabled"
                  checked={settings.faceTrackingEnabled}
                  onChange={handleToggleChange}
                />
                <span className="toggle-switch"></span>
                <span className="toggle-text">Enable Face Tracking</span>
              </label>
            </div>
            <p className="setting-description">
              When face tracking is enabled, the app will use your webcam to
              track your attention during focus sessions. This allows detailed
              statistics about your focus quality, attention losses, and average
              focus duration.
              <br />
              <br />
              <strong>Note:</strong> When disabled, only basic stats (completed
              sessions and streaks) will be tracked.
            </p>
          </div>
        </div>

        <div className="setting-section">
          <h3>Notifications</h3>

          <div className="setting-group toggle-setting">
            <div className="toggle-container">
              <label htmlFor="soundEnabled" className="toggle-label">
                <input
                  type="checkbox"
                  id="soundEnabled"
                  name="soundEnabled"
                  checked={settings.soundEnabled}
                  onChange={handleToggleChange}
                />
                <span className="toggle-switch"></span>
                <span className="toggle-text">Enable Sound Notifications</span>
              </label>
            </div>
            <p className="setting-description">
              When enabled, the app will play sound notifications when timers
              complete and when attention tracking detects that you've looked
              away from the screen.
            </p>
          </div>
        </div>

        <BackgroundSelection />

        <div className="settings-actions">
          <button className="save-button" onClick={handleSave}>
            Save Settings
          </button>
          <button className="reset-button" onClick={handleReset}>
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
