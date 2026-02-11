// fileManager.js - Исправленная версия для GitHub Pages
import { sanitizePath, validateUrl, sanitizeHTML, normalizeImagePath } from "./utils.js";
import { parseMarkdownToHTML, initCollapsibles } from "./domUtils.js";


// Мне похуй
const BASE_PATH = window.location.pathname.includes("/LiPSite")
  ? "/LiPSite/"
  : "./";

const CACHE_DURATION = 5 * 60 * 1000;
const cache = new Map();
const pendingRequests = new Map();

// Упрощенная функция fetch - ВСЕГДА использует относительные пути
const fetchWithCache = async (url, options = {}) => {
  // Нормализуем URL: убираем начальный / если есть
  let normalizedUrl = url.startsWith("/") ? url.substring(1) : url;

  // Если путь начинается с LiPSite/, убираем это
  if (normalizedUrl.startsWith("LiPSite/")) {
    normalizedUrl = normalizedUrl.substring(8);
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
        // Пробуем с ./ если не начинается с него
        if (
          !normalizedUrl.startsWith("./") &&
          !normalizedUrl.startsWith("http")
        ) {
          const altUrl = "./" + normalizedUrl;
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

// Функция подсчета папок
const countFolders = async (basePath) => {
    try {
        const sanitizedPath = sanitizePath(basePath);
        
        // Убираем начальный / если есть
        const cleanPath = sanitizedPath.startsWith('/') ? sanitizedPath.substring(1) : sanitizedPath;
        
        // Вместо проверки папок через HEAD, будем искать файлы
        // Предположим, что у нас максимум 10 сезонов
        const maxSeasons = 10;
        const foundSeasons = [];
        
        // Проверяем наличие season_info.txt для каждого возможного сезона
        const checkPromises = [];
        for (let i = 1; i <= maxSeasons; i++) {
            const seasonPath = `${cleanPath}${i}/season_info.txt`;
            checkPromises.push(
                fetch(seasonPath, { method: "HEAD" })
                    .then((response) => response.ok ? i : 0)
                    .catch(() => 0)
            );
        }
        
        const results = await Promise.all(checkPromises);
        
        // Считаем найденные сезоны
        let count = 0;
        for (let i = 0; i < results.length; i++) {
            if (results[i] > 0) {
                count++;
            } else {
                // Если нашли разрыв, останавливаемся
                break;
            }
        }
        
        return count;
    } catch (error) {
        console.error("Error counting folders:", error);
        return 0;
    }
};

const FileManager = {
  async loadServerConfig() {
    try {
      const content = await fetchWithCache("data/info/server_config.txt");
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
      const content = await fetchWithCache("data/info/official_info.txt");
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

        if (html.includes("collapsible-inline")) {
          setTimeout(() => initCollapsibles(officialInfo), 10);
        }
      }
    } catch (error) {
      console.log("Error loading official info:", error);
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
        `data/seasons/${sanitizedSeason}/acts/${sanitizedAct}/design.txt`,
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
          let url = line.substring("background:".length).trim();
          
          if (url) {
            // ИСПРАВЛЕНИЕ: Используем универсальную нормализацию
            const normalizedUrl = normalizeImagePath(url);
            
            try {
              theme.backgroundImage = validateUrl(normalizedUrl);
            } catch {
              theme.backgroundImage = normalizedUrl;
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
          // Читаем файл со списком сезонов или проверяем последовательно
          const maxSeasonsToCheck = 10;
          const seasons = [];
          
          const checkPromises = [];
          for (let i = 1; i <= maxSeasonsToCheck; i++) {
              const seasonId = `season${i}`;
              checkPromises.push(
                  fetchWithCache(`data/seasons/${seasonId}/season_info.txt`)
                      .then((content) => {
                          const lines = content.split("\n");
                          const seasonName = lines[0]?.trim() || `Сезон ${i}`;
                          return {
                              id: seasonId,
                              name: seasonName,
                              order: i,
                          };
                      })
                      .catch(() => null)
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
        `data/seasons/${sanitizedSeason}/season_info.txt`,
      );

      const lines = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line);

      if (lines.length < 2) {
        return {
          title: `Сезон ${seasonId.replace("season", "")}`,
          bannerImage: "images/error.png",
          synopsis: "Описание отсутствует.",
        };
      }

      return {
        title: lines[0] || `Сезон ${seasonId.replace("season", "")}`,
        bannerImage: lines[1] || "images/error.png",
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
      
      // Вместо подсчета папок, проверяем акты последовательно
      const maxActsToCheck = 10; // Максимально предполагаем 10 актов
      const acts = [];
      
      const checkPromises = [];
      for (let i = 1; i <= maxActsToCheck; i++) {
        const actId = `act${i}`;
        checkPromises.push(
          fetchWithCache(
            `data/seasons/${sanitizedSeason}/acts/${actId}/story.txt`,
          )
            .then(() => actId) // Если файл существует, возвращаем actId
            .catch(() => null), // Если ошибка, возвращаем null
        );
      }
      
      const results = await Promise.all(checkPromises);
      
      // Фильтруем null значения и добавляем найденные акты
      results.forEach((actId) => {
        if (actId) acts.push(actId);
      });
      
      // Сортируем акты по номеру
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
        `data/seasons/${sanitizedSeason}/acts/${sanitizedAct}/story.txt`,
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
        `data/seasons/${sanitizedSeason}/acts/${sanitizedAct}/players.txt`,
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
          `data/seasons/${sanitizedSeason}/guides.txt`,
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
              `data/seasons/${sanitizedSeason}/guides/${fileName}.txt`,
            );

            const contentLines = guideContent.split("\n");
            const coverImage = contentLines[0]?.trim() || "images/error.png";
            const description =
              contentLines[1]?.trim() || "Описание отсутствует";
            const fullContent = contentLines.slice(2).join("\n").trim();

            return {
              id: fileName.replace(".txt", ""),
              title: title,
              description: description,
              image: coverImage,
              content: fullContent,
            };
          } catch (error) {
            console.warn(`Guide ${fileName} not found:`, error);
            return {
              id: fileName.replace(".txt", ""),
              title: title,
              description: "Гайд не найден или поврежден",
              image: "images/error.png",
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
          image: "images/error.png",
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
          image: "images/error.png",
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
        `data/seasons/${sanitizedSeason}/guides/${sanitizedGuide}.txt`,
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
