class ModalController {
  constructor(app) {
    this.app = app;
  }

  attachEventListeners() {
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
}

export default ModalController;
