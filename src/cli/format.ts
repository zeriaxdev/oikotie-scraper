const ESC = "\x1b[";

export const c = {
  reset: `${ESC}0m`,
  bold: `${ESC}1m`,
  dim: `${ESC}2m`,
  italic: `${ESC}3m`,
  underline: `${ESC}4m`,
  red: `${ESC}31m`,
  green: `${ESC}32m`,
  yellow: `${ESC}33m`,
  blue: `${ESC}34m`,
  magenta: `${ESC}35m`,
  cyan: `${ESC}36m`,
  white: `${ESC}37m`,
  gray: `${ESC}90m`,
  bgBlue: `${ESC}44m`,
  bgGreen: `${ESC}42m`,
  bgYellow: `${ESC}43m`,
  bgRed: `${ESC}41m`,
};

export function bold(s: string) { return `${c.bold}${s}${c.reset}`; }
export function dim(s: string) { return `${c.dim}${s}${c.reset}`; }
export function green(s: string) { return `${c.green}${s}${c.reset}`; }
export function red(s: string) { return `${c.red}${s}${c.reset}`; }
export function yellow(s: string) { return `${c.yellow}${s}${c.reset}`; }
export function blue(s: string) { return `${c.blue}${s}${c.reset}`; }
export function cyan(s: string) { return `${c.cyan}${s}${c.reset}`; }
export function magenta(s: string) { return `${c.magenta}${s}${c.reset}`; }
export function gray(s: string) { return `${c.gray}${s}${c.reset}`; }

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function visibleLength(s: string): number {
  return stripAnsi(s).length;
}

function padEnd(s: string, len: number): string {
  const visible = visibleLength(s);
  return visible >= len ? s : s + " ".repeat(len - visible);
}

function padStart(s: string, len: number): string {
  const visible = visibleLength(s);
  return visible >= len ? s : " ".repeat(len - visible) + s;
}

export type Column = {
  key: string;
  label: string;
  width?: number;
  align?: "left" | "right";
  format?: (val: unknown, row: Record<string, unknown>) => string;
};

export function table(rows: Record<string, unknown>[], columns: Column[]): string {
  if (rows.length === 0) return dim("  No results.");

  const cols = columns.map((col) => {
    const maxContent = rows.reduce((max, row) => {
      const formatted = col.format
        ? col.format(row[col.key], row)
        : String(row[col.key] ?? "");
      return Math.max(max, visibleLength(formatted));
    }, visibleLength(col.label));
    return { ...col, width: col.width ?? Math.min(maxContent, 40) };
  });

  const sep = dim("─".repeat(cols.reduce((s, c) => s + c.width + 3, 1)));

  const header = cols
    .map((col) => ` ${padEnd(bold(col.label), col.width)} `)
    .join(dim("│"));

  const lines = [sep, dim("│") + header + dim("│"), sep];

  for (const row of rows) {
    const cells = cols.map((col) => {
      const raw = col.format ? col.format(row[col.key], row) : String(row[col.key] ?? "");
      const aligned = col.align === "right" ? padStart(raw, col.width) : padEnd(raw, col.width);
      return ` ${aligned} `;
    });
    lines.push(dim("│") + cells.join(dim("│")) + dim("│"));
  }

  lines.push(sep);
  return lines.join("\n");
}

export function badge(text: string, color: string): string {
  return `${color}${c.bold} ${text} ${c.reset}`;
}

export function heading(text: string): string {
  return `\n${c.bold}${c.cyan}${text}${c.reset}\n`;
}

export function kv(key: string, value: string | number | null | undefined): string {
  return `  ${dim(key + ":")} ${value ?? dim("—")}`;
}

export function money(n: number | null | undefined): string {
  if (n == null) return dim("—");
  return `${n.toLocaleString("fi-FI")} €`;
}

export function pct(n: number | null | undefined): string {
  if (n == null) return dim("—");
  const color = n > 0 ? green : n < 0 ? red : yellow;
  const sign = n > 0 ? "+" : "";
  return color(`${sign}${n.toFixed(1)}%`);
}

export function m2(n: number | null | undefined): string {
  if (n == null) return dim("—");
  return `${n} m²`;
}

export function truncate(s: string | null | undefined, len: number): string {
  if (!s) return "";
  return s.length > len ? s.slice(0, len - 1) + "…" : s;
}
