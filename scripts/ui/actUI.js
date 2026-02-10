import AppState from "../appState.js";
import { createElement, fadeElement } from "../domUtils.js";

class ActUI {
  constructor(app) {
    this.app = app;
    this.fileManager = app.fileManager;
  }

  async renderActSelector() {
    this.app.elements.actSelector.innerHTML = "";
    const state = AppState.getState();
    if (!state.currentSeason || state.currentSeason === "official") return;

    const acts = await this.fileManager.getActsForSeason(state.currentSeason);

    if (acts && acts.length > 0) {
      acts.forEach((actId) => {
        const button = createElement("button", {
          classes: `btn btn-state-inactive ${state.isThemeActive ? "theme-active" : ""}`,
          text: `Акт ${actId.replace("act", "")}`,
          dataset: { actId },
        });

        this.app.elements.actSelector.appendChild(button);
      });

      AppState.setState({ currentAct: acts[0] });
      this.updateActButtons(acts[0]);

      // ВАЖНО: После рендера актов обновляем кнопки режимов
      if (
        this.app.contentUI &&
        typeof this.app.contentUI.updateModeButtons === "function"
      ) {
        setTimeout(() => {
          this.app.contentUI.updateModeButtons();
        }, 50);
      }
    } else {
      this.app.elements.actSelector.innerHTML = `
        <div class="text-slate-400 py-2 px-4">
          Акты отсутствуют для этого сезона
        </div>
      `;
    }
  }

  updateActButtons(selectedActId) {
    const buttons =
      this.app.elements.actSelector.querySelectorAll(".btn[data-act-id]");

    buttons.forEach((btn) => {
      const state = AppState.getState();
      if (btn.dataset.actId === selectedActId) {
        if (state.isThemeActive) {
          btn.className = "btn btn-state-active theme-active";
        } else {
          btn.className = "btn btn-state-active";
        }
      } else {
        if (state.isThemeActive) {
          btn.className = "btn btn-state-inactive theme-active";
        } else {
          btn.className = "btn btn-state-inactive";
        }
      }
    });

    // ВАЖНО: При обновлении кнопок актов обновляем и кнопки режимов
    if (
      this.app.contentUI &&
      typeof this.app.contentUI.updateModeButtons === "function"
    ) {
      setTimeout(() => {
        this.app.contentUI.updateModeButtons();
      }, 50);
    }
  }

  // НОВЫЙ МЕТОД: Принудительное обновление кнопок актов при смене темы
  refreshActButtons() {
    const state = AppState.getState();
    const buttons =
      this.app.elements.actSelector.querySelectorAll(".btn[data-act-id]");

    buttons.forEach((btn) => {
      const isSelected = btn.dataset.actId === state.currentAct;

      if (isSelected) {
        if (state.isThemeActive) {
          btn.className = "btn btn-state-active theme-active";
        } else {
          btn.className = "btn btn-state-active";
        }
      } else {
        if (state.isThemeActive) {
          btn.className = "btn btn-state-inactive theme-active";
        } else {
          btn.className = "btn btn-state-inactive";
        }
      }
    });
  }

  attachEventListeners() {
    this.app.elements.actSelector.addEventListener(
      "click",
      this.handleActClick.bind(this),
    );
  }

  async handleActClick(e) {
    // Убираем проверку isTransitioning
    const button = e.target.closest(".btn");
    if (button && button.dataset.actId) {
      const originalText = button.textContent;
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      button.disabled = true;

      try {
        await this.selectAct(button.dataset.actId);
      } catch (error) {
        console.error("Error selecting act:", error);
      } finally {
        setTimeout(() => {
          button.textContent = originalText;
          button.disabled = false;
        }, 300);
      }
    }
  }

  async selectAct(actId) {
    const state = AppState.getState();
    if (state.currentAct === actId) return;

    this.updateActButtons(actId);
    AppState.setState({ currentAct: actId });

    await this.app.updateHeaderTitle();

    this.app.elements.seasonBanner.classList.add("loading");

    const currentMode = state.currentMode;
    const currentContent = document.getElementById(`${currentMode}-content`);

    if (currentContent && !currentContent.classList.contains("hidden")) {
      await fadeElement(currentContent, "out", 150);
      currentContent.classList.add("hidden");
    }

    await this.app.theme.loadActTheme(state.currentSeason, actId);
    await this.app.theme.updateBannerFromAct();

    await this.app.content.updateContentForCurrentMode();

    const newContent = document.getElementById(`${currentMode}-content`);
    if (newContent) {
      newContent.classList.remove("hidden");
      newContent.style.opacity = "0";
      await fadeElement(newContent, "in", 200);
    }

    // ВАЖНО: После загрузки темы и контента обновляем кнопки режимов
    if (
      this.app.contentUI &&
      typeof this.app.contentUI.updateModeButtons === "function"
    ) {
      this.app.contentUI.updateModeButtons();
    }

    // ВАЖНО: Обновляем кнопки сезонов после смены темы
    if (
      this.app.seasonUI &&
      typeof this.app.seasonUI.refreshSeasonButtons === "function"
    ) {
      this.app.seasonUI.refreshSeasonButtons();
    }

    setTimeout(() => {
      this.app.elements.seasonBanner.classList.remove("loading");
    }, 150);

    this.app.navigation.updateURL();
  }
}

export default ActUI;
