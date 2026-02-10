import AppState from "../appState.js";
import {
  createElement,
  parseMarkdownToHTML,
  fadeElement,
} from "../domUtils.js";
import { sanitizeHTML } from "../utils.js";

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
          btn.className = "btn btn-state-active theme-active active-mode";
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
          btn.className = "btn btn-state-inactive theme-active";
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
    const story = await this.fileManager.getActStory(
      state.currentSeason,
      state.currentAct,
    );

    if (story) {
      const textColor = state.isThemeActive
        ? state.currentTheme?.text || state.currentTheme?.textColor
        : null;
      this.app.elements.actTitle.textContent = story.title;
      const parsedHTML = parseMarkdownToHTML(story.content, textColor);
      this.app.elements.actStory.innerHTML = parsedHTML;
    } else {
      this.app.elements.actStory.innerHTML =
        '<p class="text-slate-400">История отсутствует.</p>';
    }
  }

  async updatePlayersContent() {
    const state = AppState.getState();
    const playersData = await this.fileManager.getActPlayers(
      state.currentSeason,
      state.currentAct,
    );

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
      <tr class="table-body-row ${state.isThemeActive ? "theme-active" : ""}">
        <td colspan="4" class="table-body-cell ${state.isThemeActive ? "theme-active" : ""} py-8 text-center" 
            style="color: ${state.isThemeActive ? "var(--theme-text)" : "#94a3b8"}">
          Данные игроков отсутствуют для этого акта.
        </td>
      </tr>
    `;
      return;
    }

    playersData.players.forEach((player, index) => {
      const row = createElement("tr", {
        classes: `table-body-row ${state.isThemeActive ? "theme-active" : ""}`,
        attributes: {
          style: `opacity: 0; transform: translateY(10px); transition: opacity 0.3s ease ${index * 0.05}s, transform 0.3s ease ${index * 0.05}s;`,
        },
      });

      let statusClass = "status-alive";
      if (player.status === "Мёртв") statusClass = "status-dead";
      if (player.status === "Потерян") statusClass = "status-lost";
      if (player.status === "Ушёл") statusClass = "status-left";
      if (state.isThemeActive) statusClass += " theme-active";

      row.innerHTML = `
      <td class="table-body-cell ${state.isThemeActive ? "theme-active" : ""} font-medium">${sanitizeHTML(player.nick)}</td>
      <td class="table-body-cell ${state.isThemeActive ? "theme-active" : ""}">${sanitizeHTML(player.name)}</td>
      <td class="table-body-cell ${state.isThemeActive ? "theme-active" : ""}">${sanitizeHTML(player.type)}</td>
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
    guidesGrid.innerHTML = `
    <div class="col-span-full text-center py-12">
      <div class="loader mx-auto mb-4 ${state.isThemeActive ? "theme-active" : ""}"></div>
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
        return;
      }

      // ИЗМЕНЯЕМ ГРИД НА БОЛЬШЕ КОЛОНОК ДЛЯ КОМПАКТНОСТИ
      guidesGrid.className =
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4";

      guides.forEach((guide, index) => {
        const card = createElement("div", {
          classes: `card-animated ${state.isThemeActive ? "theme-active" : ""}`,
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

        button.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();

          const originalIcon = icon.cloneNode(true);
          const originalText = buttonText.cloneNode(true);
          button.innerHTML = "";
          const spinnerIcon = createElement("i", {
            classes: "fas fa-spinner fa-spin mr-2",
          });
          const loadingText = document.createTextNode(" Загрузка...");
          button.appendChild(spinnerIcon);
          button.appendChild(loadingText);
          button.disabled = true;

          try {
            await this.app.guideUI.openGuideModal(guide);
          } catch (error) {
            console.error("Error opening guide:", error);
            button.innerHTML = "";
            const errorIcon = createElement("i", {
              classes: "fas fa-exclamation-triangle mr-2",
            });
            const errorText = document.createTextNode(" Ошибка");
            button.appendChild(errorIcon);
            button.appendChild(errorText);
          } finally {
            setTimeout(() => {
              button.innerHTML = "";
              button.appendChild(originalIcon);
              button.appendChild(originalText);
              button.disabled = false;
            }, 2000);
          }
        });
      });
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
