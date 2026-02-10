import AppState from "../appState.js";
import { parseMarkdownToHTML, fadeElement } from "../domUtils.js";

class GuideUI {
  constructor(app) {
    this.app = app;
    this.fileManager = app.fileManager;
  }

  async openGuideFromURL(guideId) {
    const state = AppState.getState();
    if (!state.currentSeason || !guideId) return;

    try {
      if (state.currentMode !== "guides") {
        await this.app.contentUI.selectContentMode("guides");
        // Даем время на переключение режима
        await new Promise((resolve) => setTimeout(resolve, 400));
      }

      const guides = await this.fileManager.getGuidesForSeason(
        state.currentSeason,
      );
      const guide = guides.find((g) => g.id === guideId);

      if (guide) {
        AppState.setState({ currentOpenGuide: guideId });
        await this.openGuideModal(guide);
      }
    } catch (error) {
      console.error("Error opening guide from URL:", error);
    }
  }

  async openGuideModal(guide) {
    if (!this.app.elements.guideModal.classList.contains("hidden")) {
      await this.closeGuideModal();
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Сбрасываем классы анимации закрытия
    this.app.elements.guideModal.classList.remove("closing");
    this.app.elements.guideModalContent.classList.remove("closing");

    AppState.setState({
      currentOpenGuide: guide.id,
      isTransitioning: true,
    });

    this.app.elements.guideModal.classList.remove("hidden");
    this.app.elements.guideModal.style.display = "flex";
    //this.app.elements.guideModalTitle.textContent = guide.title;
    this.app.elements.guideModalContent.innerHTML = `
    <div class="flex justify-center items-center py-12">
      <div class="text-center">
        <div class="loader mx-auto mb-4"></div>
        <p style="color: ${AppState.getState("isThemeActive") ? "var(--theme-text)" : "#cbd5e1"}">Загрузка гайда...</p>
      </div>
    </div>
  `;

    document.body.style.overflow = "hidden";

    // Запускаем анимацию появления
    this.app.elements.guideModal.style.animation = "none";
    this.app.elements.guideModalContent.style.animation = "none";

    // Принудительный reflow для запуска анимации
    void this.app.elements.guideModal.offsetWidth;
    void this.app.elements.guideModalContent.offsetWidth;

    this.app.elements.guideModal.style.animation = "";
    this.app.elements.guideModalContent.style.animation = "";

    try {
      const guideContent = guide.content;

      const state = AppState.getState();
      const textColor = state.isThemeActive
        ? state.currentTheme.textColor
        : null;

      const contentToDisplay = guideContent || "Содержание гайда отсутствует.";

      if (contentToDisplay && contentToDisplay.trim()) {
        this.app.elements.guideModalContent.innerHTML = `
        <div class="modal-header">
          <h2 class="modal-title">${guide.title}</h2>
          <button class="modal-close-btn" aria-label="Закрыть">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body content-text prose">
          ${parseMarkdownToHTML(contentToDisplay, textColor)}
        </div>
      `;

        // Добавляем обработчик для новой кнопки закрытия
        const closeBtn =
          this.app.elements.guideModalContent.querySelector(".modal-close-btn");
        if (closeBtn) {
          closeBtn.addEventListener("click", () => this.closeGuideModal());
        }
      } else {
        const colorStyle = state.isThemeActive
          ? 'style="color: var(--theme-text)"'
          : 'class="text-slate-400"';
        this.app.elements.guideModalContent.innerHTML = `
        <div class="modal-header">
          <h2 class="modal-title">${guide.title}</h2>
          <button class="modal-close-btn" aria-label="Закрыть">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="text-center py-12" ${colorStyle}>
          <i class="fas fa-book-open text-4xl mb-4 opacity-50"></i>
          <p class="text-lg">Содержание гайда отсутствует</p>
        </div>
      `;
      }
    } catch (error) {
      console.error("Error loading guide content:", error);
      const colorStyle = AppState.getState("isThemeActive")
        ? 'style="color: var(--theme-text)"'
        : 'class="text-red-400"';
      this.app.elements.guideModalContent.innerHTML = `
      <div class="modal-header">
        <h2 class="modal-title">${guide.title}</h2>
        <button class="modal-close-btn" aria-label="Закрыть">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="text-center py-12" ${colorStyle}>
        <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
        <p class="text-lg">Не удалось загрузить гайд</p>
        <p class="text-sm opacity-75 mt-2">Пожалуйста, попробуйте позже</p>
      </div>
    `;
    }

    this.app.navigation.updateURL();
    AppState.setState({ isTransitioning: false });
  }

  async closeGuideModal() {
    // Запускаем анимацию закрытия
    this.app.elements.guideModal.classList.add("closing");
    this.app.elements.guideModalContent.classList.add("closing");

    // Ждем завершения анимации (300ms)
    await new Promise((resolve) => setTimeout(resolve, 300));

    this.app.elements.guideModal.classList.add("hidden");
    this.app.elements.guideModal.style.display = "none";
    document.body.style.overflow = "auto";
    AppState.setState({ currentOpenGuide: null });
    this.app.navigation.updateURL();
  }
}

export default GuideUI;
