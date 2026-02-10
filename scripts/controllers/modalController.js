import AppState from "../appState.js";

class ModalController {
  constructor(app) {
    this.app = app;
  }

  attachEventListeners() {
    // Удаляем старый обработчик закрытия, так как теперь кнопка внутри контента
    // и управляется через guideUI.closeGuideModal()

    this.app.elements.guideModal.addEventListener("click", (e) => {
      if (e.target === this.app.elements.guideModal) {
        this.app.guideUI.closeGuideModal();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        !this.app.elements.guideModal.classList.contains("hidden")
      ) {
        this.app.guideUI.closeGuideModal();
      }
    });
  }

  // Удаляем старый метод closeGuideModal, так как он теперь в guideUI.js
}

export default ModalController;
