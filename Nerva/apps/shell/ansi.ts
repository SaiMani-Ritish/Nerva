/**
 * ANSI escape codes for terminal styling
 */

// Control sequences
export const ESC = "\x1b";
export const CSI = `${ESC}[`;

// Cursor control
export const cursor = {
  hide: `${CSI}?25l`,
  show: `${CSI}?25h`,
  home: `${CSI}H`,
  moveTo: (row: number, col: number) => `${CSI}${row};${col}H`,
  moveUp: (n: number = 1) => `${CSI}${n}A`,
  moveDown: (n: number = 1) => `${CSI}${n}B`,
  moveRight: (n: number = 1) => `${CSI}${n}C`,
  moveLeft: (n: number = 1) => `${CSI}${n}D`,
  savePosition: `${CSI}s`,
  restorePosition: `${CSI}u`,
  column: (n: number) => `${CSI}${n}G`,
};

// Screen control
export const screen = {
  clear: `${CSI}2J`,
  clearLine: `${CSI}2K`,
  clearToEnd: `${CSI}0K`,
  clearToStart: `${CSI}1K`,
  clearDown: `${CSI}0J`,
  clearUp: `${CSI}1J`,
  scrollUp: (n: number = 1) => `${CSI}${n}S`,
  scrollDown: (n: number = 1) => `${CSI}${n}T`,
};

// Text styles
export const style = {
  reset: `${CSI}0m`,
  bold: `${CSI}1m`,
  dim: `${CSI}2m`,
  italic: `${CSI}3m`,
  underline: `${CSI}4m`,
  blink: `${CSI}5m`,
  inverse: `${CSI}7m`,
  hidden: `${CSI}8m`,
  strikethrough: `${CSI}9m`,
};

// Foreground colors
export const fg = {
  black: `${CSI}30m`,
  red: `${CSI}31m`,
  green: `${CSI}32m`,
  yellow: `${CSI}33m`,
  blue: `${CSI}34m`,
  magenta: `${CSI}35m`,
  cyan: `${CSI}36m`,
  white: `${CSI}37m`,
  default: `${CSI}39m`,
  // Bright colors
  brightBlack: `${CSI}90m`,
  brightRed: `${CSI}91m`,
  brightGreen: `${CSI}92m`,
  brightYellow: `${CSI}93m`,
  brightBlue: `${CSI}94m`,
  brightMagenta: `${CSI}95m`,
  brightCyan: `${CSI}96m`,
  brightWhite: `${CSI}97m`,
  // 256 color
  color: (n: number) => `${CSI}38;5;${n}m`,
  // RGB color
  rgb: (r: number, g: number, b: number) => `${CSI}38;2;${r};${g};${b}m`,
};

// Background colors
export const bg = {
  black: `${CSI}40m`,
  red: `${CSI}41m`,
  green: `${CSI}42m`,
  yellow: `${CSI}43m`,
  blue: `${CSI}44m`,
  magenta: `${CSI}45m`,
  cyan: `${CSI}46m`,
  white: `${CSI}47m`,
  default: `${CSI}49m`,
  // Bright colors
  brightBlack: `${CSI}100m`,
  brightRed: `${CSI}101m`,
  brightGreen: `${CSI}102m`,
  brightYellow: `${CSI}103m`,
  brightBlue: `${CSI}104m`,
  brightMagenta: `${CSI}105m`,
  brightCyan: `${CSI}106m`,
  brightWhite: `${CSI}107m`,
  // 256 color
  color: (n: number) => `${CSI}48;5;${n}m`,
  // RGB color
  rgb: (r: number, g: number, b: number) => `${CSI}48;2;${r};${g};${b}m`,
};

/**
 * Helper functions
 */

export function colorize(
  text: string,
  fgColor?: string,
  bgColor?: string,
  styles?: string[]
): string {
  let result = "";
  if (styles) {
    result += styles.join("");
  }
  if (bgColor) {
    result += bgColor;
  }
  if (fgColor) {
    result += fgColor;
  }
  result += text;
  result += style.reset;
  return result;
}

export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

export function textLength(text: string): number {
  return stripAnsi(text).length;
}

export function truncate(text: string, maxLength: number, ellipsis = "…"): string {
  const stripped = stripAnsi(text);
  if (stripped.length <= maxLength) {
    return text;
  }
  return stripped.substring(0, maxLength - ellipsis.length) + ellipsis;
}

export function padRight(text: string, width: number, char = " "): string {
  const len = textLength(text);
  if (len >= width) {
    return text;
  }
  return text + char.repeat(width - len);
}

export function padLeft(text: string, width: number, char = " "): string {
  const len = textLength(text);
  if (len >= width) {
    return text;
  }
  return char.repeat(width - len) + text;
}

export function center(text: string, width: number, char = " "): string {
  const len = textLength(text);
  if (len >= width) {
    return text;
  }
  const left = Math.floor((width - len) / 2);
  const right = width - len - left;
  return char.repeat(left) + text + char.repeat(right);
}

/**
 * Box drawing characters
 */
export const box = {
  // Light box
  topLeft: "┌",
  topRight: "┐",
  bottomLeft: "└",
  bottomRight: "┘",
  horizontal: "─",
  vertical: "│",
  // Heavy box
  heavyTopLeft: "┏",
  heavyTopRight: "┓",
  heavyBottomLeft: "┗",
  heavyBottomRight: "┛",
  heavyHorizontal: "━",
  heavyVertical: "┃",
  // Double box
  doubleTopLeft: "╔",
  doubleTopRight: "╗",
  doubleBottomLeft: "╚",
  doubleBottomRight: "╝",
  doubleHorizontal: "═",
  doubleVertical: "║",
  // Rounded box
  roundTopLeft: "╭",
  roundTopRight: "╮",
  roundBottomLeft: "╰",
  roundBottomRight: "╯",
};

/**
 * Draw a box around content
 */
export function drawBox(
  content: string[],
  width: number,
  title?: string,
  style: "light" | "heavy" | "double" | "round" = "round"
): string[] {
  const chars =
    style === "heavy"
      ? {
          tl: box.heavyTopLeft,
          tr: box.heavyTopRight,
          bl: box.heavyBottomLeft,
          br: box.heavyBottomRight,
          h: box.heavyHorizontal,
          v: box.heavyVertical,
        }
      : style === "double"
        ? {
            tl: box.doubleTopLeft,
            tr: box.doubleTopRight,
            bl: box.doubleBottomLeft,
            br: box.doubleBottomRight,
            h: box.doubleHorizontal,
            v: box.doubleVertical,
          }
        : style === "round"
          ? {
              tl: box.roundTopLeft,
              tr: box.roundTopRight,
              bl: box.roundBottomLeft,
              br: box.roundBottomRight,
              h: box.horizontal,
              v: box.vertical,
            }
          : {
              tl: box.topLeft,
              tr: box.topRight,
              bl: box.bottomLeft,
              br: box.bottomRight,
              h: box.horizontal,
              v: box.vertical,
            };

  const innerWidth = width - 2;
  const lines: string[] = [];

  // Top border
  if (title) {
    const titleText = ` ${title} `;
    const remaining = innerWidth - titleText.length;
    const leftPad = Math.floor(remaining / 2);
    const rightPad = remaining - leftPad;
    lines.push(
      chars.tl +
        chars.h.repeat(leftPad) +
        titleText +
        chars.h.repeat(rightPad) +
        chars.tr
    );
  } else {
    lines.push(chars.tl + chars.h.repeat(innerWidth) + chars.tr);
  }

  // Content lines
  for (const line of content) {
    const stripped = stripAnsi(line);
    const padding = innerWidth - stripped.length;
    lines.push(chars.v + line + " ".repeat(Math.max(0, padding)) + chars.v);
  }

  // Bottom border
  lines.push(chars.bl + chars.h.repeat(innerWidth) + chars.br);

  return lines;
}

