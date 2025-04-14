// Settings service for storing and retrieving timer settings

const SETTINGS_KEY = "focus-guard-settings";

// Default timer settings (in seconds)
const DEFAULT_SETTINGS = {
  focus: 25 * 60, // 25 minutes
  shortBreak: 5 * 60, // 5 minutes
  longBreak: 15 * 60, // 15 minutes
  faceTrackingEnabled: true, // Enable face tracking by default
  backgroundSelection: "background1", // Default background
  soundEnabled: true, // Enable sound notifications by default
};

// Load settings from localStorage
const loadSettings = () => {
  try {
    const storedSettings = localStorage.getItem(SETTINGS_KEY);
    return storedSettings ? JSON.parse(storedSettings) : DEFAULT_SETTINGS;
  } catch (error) {
    console.error("Error loading settings:", error);
    return DEFAULT_SETTINGS;
  }
};

// Save settings to localStorage
const saveSettings = (settings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error("Error saving settings:", error);
    return false;
  }
};

// Update specific settings
const updateSettings = (newSettings) => {
  const currentSettings = loadSettings();
  const updatedSettings = { ...currentSettings, ...newSettings };
  return saveSettings(updatedSettings);
};

// Reset settings to default values
const resetSettings = () => {
  return saveSettings(DEFAULT_SETTINGS);
};

const settingsService = {
  loadSettings,
  saveSettings,
  updateSettings,
  resetSettings,
  DEFAULT_SETTINGS,
};

export default settingsService;
