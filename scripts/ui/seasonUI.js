import AppState from "../appState.js";
import { createElement, fadeElement } from "../domUtils.js";

class SeasonUI {
  constructor(app) {
    this.app = app;
    this.fileManager = app.fileManager;
  }

  renderSeasonSelector() {
    this.app.elements.seasonSelector.innerHTML = "";
    const seasons = AppState.getState("seasonsList");

    const officialButton = createElement("button", {
      classes: "btn btn-state-inactive",
      text: "Информация",
      dataset: { seasonId: "official" },
    });

    this.app.elements.seasonSelector.appendChild(officialButton);

    seasons.forEach((season) => {
      const button = createElement("button", {
        classes: "btn btn-state-inactive",
        text: season.name,
        dataset: { seasonId: season.id },
      });

      this.app.elements.seasonSelector.appendChild(button);
    });
  }

  updateSeasonButtons(selectedSeasonId) {
    const buttons = this.app.elements.seasonSelector.querySelectorAll(".btn");
    const state = AppState.getState();

    buttons.forEach((btn) => {
      if (btn.dataset.seasonId === selectedSeasonId) {
        if (state.isThemeActive && selectedSeasonId !== "official") {
          // В активной теме используем классы темы (только для сезонов, не для "Информации")
          btn.className = "btn btn-state-active theme-active";
        } else {
          // Без темы или для "Информации" - цветовые режимы
          btn.className =
            selectedSeasonId === "official"
              ? "btn btn-mode-warning"
              : "btn btn-mode-success";
        }
      } else {
        if (state.isThemeActive && selectedSeasonId !== "official") {
          // В активной теме все неактивные кнопки используют тему
          btn.className = "btn btn-state-inactive theme-active";
        } else {
          btn.className = "btn btn-state-inactive";
        }
      }
    });

    // ВАЖНО: После обновления кнопок сезонов обновляем кнопки режимов
    if (
      this.app.contentUI &&
      typeof this.app.contentUI.updateModeButtons === "function"
    ) {
      setTimeout(() => {
        this.app.contentUI.updateModeButtons();
      }, 50);
    }
  }

  // НОВЫЙ МЕТОД: Принудительное обновление всех кнопок сезонов при смене темы
  refreshSeasonButtons() {
    const state = AppState.getState();
    const buttons = this.app.elements.seasonSelector.querySelectorAll(".btn");

    buttons.forEach((btn) => {
      const isSelected = btn.dataset.seasonId === state.currentSeason;

      if (isSelected) {
        if (
          state.isThemeActive &&
          state.currentSeason !== "official" &&
          state.currentSeason !== null
        ) {
          btn.className = "btn btn-state-active theme-active";
        } else {
          btn.className =
            state.currentSeason === "official"
              ? "btn btn-mode-warning"
              : state.currentSeason
                ? "btn btn-mode-success"
                : "btn btn-mode-warning";
        }
      } else {
        if (
          state.isThemeActive &&
          state.currentSeason !== "official" &&
          state.currentSeason !== null
        ) {
          btn.className = "btn btn-state-inactive theme-active";
        } else {
          btn.className = "btn btn-state-inactive";
        }
      }
    });
  }

  attachEventListeners() {
    this.app.elements.seasonSelector.addEventListener(
      "click",
      this.handleSeasonClick.bind(this),
    );
  }

  async handleSeasonClick(e) {
    const button = e.target.closest(".btn");
    if (button && button.dataset.seasonId) {
      const originalText = button.textContent;
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      button.disabled = true;

      try {
        await this.selectSeason(button.dataset.seasonId);
      } catch (error) {
        console.error("Error selecting season:", error);
      } finally {
        setTimeout(() => {
          button.textContent = originalText;
          button.disabled = false;
        }, 300);
      }
    }
  }

  async selectSeason(seasonId) {
    const state = AppState.getState();
    const previousSeason = state.currentSeason;

    if (previousSeason === seasonId) return;

    // Плавно скрываем текущий контент если он есть
    if (previousSeason && previousSeason !== "official") {
      await fadeElement(this.app.elements.seasonContent, "out", 200);
    } else if (previousSeason === "official") {
      await fadeElement(this.app.elements.officialInfo, "out", 200);
    }

    // Сначала обновляем кнопки сезонов
    this.updateSeasonButtons(seasonId);

    if (seasonId === "official") {
      this.app.elements.headerTitle.textContent = "Информация";
      this.app.theme.removeTheme();

      AppState.setState({
        currentOpenGuide: null,
        currentMode: "story",
        currentSeason: "official", // ВАЖНО: устанавливаем явно "official"
        currentAct: null,
        currentTheme: null,
        isTransitioning: false,
      });

      this.app.elements.seasonContent.classList.add("hidden");
      this.app.elements.officialInfo.classList.remove("hidden");
      this.app.elements.officialInfo.style.opacity = "0";

      await fadeElement(this.app.elements.officialInfo, "in", 300);

      // После смены на официальную инфо, обновляем кнопки режимов
      if (
        this.app.contentUI &&
        typeof this.app.contentUI.updateModeButtons === "function"
      ) {
        this.app.contentUI.updateModeButtons();
      }

      this.app.navigation.updateURL();
      return;
    }

    // Переход к сезону
    const seasonInfo = await this.fileManager.getSeasonInfo(seasonId);
    if (seasonInfo) {
      this.app.elements.headerTitle.textContent = seasonInfo.title;
    }

    if (!this.app.elements.officialInfo.classList.contains("hidden")) {
      await fadeElement(this.app.elements.officialInfo, "out", 200);
      this.app.elements.officialInfo.classList.add("hidden");
    }

    this.app.elements.seasonContent.classList.remove("hidden");
    this.app.elements.seasonContent.style.opacity = "0";

    AppState.setState({
      currentSeason: seasonId,
      currentAct: null, // Сбрасываем выбранный акт при смене сезона
      isTransitioning: false,
    });

    // Параллельно: анимация + загрузка данных
    await Promise.all([
      fadeElement(this.app.elements.seasonContent, "in", 300),
      this.app.content.loadSeasonData(seasonId),
    ]);

    // ВАЖНО: После загрузки данных сезона обновляем кнопки режимов
    if (
      this.app.contentUI &&
      typeof this.app.contentUI.updateModeButtons === "function"
    ) {
      this.app.contentUI.updateModeButtons();
    }

    this.app.navigation.updateURL();
  }

  showLoading() {
    if (!this.app.elements.loadingIndicator) return;
    this.app.elements.loadingIndicator.classList.remove("hidden");
  }

  hideLoading() {
    if (!this.app.elements.loadingIndicator) return;
    this.app.elements.loadingIndicator.classList.add("hidden");
  }
}

export default SeasonUI;
