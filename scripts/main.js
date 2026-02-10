import AppController from "./controllers/appController.js";

document.addEventListener("DOMContentLoaded", () => {
  const app = new AppController();
  window.app = app;
  app.init();
});
