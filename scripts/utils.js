// utils.js
export const sanitizePath = (path) => {
  if (!path || typeof path !== "string") {
    throw new Error("Invalid path");
  }
  if (path.includes("..") || path.includes("//")) {
    throw new Error("Path traversal attempt detected");
  }
  return path.replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
};

export function normalizeImagePath(imagePath) {
  if (!imagePath) return imagePath;
  const clean = imagePath.trim();
  if (clean.startsWith("http://") || clean.startsWith("https://")) return clean;

  // Определяем базовый путь из <base> или из URL страницы (для GitHub Pages)
  const base = getBasePath();

  if (clean.startsWith("/")) {
    // Абсолютный путь: /images/x.png → base + images/x.png
    return base + clean.substring(1);
  }
  if (clean.startsWith("./")) {
    // Относительный путь: ./images/x.png → base + images/x.png
    return base + clean.substring(2);
  }
  // Путь без префикса: images/x.png → base + images/x.png
  return base + clean;
}

function getBasePath() {
  // Сначала проверяем <base href="...">
  const baseEl = document.querySelector('base');
  const baseHref = baseEl?.getAttribute('href');
  if (baseHref && baseHref !== '/' && baseHref !== './' && baseHref !== '.') {
    // Используем base (например /LiPSite/) для корректного resolve
    return baseHref;
  }
  // Определяем по pathname: если путь содержит /LiPSite/, используем его
  const pathname = window.location.pathname;
  const match = pathname.match(/^\/([^/]+)\//);
  if (match && match[1] !== '') {
    return '/' + match[1] + '/';
  }
  return './';
}

export const validateUrl = (url) => {
  try {
    const urlObj = new URL(url, window.location.origin);
    return urlObj.href;
  } catch {
    throw new Error("Invalid URL");
  }
};

export const sanitizeHTML = (str) => {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
};

export const convertToRoman = (num) => {
  if (!num || isNaN(num) || num <= 0) return "";
  const romanMap = [
    { value: 1000, numeral: "M" },
    { value: 900, numeral: "CM" },
    { value: 500, numeral: "D" },
    { value: 400, numeral: "CD" },
    { value: 100, numeral: "C" },
    { value: 90, numeral: "XC" },
    { value: 50, numeral: "L" },
    { value: 40, numeral: "XL" },
    { value: 10, numeral: "X" },
    { value: 9, numeral: "IX" },
    { value: 5, numeral: "V" },
    { value: 4, numeral: "IV" },
    { value: 1, numeral: "I" },
  ];
  let result = "";
  let remaining = num;
  for (const { value, numeral } of romanMap) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }
  return result;
};
