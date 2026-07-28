import AppState from "../appState.js";
import {
  createElement,
  parseMarkdownToHTML,
  fadeElement,
} from "../domUtils.js";
import { sanitizeHTML } from "../utils.js";

// Кэш для разобранного HTML-контента — чтобы при возврате
// на ранее просмотренный акт не перепаршивать markdown заново
const parsedHTMLCache = new Map();

function getCacheKey(seasonId, actId, mode) {
  return `${seasonId}:${actId}:${mode}`;
}

class ContentUI {
  constructor(app) {
    this.app = app;
    this.fileManager = app.fileManager;
    this.lastClickTime = 0;
  }

  attachEventListeners() {
    this.app.elements.contentModeSelector.addEventListener("click", (e) => {
      const button = e.target.closest(".btn");
      if (button && button.dataset.mode) {
        const now = Date.now();
        if (now - this.lastClickTime < 300) return;
        this.lastClickTime = now;

        const originalContent = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        button.disabled = true;

        this.selectContentMode(button.dataset.mode).finally(() => {
          setTimeout(() => {
            button.innerHTML = originalContent;
            button.disabled = false;
          }, 300);
        });
      }
    });

    // Делегирование событий для кнопок открытия гайдов — работает даже при восстановлении из кэша
    this.app.elements.guidesGrid.addEventListener("click", (e) => {
      const btn = e.target.closest(".open-guide-btn");
      if (!btn) return;

      const guideId = btn.dataset.guideId;
      if (!guideId) return;

      // Ищем гайд в состоянии
      const state = AppState.getState();
      const guidesGrid = this.app.elements.guidesGrid;

      // Пытаемся найти объект гайда по data-guide-id из карточки
      const card = btn.closest("[data-guide-id]");
      if (!card) return;

      const cardGuideId = card.dataset.guideId;

      btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Загрузка...';
      btn.disabled = true;

      // Загружаем гайды и находим нужный
      this.fileManager.getGuidesForSeason(state.currentSeason)
        .then((guides) => {
          const guide = guides.find((g) => g.id === cardGuideId);
          if (guide) {
            return this.app.guideUI.openGuideModal(guide);
          }
        })
        .catch((err) => {
          console.error("Error opening guide:", err);
        })
        .finally(() => {
          setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-external-link-alt mr-2"></i> Открыть';
            btn.disabled = false;
          }, 2000);
        });
    });
  }

  async selectContentMode(mode) {
    const state = AppState.getState();
    if (state.currentMode === mode) return;

    if (state.currentOpenGuide && mode !== "guides") {
      this.app.modal.closeGuideModal();
    }

    const previousMode = state.currentMode;
    AppState.setState({ currentMode: mode });
    this.updateModeButtons();

    const currentSection = document.getElementById(`${previousMode}-content`);
    const targetSection = document.getElementById(`${mode}-content`);

    if (!currentSection) {
      if (targetSection) {
        targetSection.classList.remove("hidden");
        targetSection.style.opacity = "1";
        setTimeout(async () => {
          await this.app.content.updateContentForCurrentMode();
        }, 50);
      }
      this.app.navigation.updateURL();
      return;
    }

    if (currentSection) {
      await fadeElement(currentSection, "out", 150);
      currentSection.classList.add("hidden");
    }

    if (targetSection) {
      targetSection.classList.remove("hidden");
      targetSection.style.opacity = "0";

      await Promise.all([
        fadeElement(targetSection, "in", 200),
        this.app.content.updateContentForCurrentMode(),
      ]);
    }

    this.app.navigation.updateURL();
  }

  updateModeButtons() {
    const state = AppState.getState();
    const buttons =
      this.app.elements.contentModeSelector.querySelectorAll(".btn");

    buttons.forEach((btn) => {
      if (btn.dataset.mode === state.currentMode) {
        if (state.isThemeActive && state.currentTheme) {
          // Устанавливаем тему для активной кнопки
          btn.style.setProperty(
            "--btn-theme-bg",
            state.currentTheme.accent ||
              state.currentTheme.accentColor ||
              "#6366f1",
          );
          btn.style.setProperty(
            "--btn-theme-text",
            state.currentTheme.text ||
              state.currentTheme.textColor ||
              "#ffffff",
          );
          btn.style.setProperty(
            "--btn-theme-hover",
            this.app.theme.lightenDarkenColor(
              state.currentTheme.accent ||
                state.currentTheme.accentColor ||
                "#6366f1",
              -20,
            ) || "#4f46e5",
          );
          btn.style.setProperty(
            "--btn-theme-active",
            this.app.theme.lightenDarkenColor(
              state.currentTheme.accent ||
                state.currentTheme.accentColor ||
                "#6366f1",
              -40,
            ) || "#4338ca",
          );
          btn.className = "btn btn-state-active active-mode";
        } else {
          btn.className = "btn btn-state-active active-mode";
          // Сбрасываем кастомные стили
          btn.style.removeProperty("--btn-theme-bg");
          btn.style.removeProperty("--btn-theme-text");
          btn.style.removeProperty("--btn-theme-hover");
          btn.style.removeProperty("--btn-theme-active");
        }
      } else {
        if (state.isThemeActive && state.currentTheme) {
          // Устанавливаем тему для неактивной кнопки
          btn.style.setProperty("--btn-theme-bg", "transparent");
          btn.style.setProperty(
            "--btn-theme-text",
            state.currentTheme.text ||
              state.currentTheme.textColor ||
              "#f8fafc",
          );
          btn.style.setProperty(
            "--btn-theme-hover",
            (state.currentTheme.secondary ||
              state.currentTheme.secondaryColor ||
              "#475569") + "30",
          );
          btn.className = "btn btn-state-inactive";
        } else {
          btn.className = "btn btn-state-inactive";
          // Сбрасываем кастомные стили
          btn.style.removeProperty("--btn-theme-bg");
          btn.style.removeProperty("--btn-theme-text");
          btn.style.removeProperty("--btn-theme-hover");
          btn.style.removeProperty("--btn-theme-active");
        }
      }
    });
  }

  async updateStoryContent() {
    const state = AppState.getState();

    // OPTIMIZE: Используем кэш разобранного HTML, чтобы не парсить заново
    const cacheKey = getCacheKey(state.currentSeason, state.currentAct, "story");
    if (!parsedHTMLCache.has(cacheKey)) {
      const story = await this.fileManager.getActStory(
        state.currentSeason,
        state.currentAct,
      );

      if (story) {
        const textColor = state.isThemeActive
          ? state.currentTheme?.text || state.currentTheme?.textColor
          : null;
        parsedHTMLCache.set(cacheKey, {
          title: story.title,
          html: parseMarkdownToHTML(story.content, textColor),
        });
      } else {
        parsedHTMLCache.set(cacheKey, {
          title: "",
          html: '<p class="text-slate-400">История отсутствует.</p>',
        });
      }
    }

    const cached = parsedHTMLCache.get(cacheKey);
    this.app.elements.actTitle.textContent = cached.title;
    this.app.elements.actStory.innerHTML = cached.html;
  }

  async updatePlayersContent() {
    const state = AppState.getState();

    // OPTIMIZE: Используем кэш разобранных данных игроков
    const cacheKey = getCacheKey(state.currentSeason, state.currentAct, "players");
    if (!parsedHTMLCache.has(cacheKey)) {
      const playersData = await this.fileManager.getActPlayers(
        state.currentSeason,
        state.currentAct,
      );
      parsedHTMLCache.set(cacheKey, playersData);
    }

    const playersData = parsedHTMLCache.get(cacheKey);

    this.app.elements.playersTableBody.innerHTML = "";
    const tableHeaders = this.app.elements.playersTableBody
      .closest("table")
      .querySelectorAll(".table-header-cell");
    const headerTitles = playersData.title
      .split(",")
      .map((title) => title.trim());

    if (tableHeaders.length >= 4 && headerTitles.length >= 4) {
      tableHeaders[0].textContent = headerTitles[0] || "Ник";
      tableHeaders[1].textContent = headerTitles[1] || "Имя";
      tableHeaders[2].textContent = headerTitles[2] || "Тип";
      tableHeaders[3].textContent = headerTitles[3] || "Статус";
    }

    if (!playersData.players || playersData.players.length === 0) {
      this.app.elements.playersTableBody.innerHTML = `
      <tr class="table-body-row">
        <td colspan="4" class="table-body-cell py-8 text-center" 
            style="color: ${state.isThemeActive ? "var(--theme-text)" : "#94a3b8"}">
          Данные игроков отсутствуют для этого акта.
        </td>
      </tr>
    `;
      return;
    }

    playersData.players.forEach((player, index) => {
      const row = createElement("tr", {
        classes: "table-body-row",
        attributes: {
          style: `opacity: 0; transform: translateY(10px); transition: opacity 0.3s ease ${index * 0.05}s, transform 0.3s ease ${index * 0.05}s;`,
        },
      });

      let statusClass = "status-alive";
      if (player.status === "Мёртв") statusClass = "status-dead";
      if (player.status === "Потерян") statusClass = "status-lost";
      if (player.status === "Ушёл") statusClass = "status-left";

      row.innerHTML = `
      <td class="table-body-cell font-medium">${sanitizeHTML(player.nick)}</td>
      <td class="table-body-cell">${sanitizeHTML(player.name)}</td>
      <td class="table-body-cell">${sanitizeHTML(player.type)}</td>
      <td class="table-body-cell ${statusClass} font-medium">${sanitizeHTML(player.status)}</td>
    `;

      this.app.elements.playersTableBody.appendChild(row);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          row.style.opacity = "1";
          row.style.transform = "translateY(0)";
        });
      });
    });
  }

  async updateGuidesContent() {
    const state = AppState.getState();
    const guidesGrid = this.app.elements.guidesGrid;

    // OPTIMIZE: Используем кэш разобранных гайдов
    const cacheKey = getCacheKey(state.currentSeason, state.currentAct, "guides");
    if (parsedHTMLCache.has(cacheKey)) {
      const cached = parsedHTMLCache.get(cacheKey);
      guidesGrid.innerHTML = cached;
      return;
    }

    guidesGrid.innerHTML = `
    <div class="col-span-full text-center py-12">
      <div class="loader mx-auto mb-4"></div>
      <p style="color: ${state.isThemeActive ? "var(--theme-text)" : "#cbd5e1"}">
        Загрузка гайдов...
      </p>
    </div>
  `;

    try {
      const guides = await this.fileManager.getGuidesForSeason(
        state.currentSeason,
      );
      guidesGrid.innerHTML = "";

      if (!guides || guides.length === 0) {
        guidesGrid.innerHTML = `
        <div class="col-span-full text-center py-12">
          <i class="fas fa-book-open text-4xl mb-4 opacity-50" 
             style="color: ${state.isThemeActive ? "var(--theme-text)" : "#94a3b8"}"></i>
          <p style="color: ${state.isThemeActive ? "var(--theme-text)" : "#94a3b8"}">
            Гайды для этого сезона отсутствуют
          </p>
        </div>
      `;
        // Кэшируем даже пустое состояние
        parsedHTMLCache.set(cacheKey, guidesGrid.innerHTML);
        return;
      }

      // ИЗМЕНЯЕМ ГРИД НА БОЛЬШЕ КОЛОНОК ДЛЯ КОМПАКТНОСТИ
      guidesGrid.className =
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4";

      guides.forEach((guide, index) => {
        const card = createElement("div", {
          classes: "card-animated",
          dataset: { guideId: guide.id },
          attributes: {
            style: `opacity: 0; transform: translateY(20px); 
                  animation: fadeInUp 0.5s ease ${index * 0.1}s forwards;`,
          },
        });

        const imageContainer = createElement("div", {
          classes: "h-full overflow-hidden",
        });

        const img = createElement("img", {
          attributes: {
            src: guide.image || "images/error.png",
            alt: guide.title,
            class:
              "w-full h-full object-cover transition-transform duration-500",
            loading: "lazy",
          },
        });

        img.onerror = function () {
          this.src = "images/error.png";
          this.onerror = null;
        };

        imageContainer.appendChild(img);

        // КОНТЕЙНЕР ДЛЯ ТЕКСТА И КНОПКИ
        const contentContainer = createElement("div", {
          classes: "card-content",
        });

        const title = createElement("h4", {
          classes: "text-lg font-bold mb-2 line-clamp-1",
          attributes: {
            style: `color: ${state.isThemeActive ? "var(--theme-text)" : "#cbd5e1"}`,
          },
          text: guide.title,
        });

        // ИСПОЛЬЗУЕМ ОПИСАНИЕ ИЗ guide.description (должно содержать вторую строку из файла гайда)
        const description = createElement("p", {
          classes: "guide-description text-sm mb-4 line-clamp-3",
          attributes: {
            style: `color: ${state.isThemeActive ? "var(--theme-text)" : "#94a3b8"}`,
          },
          text: guide.description || "Описание отсутствует",
        });

        const button = createElement("button", {
          classes: `btn ${state.isThemeActive ? "btn-theme-primary" : "btn-mode-primary"} open-guide-btn`,
          dataset: { guideId: guide.id },
        });

        const icon = createElement("i", {
          classes: "fas fa-external-link-alt mr-2",
        });

        const buttonText = document.createTextNode("Открыть");
        button.appendChild(icon);
        button.appendChild(buttonText);

        contentContainer.appendChild(title);
        contentContainer.appendChild(description);
        contentContainer.appendChild(button);

        card.appendChild(imageContainer);
        card.appendChild(contentContainer);
        guidesGrid.appendChild(card);


      });

      // OPTIMIZE: Сохраняем в кэш ПОСЛЕ построения всех карточек
      parsedHTMLCache.set(cacheKey, guidesGrid.innerHTML);
    } catch (error) {
      console.error("Error updating guides content:", error);
      guidesGrid.innerHTML = `
      <div class="col-span-full text-center py-12">
        <i class="fas fa-exclamation-triangle text-4xl mb-4" 
           style="color: ${state.isThemeActive ? "var(--theme-text)" : "#ef4444"}"></i>
        <p style="color: ${state.isThemeActive ? "var(--theme-text)" : "#ef4444"}">
          Ошибка загрузки гайдов
        </p>
      </div>
    `;
    }
  }
}

export default ContentUI;
