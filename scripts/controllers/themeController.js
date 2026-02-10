import AppState from "../appState.js";

class ThemeController {
  constructor(app) {
    this.app = app;
    this.fileManager = app.fileManager;
  }

  async loadActTheme(seasonId, actId) {
    const theme = await this.fileManager.getActTheme(seasonId, actId);
    AppState.setState({ currentTheme: theme });

    if (theme) {
      this.applyTheme(theme);
    }

    // После загрузки темы обновляем баннер с названием акта
    await this.updateBannerFromAct();
  }

  applyTheme(theme) {
    const root = document.documentElement;

    // Устанавливаем переменные темы в соответствии с design.txt
    // primary: Цвет заднего фона
    root.style.setProperty(
      "--theme-primary",
      theme.primary || theme.primaryColor,
    );
    // secondary: Цвет элементов
    root.style.setProperty(
      "--theme-secondary",
      theme.secondary || theme.secondaryColor,
    );
    // accent: Цвет активных или выделенных элементов
    root.style.setProperty("--theme-accent", theme.accent || theme.accentColor);
    // text: Цвет текста
    root.style.setProperty("--theme-text", theme.text || theme.textColor);

    // Устанавливаем фон страницы из primary цвета
    if (theme.primary || theme.primaryColor) {
      this.app.elements.body.style.backgroundColor =
        theme.primary || theme.primaryColor;
    }

    // Устанавливаем переменные для кнопок
    root.style.setProperty("--btn-theme-bg", theme.accent || theme.accentColor); // accent для кнопок
    root.style.setProperty("--btn-theme-text", theme.text || theme.textColor);

    // Вычисляем hover и active цвета
    const hoverColor = this.lightenDarkenColor(
      theme.accent || theme.accentColor,
      -20,
    );
    const activeColor = this.lightenDarkenColor(
      theme.accent || theme.accentColor,
      -40,
    );
    root.style.setProperty("--btn-theme-hover", hoverColor);
    root.style.setProperty("--btn-theme-active", activeColor);

    this.app.elements.body.classList.add("theme-active");

    // Применяем тему к элементам
    const themeElements = document.querySelectorAll(
      ".header-main, .footer-main, #guide-modal, .content-card, .card-animated, " +
        ".section-title, .content-card-title, .modal-title, .table-header-row, " +
        ".table-body-row, .table-header-cell, .table-body-cell, .status-alive, " +
        ".status-dead, .status-lost, .status-left, .icon-link-discord, " +
        ".footer-highlight, .footer-creator, .scrollbar-custom, .loader, " +
        ".banner-overlay, .text-gradient-primary, .btn-state-active, .btn-state-inactive",
    );

    themeElements.forEach((el) => el.classList.add("theme-active"));
    AppState.setState({ isThemeActive: true });

    // ВАЖНО: После применения темы обновляем все кнопки
    setTimeout(() => {
      if (this.app.seasonUI && typeof this.app.seasonUI.refreshSeasonButtons === 'function') {
        this.app.seasonUI.refreshSeasonButtons();
      }
      if (this.app.actUI && typeof this.app.actUI.refreshActButtons === 'function') {
        this.app.actUI.refreshActButtons();
      }
      if (this.app.contentUI && typeof this.app.contentUI.updateModeButtons === 'function') {
        this.app.contentUI.updateModeButtons();
      }
    }, 50);
  }

  lightenDarkenColor(color, amount) {
    const usePound = color[0] === "#";
    const num = parseInt(usePound ? color.slice(1) : color, 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amount));
    const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amount));
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
  }

  removeTheme() {
    if (!AppState.getState("isThemeActive")) return;

    this.app.elements.body.style.transition = "background-color 0.5s ease";

    setTimeout(() => {
      // Сбрасываем переменные темы
      const root = document.documentElement;
      root.style.removeProperty("--theme-primary");
      root.style.removeProperty("--theme-secondary");
      root.style.removeProperty("--theme-accent");
      root.style.removeProperty("--theme-text");
      root.style.removeProperty("--btn-theme-bg");
      root.style.removeProperty("--btn-theme-text");
      root.style.removeProperty("--btn-theme-hover");
      root.style.removeProperty("--btn-theme-active");

      // Сбрасываем фон страницы на дефолтный
      this.app.elements.body.style.backgroundColor = "";
      this.app.elements.body.classList.remove("theme-active");

      const themeElements = document.querySelectorAll(".theme-active");
      themeElements.forEach((el) => el.classList.remove("theme-active"));

      AppState.setState({
        isThemeActive: false,
        currentTheme: null,
      });

      // ВАЖНО: После удаления темы обновляем все кнопки
      setTimeout(() => {
        if (
          this.app.seasonUI &&
          typeof this.app.seasonUI.refreshSeasonButtons === "function"
        ) {
          this.app.seasonUI.refreshSeasonButtons();
        }
        if (
          this.app.actUI &&
          typeof this.app.actUI.refreshActButtons === "function"
        ) {
          this.app.actUI.refreshActButtons();
        }
        if (
          this.app.contentUI &&
          typeof this.app.contentUI.updateModeButtons === "function"
        ) {
          this.app.contentUI.updateModeButtons();
        }
      }, 50);
    }, 300);
  }

  async updateBannerFromAct() {
    const state = AppState.getState();
    if (!state.currentSeason || !state.currentAct) return;

    try {
      let imageUrl = null;
      let actTitle = "";
      let seasonTitle = "";
      let seasonSynopsis = "";

      // Загружаем информацию о сезоне для описания
      try {
        const seasonInfo = await this.fileManager.getSeasonInfo(
          state.currentSeason,
        );
        if (seasonInfo && seasonInfo.synopsis) {
          seasonSynopsis = seasonInfo.synopsis.trim();
        }
        if (seasonInfo && seasonInfo.title) {
          seasonTitle = seasonInfo.title.trim();
        }
      } catch (seasonError) {
        console.log("Could not load season info");
      }

      // Пробуем получить фон из темы
      if (
        state.currentTheme &&
        (state.currentTheme.background || state.currentTheme.backgroundImage)
      ) {
        imageUrl = (
          state.currentTheme.background || state.currentTheme.backgroundImage
        ).trim();
      } else {
        // Пробуем загрузить background.txt
        try {
          const response = await fetch(
            `./data/seasons/${state.currentSeason}/acts/${state.currentAct}/background.txt`,
          );
          if (response.ok) {
            const text = await response.text();
            imageUrl = text.trim();
          }
        } catch (bgError) {
          console.log("background.txt not found, trying season info");
        }
      }

      // Загружаем название акта из story.txt (первая строка)
      try {
        const storyResponse = await fetch(
          `./data/seasons/${state.currentSeason}/acts/${state.currentAct}/story.txt`,
        );
        if (storyResponse.ok) {
          const storyText = await storyResponse.text();
          const lines = storyText.split("\n");
          if (lines.length > 0) {
            // Первая строка - название акта
            actTitle = lines[0].trim();
          }
        }
      } catch (storyError) {
        console.log("story.txt not found for act title");
      }

      if (!actTitle) {
        actTitle = `Акт ${state.currentAct}`;
      }

      const seasonTitleElement = document.getElementById("season-title");
      if (seasonTitleElement) {
        seasonTitleElement.textContent = seasonTitle + ": " + actTitle;
      }

      const seasonSynopsisElement = document.getElementById("season-synopsis");
      if (seasonSynopsisElement) {
        seasonSynopsisElement.textContent = seasonSynopsis;
      }

      if (!imageUrl) {
        const seasonInfo = await this.fileManager.getSeasonInfo(
          state.currentSeason,
        );
        if (seasonInfo && seasonInfo.bannerImage) {
          imageUrl = seasonInfo.bannerImage.trim();
        }
      }

      if (imageUrl) {
        imageUrl = imageUrl.replace(/[\r\n]/g, "");

        // Обработка URL
        if (imageUrl.startsWith("http")) {
          const urlObj = new URL(imageUrl);
          if (!["http:", "https:"].includes(urlObj.protocol)) {
            throw new Error("Unsupported protocol");
          }
        } else if (
          !imageUrl.startsWith("/") &&
          !imageUrl.startsWith("images/")
        ) {
          imageUrl = "/" + imageUrl;
        }

        await this.loadImageWithFallback(imageUrl);
      } else {
        // Устанавливаем дефолтный фон
        this.app.elements.seasonBanner.style.backgroundImage = `url('images/error.png')`;
      }
    } catch (error) {
      console.error("Error loading banner:", error);
      this.app.elements.seasonBanner.style.backgroundImage = `url('images/error.png')`;
    }
  }

  async loadImageWithFallback(url) {
    return new Promise((resolve) => {
      const img = new Image();

      // Начинаем загрузку - добавляем класс loading
      this.app.elements.seasonBanner.classList.add("loading");

      img.onload = () => {
        // Плавное изменение фона
        this.app.elements.seasonBanner.style.transition =
          "background-image 0.5s ease";
        this.app.elements.seasonBanner.style.backgroundImage = `url('${url}')`;

        setTimeout(() => {
          this.app.elements.seasonBanner.classList.remove("loading");
          resolve(true);
        }, 300);
      };

      img.onerror = () => {
        this.app.elements.seasonBanner.style.backgroundImage = `url('images/error.png')`;
        this.app.elements.seasonBanner.classList.remove("loading");
        resolve(false);
      };

      img.src = url;
    });
  }
}

export default ThemeController;
