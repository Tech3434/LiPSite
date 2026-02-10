import AppState from "../appState.js";
import FileManager from "../fileManager.js";
import NavigationController from "./navigationController.js";
import ContentController from "./contentController.js";
import ThemeController from "./themeController.js";
import ModalController from "./modalController.js";
import SeasonUI from "../ui/seasonUI.js";
import ActUI from "../ui/actUI.js";
import ContentUI from "../ui/contentUI.js";
import GuideUI from "../ui/guideUI.js";

class AppController {
  constructor() {
    this.elements = this.cacheElements();
    this.fileManager = FileManager;
    this.isInitialized = false;

    this.navigation = new NavigationController(this);
    this.content = new ContentController(this);
    this.theme = new ThemeController(this);
    this.modal = new ModalController(this);
    this.seasonUI = new SeasonUI(this);
    this.actUI = new ActUI(this);
    this.contentUI = new ContentUI(this);
    this.guideUI = new GuideUI(this);

    AppState.addEventListener("stateChange", () => {
      this.updateHeaderTitle();
    });
  }

  cacheElements() {
    return {
      headerTitle: document.getElementById("header-title"),
      seasonSelector: document.getElementById("season-selector"),
      officialInfo: document.getElementById("official-info"),
      seasonContent: document.getElementById("season-content"),
      seasonBanner: document.getElementById("season-banner"),
      seasonTitle: document.getElementById("season-title"),
      seasonSynopsis: document.getElementById("season-synopsis"),
      actSelector: document.getElementById("act-selector"),
      contentModeSelector: document.getElementById("content-mode-selector"),
      storyContent: document.getElementById("story-content"),
      playersContent: document.getElementById("players-content"),
      guidesContent: document.getElementById("guides-content"),
      actTitle: document.getElementById("act-title"),
      actStory: document.getElementById("act-story"),
      playersTableBody: document.getElementById("players-table-body"),
      guidesGrid: document.getElementById("guides-grid"),
      guideModal: document.getElementById("guide-modal"),
      guideModalTitle: document.getElementById("guide-modal-title"),
      guideModalContent: document.getElementById("guide-modal-content"),
      closeModalBtn: document.getElementById("close-modal"), // ИЗМЕНИЛ НАЗВАНИЕ ЗДЕСЬ!
      loadingIndicator: document.getElementById("loading-indicator"),
      contentDisplay: document.getElementById("content-display"),
      body: document.body,
    };
  }

  async init() {
    if (this.isInitialized) return;

    try {
      this.showLoading();
      this.elements.headerTitle.textContent = "Информация";

      // Параллельная загрузка конфигурации и информации
      await Promise.all([
        this.fileManager.loadServerConfig(),
        this.fileManager.loadOfficialInfo(),
      ]);

      // Получаем список сезонов один раз
      const seasonsList = await this.fileManager.getSeasonsList();
      AppState.setState({ seasonsList });

      this.seasonUI.renderSeasonSelector();
      this.attachEventListeners();

      window.addEventListener("hashchange", () => {
        this.navigation.handleHashChange();
      });

      const { season, act, mode, guideId } = this.navigation.parseHash();

      if (season) {
        await this.navigation.loadSeasonFromURL(season, act, mode, guideId);
      } else {
        this.elements.officialInfo.classList.remove("hidden");
        await this.seasonUI.selectSeason("official");
      }

      this.hideLoading();
      this.isInitialized = true;
    } catch (error) {
      console.error("Initialization error:", error);
      this.showError(
        "Не удалось загрузить приложение. Пожалуйста, обновите страницу.",
      );
    }
  }

  attachEventListeners() {
    this.seasonUI.attachEventListeners();
    this.actUI.attachEventListeners();
    this.contentUI.attachEventListeners();
    this.modal.attachEventListeners();
  }

  async updateHeaderTitle() {
    const state = AppState.getState();
    if (state.currentSeason === "official" || !state.currentSeason) {
      this.elements.headerTitle.textContent = "Информация";
      return;
    }

    try {
      const seasonInfo = await this.fileManager.getSeasonInfo(
        state.currentSeason,
      );
      if (!seasonInfo) {
        this.elements.headerTitle.textContent = `Сезон ${state.currentSeason.replace("season", "")}`;
        return;
      }

      let title = seasonInfo.title;
      if (state.currentAct) {
        const actMatch = state.currentAct.match(/act(\d+)/i);
        const actNumber = actMatch ? parseInt(actMatch[1]) : 1;
        const romanNumeral = this.content.convertToRoman(actNumber);
        if (romanNumeral) title = `${title} ${romanNumeral}`;
      }

      this.elements.headerTitle.textContent = title;
    } catch (error) {
      console.error("Error updating header title:", error);
      this.elements.headerTitle.textContent = "Сервер";
    }
  }

  async reloadOfficialInfo() {
    try {
      await this.fileManager.loadOfficialInfo();
    } catch (error) {
      console.error("Error reloading official info:", error);
    }
  }

  showLoading() {
    this.elements.loadingIndicator.classList.remove("hidden");
    this.elements.contentDisplay.classList.add("hidden");
  }

  hideLoading() {
    this.elements.loadingIndicator.classList.add("hidden");
    this.elements.contentDisplay.classList.remove("hidden");
  }

  showError(message) {
    const errorDiv = document.createElement("div");
    errorDiv.className =
      "fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50";
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
  }
}

export default AppController;
