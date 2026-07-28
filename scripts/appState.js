// appState.js

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

  const triggerEvent = (type, data) => {
    const handlers = state.eventListeners.get(type);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  };

  return {
    getState: (key) => (key ? state[key] : { ...state }),
    setState: (updates) => {
      const newState = { ...state, ...updates };
      if (validateState(newState)) {
        state = newState;
        triggerEvent("stateChange", { ...state });
        return true;
      }
      return false;
    },
    addEventListener: (type, handler) => {
      if (!state.eventListeners.has(type)) {
        state.eventListeners.set(type, []);
      }
      state.eventListeners.get(type).push(handler);
    },
  };
})();

window.appState = AppState;
export default AppState;
