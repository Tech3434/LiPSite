import AppState from "../appState.js";
import { convertToRoman } from "../utils.js";

class ContentController {
  constructor(app) {
    this.app = app;
    this.fileManager = app.fileManager;
  }

  convertToRoman = convertToRoman;

  async loadSeasonData(seasonId) {
    const seasonInfo = await this.fileManager.getSeasonInfo(seasonId);

    if (seasonInfo) {
      this.app.elements.seasonTitle.textContent = seasonInfo.title;
      this.app.elements.seasonSynopsis.textContent = seasonInfo.synopsis;
      await this.app.updateHeaderTitle();
    }

    await this.app.actUI.renderActSelector();
    const acts = await this.fileManager.getActsForSeason(seasonId);

    if (acts && acts.length > 0) {
      AppState.setState({ currentAct: acts[0] });
      this.app.actUI.updateActButtons(acts[0]);
      await this.app.updateHeaderTitle();
      await this.app.theme.loadActTheme(seasonId, acts[0]);
      await this.app.theme.updateBannerFromAct();

      // ВАЖНО: Загружаем контент сразу при выборе сезона
      await this.app.content.updateContentForCurrentMode();
    } else {
      await this.app.updateHeaderTitle();
    }
  }

  async updateContentForCurrentMode() {
    const state = AppState.getState();
    if (!state.currentSeason || !state.currentAct) return;

    switch (state.currentMode) {
      case "story":
        await this.app.contentUI.updateStoryContent();
        break;
      case "players":
        await this.app.contentUI.updatePlayersContent();
        break;
      case "guides":
        await this.app.contentUI.updateGuidesContent();
        break;
    }
  }
}

export default ContentController;
