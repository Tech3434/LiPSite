import AppState from "../appState.js";

class NavigationController {
  constructor(app) {
    this.app = app;
    this.fileManager = app.fileManager;
  }

  parseHash() {
    const hash = window.location.hash.substring(1);
    if (!hash) return { season: null, act: null, mode: null, guideId: null };

    const segments = hash
      .split("/")
      .filter((segment) => segment && segment.trim() !== "");
    const result = {
      season: null,
      act: null,
      mode: "story",
      guideId: null,
    };

    const seasonMatch = segments.find((seg) => seg.startsWith("season"));
    if (seasonMatch) result.season = seasonMatch;

    const actMatch = segments.find((seg) => seg.startsWith("act"));
    if (actMatch) result.act = actMatch;

    const modeMatch = segments.find((seg) =>
      ["story", "players", "guides"].includes(seg),
    );
    if (modeMatch) result.mode = modeMatch;

    const guidesIndex = segments.indexOf("guides");
    if (guidesIndex !== -1 && segments.length > guidesIndex + 1) {
      result.guideId = segments[guidesIndex + 1];
    }

    return result;
  }

  updateURL() {
    const state = AppState.getState();

    if (!state.currentSeason || state.currentSeason === "official") {
      history.replaceState(null, "", window.location.pathname);
      return;
    }

    const segments = [state.currentSeason];

    if (state.currentAct) {
      segments.push(state.currentAct);
      if (state.currentMode) {
        segments.push(state.currentMode);
        if (state.currentOpenGuide && state.currentMode === "guides") {
          segments.push(state.currentOpenGuide);
        }
      }
    }

    const hash = segments.join("/");
    history.replaceState(null, "", `#${hash}`);
  }

  async handleHashChange() {
    if (AppState.getState("isTransitioning")) return;

    const { season, act, mode, guideId } = this.parseHash();
    const state = AppState.getState();

    if (!season) {
      await this.app.seasonUI.selectSeason("official");
      return;
    }

    if (state.currentSeason !== season) {
      await this.loadSeasonFromURL(season, act, mode, guideId);
      return;
    }

    if (act && state.currentAct !== act) {
      await this.app.actUI.selectAct(act);
      await new Promise((resolve) => setTimeout(resolve, 200));

      if (mode && mode !== "story") {
        await this.app.contentUI.selectContentMode(mode);
        if (guideId && mode === "guides") {
          await new Promise((resolve) => setTimeout(resolve, 300));
          await this.app.guideUI.openGuideFromURL(guideId);
        }
      }
      return;
    }

    if (mode && state.currentMode !== mode) {
      await this.app.contentUI.selectContentMode(mode);
      if (guideId && mode === "guides") {
        await new Promise((resolve) => setTimeout(resolve, 300));
        await this.app.guideUI.openGuideFromURL(guideId);
      }
      return;
    }

    if (guideId && !state.currentOpenGuide && state.currentMode === "guides") {
      await this.app.guideUI.openGuideFromURL(guideId);
    } else if (!guideId && state.currentOpenGuide) {
      this.app.modal.closeGuideModal();
    }
  }

  async loadSeasonFromURL(seasonId, actId, mode, guideId) {
    try {
      await this.app.seasonUI.selectSeason(seasonId);
      const state = AppState.getState();

      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!state.isTransitioning && state.currentSeason === seasonId) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 50);
      });

      if (actId && state.currentSeason === seasonId) {
        await this.app.actUI.selectAct(actId);

        await new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            if (!state.isTransitioning && state.currentAct === actId) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 50);
        });

        if (mode && mode !== "story") {
          await this.app.contentUI.selectContentMode(mode);
          if (guideId && mode === "guides") {
            await new Promise((resolve) => setTimeout(resolve, 300));
            await this.app.guideUI.openGuideFromURL(guideId);
          }
        }
      }
    } catch (error) {
      console.error("Error loading from URL:", error);
    }
  }
}

export default NavigationController;
