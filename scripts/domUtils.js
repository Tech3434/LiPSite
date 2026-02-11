// domUtils.js
import { sanitizeHTML } from "./utils.js";

export const parseMarkdownToHTML = (text, textColor = null) => {
  if (!text) return "";

  // Шаг 1: Предварительная обработка - находим и заменяем ВСЕ специальные блоки
  const processedData = preprocessMultilineBlocks(text);
  let processedText = processedData.text;
  const blockMap = processedData.blocks;

  // Шаг 2: Обычный парсинг Markdown
  const lines = processedText.split("\n");
  let result = [];

  const colorStyle = textColor ? ` style="color: ${textColor}"` : "";
  const textStyle = textColor ? ` style="color: ${textColor}"` : "";

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      result.push("<br>");
      continue;
    }

    // Разделители
    if (trimmedLine.startsWith("-----")) {
      result.push('<hr class="full-divider my-6">');
      continue;
    } else if (trimmedLine.startsWith("---")) {
      result.push('<hr class="partial-divider my-6 mx-16">');
      continue;
    }

    // Заголовки
    if (trimmedLine.startsWith("# ")) {
      result.push(
        `<h4 class="text-4xl font-bold mt-8 mb-4"${colorStyle}>${trimmedLine.substring("# ".length)}</h4>`,
      );
    } else if (trimmedLine.startsWith("## ")) {
      result.push(
        `<h5 class="text-3xl font-bold mt-6 mb-3"${colorStyle}>${trimmedLine.substring("## ".length)}</h5>`,
      );
    } else if (trimmedLine.startsWith("### ")) {
      result.push(
        `<h6 class="text-2xl font-bold mt-4 mb-2"${colorStyle}>${trimmedLine.substring("### ".length)}</h6>`,
      );
    }
    // Субтекст
    else if (trimmedLine.startsWith("-# ")) {
      result.push(
        `<p class="text-sm opacity-75 mt-2 mb-3 italic"${colorStyle}>${trimmedLine.substring(3)}</p>`,
      );
    }
    // Списки
    else if (trimmedLine.startsWith("– ")) {
      let listItems = [trimmedLine.substring(2)];
      let j = i + 1;
      while (j < lines.length && lines[j].trim().startsWith("– ")) {
        listItems.push(lines[j].trim().substring(2));
        j++;
      }
      i = j - 1;

      const listHTML = listItems
        .map(
          (item) =>
            `<li class="mb-1 pl-2"${textStyle}>${processInlineMarkdown(item)}</li>`,
        )
        .join("");

      result.push(`<ul class="list-disc pl-6 mb-4">${listHTML}</ul>`);
    }
    // Обычный текст
    else {
      // Восстанавливаем блоки из карты
      line = restoreProcessedBlocks(line, blockMap);

      // Обрабатываем обычные ссылки и форматирование
      line = processInlineMarkdown(line);

      // Если после восстановления блоков строка не пустая
      if (line.trim()) {
        result.push(`<p class="my-2"${textStyle}>${line}</p>`);
      }
    }
  }

  // Шаг 3: Объединяем результат
  let html = result.join("\n");

  // Шаг 4: Обрабатываем спойлеры
  html = html.replace(/\|\|(.+?)\|\|/g, (match, content) => {
    const processedContent = processInlineFormatting(content);
    return `<span class="spoiler bg-gray-800 text-gray-800 hover:text-gray-100 px-1 rounded cursor-pointer transition-colors duration-200" onclick="this.classList.toggle('revealed')">${processedContent}</span>`;
  });

  return html;
};

// Обработка inline маркдауна для обычного текста (ссылки и форматирование)
const processInlineMarkdown = (text) => {
  if (!text) return "";

  let result = text;

  // Сначала обрабатываем обычные ссылки [текст](url)
  // Важно: не обрабатываем маркдаун внутри URL
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (match, linkText, linkUrl) => {
      // Обрабатываем форматирование в тексте ссылки, но не в URL
      const processedLinkText = processInlineFormatting(linkText);
      // URL используем как есть, без обработки
      return `<a href="${linkUrl}" class="link-masked text-link hover:text-link-hover visited:text-link-visited underline" target="_blank" rel="noopener noreferrer">${processedLinkText}</a>`;
    },
  );

  // Затем обрабатываем остальное форматирование
  result = processInlineFormatting(result);

  return result;
};

// Предварительная обработка многострочных блоков
const preprocessMultilineBlocks = (text) => {
  const blocks = {};
  let blockIndex = 0;
  let result = "";
  let i = 0;

  const isSpecialChar = (char) => ["#", "$", "%", "?"].includes(char);

  while (i < text.length) {
    // Ищем начало специального блока
    if (text[i] === "[" && i + 1 < text.length && isSpecialChar(text[i + 1])) {
      const start = i;
      const type = text[i + 1];
      i += 2; // Пропускаем "[x"

      let content = "";
      let url = "";
      let bracketDepth = 0;
      let parenDepth = 0;
      let inUrl = false;
      let foundUrlEnd = false;

      // Собираем содержимое блока
      while (i < text.length && !foundUrlEnd) {
        const char = text[i];

        if (!inUrl) {
          // Если нашли ']' на верхнем уровне вложенности
          if (char === "]" && bracketDepth === 0) {
            i++; // Пропускаем ']'
            // Теперь ищем '(' для URL
            while (i < text.length && text[i] !== "(" && text[i] !== "\n") {
              i++;
            }
            if (text[i] === "(") {
              i++; // Пропускаем '('
              inUrl = true;
              continue;
            } else {
              // Нет URL, заканчиваем
              foundUrlEnd = true;
              break;
            }
          }

          // Учитываем вложенные скобки
          if (char === "[") bracketDepth++;
          if (char === "]") bracketDepth--;

          content += char;
          i++;
        } else {
          // Собираем URL (без обработки маркдауна внутри)
          if (char === ")" && parenDepth === 0) {
            // URL завершен
            foundUrlEnd = true;
            i++; // Пропускаем ')'
            break;
          }

          // Учитываем вложенные скобки в URL (но не обрабатываем маркдаун)
          if (char === "(") parenDepth++;
          if (char === ")") parenDepth--;

          url += char;
          i++;
        }
      }

      const blockId = `__BLOCK_${blockIndex}__`;
      blockIndex++;

      // Сохраняем блок
      blocks[blockId] = {
        type: type,
        content: content,
        url: url,
      };

      // Заменяем блок на маркер
      result += blockId;
    } else {
      // Просто добавляем символ
      result += text[i];
      i++;
    }
  }

  return { text: result, blocks: blocks };
};

// Восстановление обработанных блоков
const restoreProcessedBlocks = (text, blockMap) => {
  let result = text;

  for (const [blockId, blockData] of Object.entries(blockMap)) {
    if (result.includes(blockId)) {
      const replacement = createSpecialBlockHTML(
        blockData.type,
        blockData.content,
        blockData.url,
      );
      // Простая замена
      result = result.replace(blockId, replacement);
    }
  }

  return result;
};

// Вспомогательная функция для обработки многострочного текста с форматированием
const processMultilineText = (text) => {
  if (!text) return "";

  // Разделяем на строки, обрабатываем каждую, но сохраняем пустые строки
  const lines = text.split("\n");
  const processedLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const processedLine = processInlineFormatting(line);

    if (i < lines.length - 1) {
      // Добавляем <br> после каждой строки, кроме последней
      processedLines.push(processedLine + "<br>");
    } else {
      processedLines.push(processedLine);
    }
  }

  return processedLines.join("");
};

// Обработка маркдауна внутри collapsible секций
const processMarkdownInCollapsible = (text) => {
  if (!text) return "";

  // Шаг 1: Предварительная обработка специальных блоков внутри collapsible
  const processedData = preprocessMultilineBlocks(text);
  let processedText = processedData.text;
  const blockMap = processedData.blocks;

  // Шаг 2: Разделяем на строки
  const lines = processedText.split("\n");
  let result = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      result.push("<br>");
      continue;
    }

    // Восстанавливаем специальные блоки
    line = restoreProcessedBlocks(line, blockMap);

    // Обрабатываем обычные ссылки [текст](url)
    line = line.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (match, linkText, linkUrl) => {
        // Обрабатываем форматирование в тексте ссылки, но не в URL
        const processedLinkText = processInlineFormatting(linkText);
        // URL используем как есть, без обработки
        return `<a href="${linkUrl}" class="link-masked text-link hover:text-link-hover visited:text-link-visited underline" target="_blank" rel="noopener noreferrer">${processedLinkText}</a>`;
      },
    );

    // Обрабатываем inline форматирование
    line = processInlineFormatting(line);

    // Обрабатываем спойлеры
    line = line.replace(/\|\|(.+?)\|\|/g, (match, content) => {
      const processedContent = processInlineFormatting(content);
      return `<span class="spoiler bg-gray-800 text-gray-800 hover:text-gray-100 px-1 rounded cursor-pointer transition-colors duration-200" onclick="this.classList.toggle('revealed')">${processedContent}</span>`;
    });

    result.push(line);

    // Добавляем <br> для переносов строк
    if (i < lines.length - 1) {
      result.push("<br>");
    }
  }

  return result.join("");
};

// Создание HTML для специальных блоков
const createSpecialBlockHTML = (type, content, url) => {
  // Обрабатываем содержимое блока (content) с форматированием
  const processedContent = processMultilineText(content);

  // Для URL не применяем обработку маркдауна - используем как есть
  const processedUrl = url; // Изменено: не вызываем processMultilineText для URL

  switch (type) {
    case "#": // Collapsible
      const collapsibleId = `collapsible-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Для заголовка collapsible обрабатываем форматирование
      const collapsibleTitle = content
        ? processInlineFormatting(content.replace(/\n/g, " "))
        : "";

      // ВАЖНО: для содержимого collapsible обрабатываем маркдаун полностью
      const collapsibleContent = processMarkdownInCollapsible(processedUrl);

      return `<div class="collapsible-inline my-3 inline-block w-full" data-collapsible-id="${collapsibleId}">
<button type="button" 
        class="collapsible-toggle-inline text-left py-1 px-2 bg-transparent hover:bg-gray-800/30 rounded transition-all duration-300 flex items-center justify-between group w-full"
        data-collapsible-target="${collapsibleId}">
  <span class="flex-1 mr-2">${collapsibleTitle}</span>
  <svg class="collapsible-arrow-inline w-4 h-4 transition-transform duration-300 text-gray-400 group-hover:text-gray-300 flex-shrink-0" 
       fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
  </svg>
</button>
<div id="${collapsibleId}" class="collapsible-content-inline overflow-hidden transition-all duration-300 max-h-0">
  <div class="px-3 py-2 bg-gray-900/50 rounded-b mt-1 border-l-2 border-gray-600 ml-2">
    ${collapsibleContent}
  </div>
</div>
</div>`;

    case "%": // Изображение
      const imageExtensions = [
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".webp",
        ".svg",
      ];
      const isImage = imageExtensions.some((ext) =>
        url.toLowerCase().endsWith(ext),
      );

      if (isImage) {
        // Берем первую непустую строку как alt текст
        const altLines = content
          ? content.split("\n").filter((line) => line.trim())
          : [];
        const altText =
          altLines.length > 0
            ? processInlineFormatting(altLines[0].trim())
            : "Изображение";
        return `<div class="image-inline my-4 text-center">
<img src="${processedUrl}" alt="${altText}" class="mx-auto max-w-full h-auto rounded-lg shadow-lg" loading="lazy" onerror="this.style.display='none'; this.parentNode.querySelector('.image-error').style.display='block';">${processedContent ? `<p class="image-subtext text-sm opacity-75 mt-2 italic">${processedContent}</p>` : ""}<p class="image-error text-sm text-red-400 mt-2 italic" style="display: none;">Изображение не найдено: ${processedUrl}</p></div>`;
      } else {
        return `<span class="text-yellow-400">[Некорректный путь к изображению: ${processedUrl}]</span>`;
      }

    case "?": // Подсказка
      // Для подсказки текст должен быть plain text, без HTML
      const tooltipText = processedUrl ? processedUrl.replace(/\n/g, " ") : "";
      const escapedTooltip = tooltipText.replace(/"/g, "&quot;");
      return `<span class="hint-tooltip relative cursor-help border-b border-dashed border-gray-500" data-tooltip="${escapedTooltip}">${processedContent}</span>`;

    case "$": // Ссылка
      // Для ссылок URL используется как есть, без обработки маркдауна
      return `<a href="${processedUrl}" class="link-masked text-link hover:text-link-hover visited:text-link-visited underline" target="_blank" rel="noopener noreferrer">${processedContent}</a>`;

    default:
      return `[${type}${content}](${url})`;
  }
};

// Функция для обработки inline-форматирования
const processInlineFormatting = (text) => {
  if (!text) return "";

  let result = text;

  // Обработка форматирования текста в правильном порядке
  result = result.replace(/===(.+?)===/g, "<center>$1</center>");

  result = result.replace(/\^\^\^(.+?)\^\^\^/g, `<span style="font-size: var(--size-4xl)">$1</span>`);
  result = result.replace(/\^\^(.+?)\^\^/g, `<span style="font-size: var(--size-3xl)">$1</span>`);
  result = result.replace(/\^(.+?)\^/g, `<span style="font-size: var(--size-2xl)">$1</span>`);

  result = result.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");

  result = result.replace(/__(.+?)__/g, "<u>$1</u>");

  result = result.replace(/~~(.+?)~~/g, "<s>$1</s>");

  return result;
};;

// Глобальные функции для работы collapsible sections
window.toggleInlineCollapsible = function (id) {
  const content = document.getElementById(id);
  if (!content) {
    console.warn(`Collapsible element with id "${id}" not found`);
    return;
  }

  const collapsible = content.closest(".collapsible-inline");
  const button = collapsible
    ? collapsible.querySelector(".collapsible-toggle-inline")
    : content.previousElementSibling;
  const arrow = button
    ? button.querySelector(".collapsible-arrow-inline")
    : null;

  if (content.style.maxHeight && content.style.maxHeight !== "0px") {
    // Закрываем
    content.style.maxHeight = "0";
    content.style.marginTop = "0";
    content.style.marginBottom = "0";
    if (arrow) arrow.style.transform = "rotate(0deg)";
    if (button) button.classList.remove("collapsible-active");
  } else {
    // Открываем
    content.style.maxHeight = content.scrollHeight + "px";
    content.style.marginTop = "0.25rem";
    content.style.marginBottom = "0.25rem";
    if (arrow) arrow.style.transform = "rotate(180deg)";
    if (button) button.classList.add("collapsible-active");
  }
};

// Функция для инициализации всех collapsible sections
export const initCollapsibles = (container = document) => {
  // Удаляем старые обработчики, если есть
  const buttons = container.querySelectorAll(".collapsible-toggle-inline");
  buttons.forEach((button) => {
    // Создаем новый обработчик
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
  });

  // Добавляем новые обработчики
  container.querySelectorAll(".collapsible-toggle-inline").forEach((button) => {
    const targetId =
      button.getAttribute("data-collapsible-target") ||
      button
        .closest(".collapsible-inline")
        ?.getAttribute("data-collapsible-id");

    if (targetId) {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.toggleInlineCollapsible(targetId);
      });

      // Удаляем inline onclick, если он есть
      button.removeAttribute("onclick");
    }
  });
};

export const createElement = (tag, options = {}) => {
  const element = document.createElement(tag);

  if (options.classes) {
    element.className = options.classes;
  }

  if (options.text) {
    element.textContent = options.text;
  }

  if (options.html) {
    element.innerHTML = sanitizeHTML(options.html);
    // Если есть коллабсибл секции, инициализируем их
    if (options.html.includes("collapsible-inline")) {
      setTimeout(() => initCollapsibles(element), 10);
    }
  }

  if (options.attributes) {
    Object.entries(options.attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  }

  if (options.dataset) {
    Object.entries(options.dataset).forEach(([key, value]) => {
      element.dataset[key] = value;
    });
  }

  if (options.listeners) {
    Object.entries(options.listeners).forEach(([event, handler]) => {
      element.addEventListener(event, handler);
    });
  }

  return element;
};

export const fadeElement = (
  element,
  direction = "out",
  duration = 300,
  easing = "cubic-bezier(0.4, 0, 0.2, 1)",
) => {
  return new Promise((resolve) => {
    element.style.transition = `opacity ${duration}ms ${easing}, transform ${duration}ms ${easing}`;

    if (direction === "out") {
      element.style.opacity = "0";
      element.style.transform = "translateY(-10px) scale(0.98)";
    } else {
      element.style.opacity = "1";
      element.style.transform = "translateY(0) scale(1)";
    }

    setTimeout(() => {
      // Сбрасываем transform после анимации
      if (direction === "in") {
        element.style.transform = "";
      }
      resolve();
    }, duration);
  });
};

// Инициализация подсказок при загрузке
let tooltipInstance = null;
let tooltipTimeout = null;

document.addEventListener("DOMContentLoaded", function () {
  // Делегирование событий для подсказок
  document.addEventListener("mouseover", function (e) {
    const tooltip = e.target.closest(".hint-tooltip");
    if (tooltip && !tooltipInstance) {
      clearTimeout(tooltipTimeout);
      tooltipTimeout = setTimeout(() => {
        showTooltip(tooltip, e.clientX, e.clientY);
      }, 200);
    }
  });

  document.addEventListener("mouseout", function (e) {
    const tooltip = e.target.closest(".hint-tooltip");
    if (tooltip) {
      clearTimeout(tooltipTimeout);
      hideTooltip();
    }
  });

  document.addEventListener("mousemove", function (e) {
    if (tooltipInstance) {
      updateTooltipPosition(e.clientX, e.clientY);
    }
  });

  // Инициализация collapsible sections
  initCollapsibles();

  // Также добавляем глобальный обработчик для делегирования событий
  document.addEventListener("click", function (e) {
    const collapsibleBtn = e.target.closest(".collapsible-toggle-inline");
    if (collapsibleBtn) {
      e.preventDefault();
      e.stopPropagation();

      const targetId =
        collapsibleBtn.getAttribute("data-collapsible-target") ||
        collapsibleBtn
          .closest(".collapsible-inline")
          ?.getAttribute("data-collapsible-id");

      if (targetId) {
        window.toggleInlineCollapsible(targetId);
      }
    }
  });
});

function showTooltip(element, x, y) {
  hideTooltip();

  const tooltipText = element.getAttribute("data-tooltip");
  if (!tooltipText) return;

  tooltipInstance = document.createElement("div");
  tooltipInstance.className =
    "tooltip-popup fixed z-50 px-3 py-2 text-sm bg-gray-900 border border-gray-700 rounded-lg shadow-lg max-w-xs pointer-events-none";

  // Для текста подсказки заменяем <br> на реальные переносы строк
  const formattedText = tooltipText.replace(/<br>/g, "\n");
  tooltipInstance.textContent = formattedText;

  tooltipInstance.style.opacity = "0";
  tooltipInstance.style.transform = "translate(-50%, -100%)";
  tooltipInstance.style.transition = "opacity 0.2s ease";
  tooltipInstance.style.whiteSpace = "pre-line"; // Это важно для отображения переносов строк

  document.body.appendChild(tooltipInstance);

  // Устанавливаем позицию
  updateTooltipPosition(x, y);

  // Показываем с анимацией
  setTimeout(() => {
    tooltipInstance.style.opacity = "1";
  }, 10);
}

function updateTooltipPosition(x, y) {
  if (!tooltipInstance) return;

  const rect = tooltipInstance.getBoundingClientRect();
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  let left = x;
  let top = y - 10;

  // Проверяем, чтобы тултип не выходил за границы окна
  if (left - rect.width / 2 < 10) {
    left = rect.width / 2 + 10;
  } else if (left + rect.width / 2 > windowWidth - 10) {
    left = windowWidth - rect.width / 2 - 10;
  }

  if (top - rect.height < 10) {
    top = y + 20;
    tooltipInstance.style.transform = "translate(-50%, 0)";
  } else {
    tooltipInstance.style.transform = "translate(-50%, -100%)";
  }

  tooltipInstance.style.left = left + "px";
  tooltipInstance.style.top = top + "px";
}

function hideTooltip() {
  if (tooltipInstance) {
    tooltipInstance.style.opacity = "0";
    setTimeout(() => {
      if (tooltipInstance && tooltipInstance.parentNode) {
        tooltipInstance.parentNode.removeChild(tooltipInstance);
      }
      tooltipInstance = null;
    }, 200);
  }
}
