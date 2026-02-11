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

// utils.js - добавьте эту функцию
export function getRepoBasePath() {
  // Определяем базовый путь репозитория на GitHub Pages
  const hostname = window.location.hostname;
  
  // Если это не GitHub Pages, возвращаем ./ для локальной разработки
  if (!hostname.includes('github.io')) {
    return './';
  }
  
  // Получаем путь из URL (например: "/LiPSite/", "/my-repo/", "/")
  const pathname = window.location.pathname;
  
  // Разбиваем путь на части
  const pathParts = pathname.split('/').filter(part => part);
  
  // Если это корень домена (username.github.io), пути нет
  if (pathParts.length === 0) {
    return './';
  }
  
  // Первая часть после слеша - это название репозитория
  const repoName = pathParts[0];
  
  // Если это не index.html или другой файл, а именно репозиторий
  if (!repoName.includes('.')) {
    return `/${repoName}/`;
  }
  
  // Иначе используем корень
  return './';
}

export function normalizeImagePath(imagePath) {
  if (!imagePath) return imagePath;
  
  const basePath = getRepoBasePath();
  const cleanImagePath = imagePath.trim();
  
  // Если путь уже абсолютный (http/https), оставляем как есть
  if (cleanImagePath.startsWith('http://') || cleanImagePath.startsWith('https://')) {
    return cleanImagePath;
  }
  
  // Если путь начинается с /, проверяем, содержит ли он уже имя репозитория
  if (cleanImagePath.startsWith('/')) {
    // Получаем имя репозитория из basePath
    const repoName = basePath.replace(/[\/.]/g, '');
    
    // Если путь уже содержит имя репозитория, оставляем как есть
    if (repoName && cleanImagePath.includes(`/${repoName}/`)) {
      return cleanImagePath;
    }
    
    // Добавляем имя репозитория
    if (basePath !== './' && repoName) {
      return `/${repoName}${cleanImagePath}`;
    }
    
    // Для корневого репозитория или локальной разработки
    return cleanImagePath;
  }
  
  // Если путь начинается с ./, корректируем в зависимости от окружения
  if (cleanImagePath.startsWith('./')) {
    if (basePath !== './') {
      // На GitHub Pages с репозиторием
      const repoName = basePath.replace(/[\/.]/g, '');
      return `/${repoName}/${cleanImagePath.substring(2)}`;
    }
    // Локально оставляем как есть
    return cleanImagePath;
  }
  
  // Относительный путь без префикса
  if (basePath !== './') {
    const repoName = basePath.replace(/[\/.]/g, '');
    return `/${repoName}/${cleanImagePath}`;
  }
  
  // Локально добавляем ./
  return `./${cleanImagePath}`;
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

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};
