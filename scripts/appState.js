// appState.js
import { sanitizeHTML } from "./utils.js";

const AppState = (() => {
  let state = {
    currentSeason: null,
    currentAct: null,
    currentMode: "story",
    seasonsList: [],
    currentTheme: null,
    isThemeActive: false,
    currentOpenGuide: null,
    eventListeners: new Map(),
  };

  const validateState = (newState) => {
    const validModes = ["story", "players", "guides"];
    if (newState.currentMode && !validModes.includes(newState.currentMode)) {
      throw new Error(`Invalid mode: ${newState.currentMode}`);
    }
    return true;
  };

  return {
    getState: (key) => (key ? state[key] : { ...state }),
    setState: (updates) => {
      const newState = { ...state, ...updates };
      if (validateState(newState)) {
        state = newState;
        return true;
      }
      return false;
    },
    addEventListener: (type, handler) => {
      if (!state.eventListeners.has(type)) {
        state.eventListeners.set(type, new Set());
      }
      state.eventListeners.get(type).add(handler);
    },
    removeEventListener: (type, handler) => {
      if (state.eventListeners.has(type)) {
        state.eventListeners.get(type).delete(handler);
      }
    },
    triggerEvent: (type, data) => {
      if (state.eventListeners.has(type)) {
        state.eventListeners.get(type).forEach((handler) => handler(data));
      }
    },
  };
})();

export default AppState;
