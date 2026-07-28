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
        // Всегда используем базовые классы — тема применяется через body.theme-active
        btn.className =
          selectedSeasonId === "official"
            ? "btn btn-mode-warning"
            : "btn btn-mode-success";
      } else {
        btn.className = "btn btn-state-inactive";
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
        btn.className =
          state.currentSeason === "official"
            ? "btn btn-mode-warning"
            : state.currentSeason
              ? "btn btn-mode-success"
              : "btn btn-mode-warning";
      } else {
        btn.className = "btn btn-state-inactive";
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

    // Сначала обновляем кнопки сезонов
    this.updateSeasonButtons(seasonId);

    if (seasonId === "official") {
      // === ПЕРЕХОД НА ИНФОРМАЦИЮ ===
      // Фейдим только если был сезон (не official)
      if (previousSeason && previousSeason !== "official") {
        await fadeElement(this.app.elements.seasonContent, "out", 200);
      }

      this.app.elements.headerTitle.textContent = "Информация";
      this.app.theme.removeTheme();

      AppState.setState({
        currentOpenGuide: null,
        currentMode: "story",
        currentSeason: "official",
        currentAct: null,
        currentTheme: null,
        isTransitioning: false,
      });

      this.app.elements.seasonContent.classList.add("hidden");
      this.app.elements.officialInfo.classList.remove("hidden");
      this.app.elements.officialInfo.style.opacity = "0";

      await fadeElement(this.app.elements.officialInfo, "in", 300);

      if (
        this.app.contentUI &&
        typeof this.app.contentUI.updateModeButtons === "function"
      ) {
        this.app.contentUI.updateModeButtons();
      }

      this.app.navigation.updateURL();
      return;
    }

    // === ПЕРЕХОД НА СЕЗОН ===

    // Важно: НЕ фейдим officialInfo сразу! Оставляем его видимым
    // на время загрузки данных, чтобы не было пустой страницы.
    // Cross-fade сделаем в конце.
    const comingFromOfficial = previousSeason === "official";

    if (!comingFromOfficial) {
      // Если переключаемся между сезонами — фейдим текущий
      if (previousSeason && previousSeason !== "official") {
        await fadeElement(this.app.elements.seasonContent, "out", 200);
      }
      // Если officialInfo был видим (напр. загрузка с URL-якоря) — скрываем
      if (!this.app.elements.officialInfo.classList.contains("hidden")) {
        await fadeElement(this.app.elements.officialInfo, "out", 150);
        this.app.elements.officialInfo.classList.add("hidden");
      }
    }
    // Если из official — НЕ фейдим, оставляем видимым для cross-fade

    // Загружаем инфу о сезоне
    const seasonInfo = await this.fileManager.getSeasonInfo(seasonId);
    if (seasonInfo) {
      this.app.elements.headerTitle.textContent = seasonInfo.title;
    }

    AppState.setState({
      currentSeason: seasonId,
      currentAct: null,
      isTransitioning: false,
    });

    // Скрываем все секции режимов
    ["story", "players", "guides"].forEach((mode) => {
      const section = document.getElementById(`${mode}-content`);
      if (section) section.classList.add("hidden");
    });

    // Загружаем ВСЕ данные ДО показа сезона
    await this.app.content.loadSeasonData(seasonId);

    // Готовим seasonContent к показу
    this.app.elements.seasonContent.classList.remove("hidden");
    this.app.elements.seasonContent.style.opacity = "0";

    // Показываем секцию текущего режима
    const currentMode = AppState.getState("currentMode");
    ["story", "players", "guides"].forEach((mode) => {
      const section = document.getElementById(`${mode}-content`);
      if (section) {
        if (mode === currentMode) {
          section.classList.remove("hidden");
          section.style.opacity = "1";
        } else {
          section.classList.add("hidden");
        }
      }
    });

    if (comingFromOfficial) {
      // Cross-fade: officialInfo фейдится OUT одновременно
      // с fadeIn сезона — плавный переход без пустой страницы
      await Promise.all([
        fadeElement(this.app.elements.officialInfo, "out", 200).then(() => {
          this.app.elements.officialInfo.classList.add("hidden");
        }),
        fadeElement(this.app.elements.seasonContent, "in", 300),
      ]);
    } else {
      // Обычный fadeIn сезона (предыдущий уже скрыт выше)
      await fadeElement(this.app.elements.seasonContent, "in", 300);
    }

    // Обновляем кнопки и URL
    if (
      this.app.contentUI &&
      typeof this.app.contentUI.updateModeButtons === "function"
    ) {
      this.app.contentUI.updateModeButtons();
    }

    this.app.navigation.updateURL();
  }

}

export default SeasonUI;
