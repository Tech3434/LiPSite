// fileManager.js
import { sanitizePath, validateUrl, sanitizeHTML } from "./utils.js";
import { parseMarkdownToHTML, initCollapsibles } from "./domUtils.js";

const CACHE_DURATION = 5 * 60 * 1000;
const cache = new Map();
const pendingRequests = new Map();

const fetchWithCache = async (url, options = {}) => {
  // Для GitHub Pages с именем репозитория LiPSite
  let normalizedUrl = url;

  // Если URL начинается с точки, оставляем как есть
  if (url.startsWith("./")) {
    normalizedUrl = url;
  }
  // Если URL начинается с /, добавляем /LiPSite
  else if (url.startsWith("/")) {
    normalizedUrl = "/LiPSite" + url;
  }

  const cacheKey = `${normalizedUrl}:${JSON.stringify(options)}`;
  const now = Date.now();

  if (cache.has(cacheKey)) {
    const { data, timestamp } = cache.get(cacheKey);
    if (now - timestamp < CACHE_DURATION) {
      return data;
    }
    cache.delete(cacheKey);
  }

  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  const request = fetch(normalizedUrl, options)
    .then(async (response) => {
      if (!response.ok) {
        // Пробуем альтернативный путь без /LiPSite (для локального сервера)
        if (response.status === 404 && normalizedUrl.startsWith("/LiPSite/")) {
          const altUrl = normalizedUrl.replace("/LiPSite", "");
          try {
            const altResponse = await fetch(altUrl, options);
            if (altResponse.ok) {
              const data = await altResponse.text();
              cache.set(cacheKey, { data, timestamp: now });
              return data;
            }
          } catch (altError) {
            console.log(`Alternative path also failed: ${altUrl}`);
          }
        }
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} for ${normalizedUrl}`,
        );
      }
      const data = await response.text();
      cache.set(cacheKey, { data, timestamp: now });
      return data;
    })
    .finally(() => {
      pendingRequests.delete(cacheKey);
    });

  pendingRequests.set(cacheKey, request);
  return request;
};

// Оптимизированная функция подсчета папок
const countFolders = async (basePath) => {
  try {
    const sanitizedPath = sanitizePath(basePath);

    // Нормализуем путь для GitHub Pages с LiPSite
    let normalizedPath = sanitizedPath;
    if (sanitizedPath.startsWith("/")) {
      normalizedPath = "/LiPSite" + sanitizedPath;
    }

    // Проверяем первые несколько папок быстро
    const quickCheckPromises = [];
    for (let i = 1; i <= 10; i++) {
      const testPath = `${normalizedPath}${i}/`;
      quickCheckPromises.push(
        fetch(testPath, { method: "HEAD" })
          .then((response) => (response.ok ? i : 0))
          .catch(() => 0),
      );
    }

    const quickResults = await Promise.all(quickCheckPromises);
    const maxQuickFound = Math.max(...quickResults);

    // Если не нашли до 10, значит больше нет сезонов
    if (maxQuickFound < 10) {
      return maxQuickFound;
    }

    // Если есть до 10, продолжаем бинарный поиск
    let left = 11;
    let right = 50; // Максимально предполагаем 50 сезонов
    let lastFound = maxQuickFound;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const testPath = `${normalizedPath}${mid}/`;

      try {
        const response = await fetch(testPath, { method: "HEAD" });
        if (response.ok) {
          lastFound = mid;
          left = mid + 1;
        } else {
          right = mid - 1;
        }
      } catch {
        right = mid - 1;
      }
    }

    return lastFound;
  } catch (error) {
    console.error("Error counting folders:", error);
    return 0;
  }
};

const FileManager = {
  async loadServerConfig() {
    try {
      const content = await fetchWithCache("./data/info/server_config.txt");
      const lines = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line);

      if (lines[0]) {
        const serverName = document.getElementById("footer-server-name");
        if (serverName) serverName.textContent = lines[0];
      }

      if (lines[1]) {
        const creator = document.getElementById("footer-creator");
        if (creator) creator.textContent = lines[1];
      }

      if (lines[2]) {
        const discordLink = validateUrl(lines[2]);
        const discordElements = [
          document.getElementById("discord-link"),
          document.getElementById("footer-discord-link"),
        ];
        discordElements.forEach((el) => {
          if (el) el.href = discordLink;
        });
      }
    } catch (error) {
      console.warn("Using default server configuration");
    }
  },

  async loadOfficialInfo() {
    try {
      const content = await fetchWithCache("./data/info/official_info.txt");

      // Используем parseMarkdownToHTML для обработки Discord-разметки
      const html = parseMarkdownToHTML(content, "#ffffff");

      const officialInfo = document.getElementById("official-info");
      if (officialInfo) {
        officialInfo.innerHTML = `
        <div class="official-info-wrapper">
          <div class="official-content prose max-w-full">
            ${html}
          </div>
        </div>
      `;
        officialInfo.classList.remove("hidden");

        // Инициализируем collapsible секции если есть
        if (html.includes("collapsible-inline")) {
          setTimeout(() => initCollapsibles(officialInfo), 10);
        }
      }
    } catch (error) {
      console.log(error);
      const officialInfo = document.getElementById("official-info");
      if (officialInfo) {
        officialInfo.innerHTML = `
        <div class="official-info-wrapper">
          <div class="content-card">
            <p class="text-lg" style="color: white">
              Информация о сервере будет доступна в ближайшее время.
            </p>
          </div>
        </div>
      `;
        officialInfo.classList.remove("hidden");
      }
    }
  },

  async getActTheme(seasonId, actId) {
    try {
      const sanitizedSeason = sanitizePath(seasonId);
      const sanitizedAct = sanitizePath(actId);

      const content = await fetchWithCache(
        `./data/seasons/${sanitizedSeason}/acts/${sanitizedAct}/design.txt`,
      ).catch(() => null);

      if (!content) {
        return {
          backgroundImage: null,
          primaryColor: "#0f172a",
          secondaryColor: "#475569",
          accentColor: "#6366f1",
          textColor: "#f8fafc",
        };
      }

      const lines = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line);

      const theme = {
        backgroundImage: null,
        primaryColor: "#0f172a",
        secondaryColor: "#475569",
        accentColor: "#6366f1",
        textColor: "#f8fafc",
      };

      const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

      lines.forEach((line) => {
        const lowerLine = line.toLowerCase();
        if (lowerLine.startsWith("background:")) {
          const url = line.substring("background:".length).trim();
          if (url) {
            try {
              theme.backgroundImage = validateUrl(url);
            } catch {
              theme.backgroundImage = url;
            }
          }
        } else if (lowerLine.startsWith("primary:")) {
          const color = line.substring("primary:".length).trim();
          if (colorRegex.test(color)) theme.primaryColor = color;
        } else if (lowerLine.startsWith("secondary:")) {
          const color = line.substring("secondary:".length).trim();
          if (colorRegex.test(color)) theme.secondaryColor = color;
        } else if (lowerLine.startsWith("accent:")) {
          const color = line.substring("accent:".length).trim();
          if (colorRegex.test(color)) theme.accentColor = color;
        } else if (lowerLine.startsWith("text:")) {
          const color = line.substring("text:".length).trim();
          if (colorRegex.test(color)) theme.textColor = color;
        }
      });

      return theme;
    } catch (error) {
      console.error(`Error reading theme for ${seasonId}/${actId}:`, error);
      return {
        backgroundImage: null,
        primaryColor: "#0f172a",
        secondaryColor: "#475569",
        accentColor: "#6366f1",
        textColor: "#f8fafc",
      };
    }
  },

  async getSeasonsList() {
    try {
      const seasonsCount = await countFolders("./data/seasons/season");
      const seasons = [];

      // Параллельная проверка всех сезонов
      const checkPromises = [];
      for (let i = 1; i <= seasonsCount; i++) {
        const seasonId = `season${i}`;
        checkPromises.push(
          fetchWithCache(`./data/seasons/${seasonId}/season_info.txt`)
            .then((content) => {
              const lines = content.split("\n");
              const seasonName = lines[0]?.trim() || `Сезон ${i}`;
              return {
                id: seasonId,
                name: seasonName,
                order: i,
              };
            })
            .catch(() => null),
        );
      }

      const results = await Promise.all(checkPromises);
      results.forEach((season) => {
        if (season) seasons.push(season);
      });

      return seasons.sort((a, b) => a.order - b.order);
    } catch (error) {
      console.error("Error getting seasons list:", error);
      return [];
    }
  },

  async getSeasonInfo(seasonId) {
    try {
      const sanitizedSeason = sanitizePath(seasonId);
      const content = await fetchWithCache(
        `./data/seasons/${sanitizedSeason}/season_info.txt`,
      );

      const lines = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line);

      if (lines.length < 2) {
        return {
          title: `Сезон ${seasonId.replace("season", "")}`,
          bannerImage: "./images/error.png",
          synopsis: "Описание отсутствует.",
        };
      }

      return {
        title: lines[0] || `Сезон ${seasonId.replace("season", "")}`,
        bannerImage: lines[1] || "./images/error.png",
        synopsis: lines.slice(2).join("\n") || "Описание отсутствует.",
      };
    } catch (error) {
      console.error(`Error reading season info for ${seasonId}:`, error);
      return null;
    }
  },

  async getActsForSeason(seasonId) {
    try {
      const sanitizedSeason = sanitizePath(seasonId);
      const actsCount = await countFolders(
        `./data/seasons/${sanitizedSeason}/acts/act`,
      );

      const acts = [];
      const checkPromises = [];

      for (let i = 1; i <= actsCount; i++) {
        const actId = `act${i}`;
        checkPromises.push(
          fetchWithCache(
            `./data/seasons/${sanitizedSeason}/acts/${actId}/story.txt`,
          )
            .then(() => actId)
            .catch(() => null),
        );
      }

      const results = await Promise.all(checkPromises);
      results.forEach((actId) => {
        if (actId) acts.push(actId);
      });

      return acts.sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, "")) || 0;
        const numB = parseInt(b.replace(/\D/g, "")) || 0;
        return numA - numB;
      });
    } catch (error) {
      console.error(`Error getting acts for ${seasonId}:`, error);
      return [];
    }
  },

  async getActStory(seasonId, actId) {
    try {
      const sanitizedSeason = sanitizePath(seasonId);
      const sanitizedAct = sanitizePath(actId);

      const content = await fetchWithCache(
        `./data/seasons/${sanitizedSeason}/acts/${sanitizedAct}/story.txt`,
      );

      const lines = content.split("\n");

      return {
        title: lines[0] || `Акт ${actId.replace("act", "")}`,
        content: lines.slice(1).join("\n") || "История отсутствует.",
      };
    } catch (error) {
      console.error(`Error reading act story for ${seasonId}/${actId}:`, error);
      return null;
    }
  },

  async getActPlayers(seasonId, actId) {
    try {
      const sanitizedSeason = sanitizePath(seasonId);
      const sanitizedAct = sanitizePath(actId);

      const content = await fetchWithCache(
        `./data/seasons/${sanitizedSeason}/acts/${sanitizedAct}/players.txt`,
      );

      const lines = content.split("\n").filter((line) => line.trim() !== "");

      if (lines.length === 0) {
        return {
          title: `Список Игроков - Акт ${actId?.replace("act", "") || "Неизвестно"}`,
          players: [],
        };
      }

      const players = [];
      let hasHeader = false;
      let startIndex = 0;
      let headerLine = lines[0];

      if (
        headerLine &&
        (headerLine.toLowerCase().includes("ник") ||
          headerLine.toLowerCase().includes("никнейм") ||
          headerLine.toLowerCase().includes("nick") ||
          headerLine.includes(","))
      ) {
        hasHeader = true;
        startIndex = 1;
      } else {
        headerLine = "Ник Игрока,Имя,Тип,Статус";
      }

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(",").map((part) => part.trim());
        if (parts.length >= 4) {
          players.push({
            nick: parts[0] || "Неизвестно",
            name: parts[1] || "Неизвестно",
            type: parts[2] || "Неизвестно",
            status: parts[3] || "Неизвестно",
          });
        }
      }

      return {
        title: headerLine,
        players: players,
      };
    } catch (error) {
      console.error(`Error reading players for ${seasonId}/${actId}:`, error);
      return {
        title: "Ник Игрока,Имя,Тип,Статус",
        players: [],
      };
    }
  },

  async getGuidesForSeason(seasonId) {
    try {
      const sanitizedSeason = sanitizePath(seasonId);
      const guides = [];

      try {
        const listContent = await fetchWithCache(
          `./data/seasons/${sanitizedSeason}/guides.txt`,
        );

        const lines = listContent
          .split("\n")
          .filter((line) => line.trim() !== "");

        const guidePromises = lines.map(async (line) => {
          const parts = line.split(":");
          const fileName = parts[0]?.trim();
          const title = parts.slice(1).join(":").trim();

          if (!fileName || !title) return null;

          try {
            const guideContent = await fetchWithCache(
              `./data/seasons/${sanitizedSeason}/guides/${fileName}.txt`,
            );

            const contentLines = guideContent.split("\n");
            const coverImage = contentLines[0]?.trim() || "./images/error.png";
            const description =
              contentLines[1]?.trim() || "Описание отсутствует";
            // Всё остальное - контент гайда (сохраняем все переносы строк)
            const fullContent = contentLines.slice(2).join("\n").trim();

            return {
              id: fileName.replace(".txt", ""),
              title: title,
              description: description, // Вторая строка - описание
              image: coverImage,
              content: fullContent, // Остальное - контент
            };
          } catch (error) {
            console.warn(`Guide ${fileName} not found:`, error);
            return {
              id: fileName.replace(".txt", ""),
              title: title,
              description: "Гайд не найден или поврежден",
              image: "./images/error.png",
              content: "# Гайд недоступен\n\nГайд временно недоступен.",
            };
          }
        });

        const results = await Promise.all(guidePromises);
        results.forEach((guide) => {
          if (guide) guides.push(guide);
        });
      } catch (error) {
        guides.push({
          id: "no_guides",
          title: "Гайды не найдены",
          description: "Гайды для этого сезона пока не добавлены.",
          image: "./images/error.png",
          content:
            "# Гайды не найдены\n\nГайды для этого сезона пока не добавлены администрацией сервера.",
        });
      }

      return guides;
    } catch (error) {
      console.error(`Error getting guides for ${seasonId}:`, error);
      return [
        {
          id: "error",
          title: "Ошибка загрузки",
          description: "Не удалось загрузить список гайдов",
          image: "./images/error.png",
          content: "# Ошибка\n\nНе удалось загрузить гайды. Попробуйте позже.",
        },
      ];
    }
  },

  async getGuideContent(seasonId, guideId) {
    try {
      const sanitizedSeason = sanitizePath(seasonId);
      const sanitizedGuide = sanitizePath(guideId);

      const content = await fetchWithCache(
        `./data/seasons/${sanitizedSeason}/guides/${sanitizedGuide}.txt`,
      );

      const lines = content.split("\n");

      if (lines.length <= 1 && lines[0].trim() === "") {
        return {
          title: guideId
            .replace(/_/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase()),
          content: "Содержание гайда отсутствует или находится в разработке.",
        };
      }

      return {
        title: guideId
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase()),
        content: lines.slice(1).join("\n").trim() || "Содержание отсутствует.",
      };
    } catch (error) {
      console.error(
        `Error getting guide content for ${seasonId}/${guideId}:`,
        error,
      );
      return {
        title: guideId
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase()),
        content:
          "Не удалось загрузить содержание гайда. Пожалуйста, попробуйте позже.",
      };
    }
  },

  clearCache() {
    cache.clear();
    pendingRequests.clear();
  },

  getCacheStats() {
    return {
      cachedItems: cache.size,
      pendingRequests: pendingRequests.size,
    };
  },
};

export default FileManager;
