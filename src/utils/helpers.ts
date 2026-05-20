import { Cliente, Pago } from "../types";

// Labels helper
export const FREQ_LABELS = {
  mensual: "Mensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual"
};

// Parse 'YYYY-MM-DD' into a local Date object safely
export function parseDate(s: string): Date {
  if (!s) return new Date();
  const [y, m, d] = s.split("-").map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return new Date();
  return new Date(y, m - 1, d);
}

// Format date into human-readable Spanish locale (e.g. '20 May 2026')
export function fmtDate(s?: string): string {
  if (!s) return "—";
  try {
    const d = parseDate(s);
    return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  } catch (e) {
    return s;
  }
}

// Today string in 'YYYY-MM-DD' format
export function todayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

// Convert Date object to 'YYYY-MM-DD'
export function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Difference in days between a target date and today
export function diffDays(ds: string): number {
  if (!ds) return 9999;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const d = parseDate(ds);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 864e5);
}

// Get the final discounted amount for a client
export function montoFinal(c: Pick<Cliente, "monto" | "descuento">): number {
  return Math.round(c.monto * (1 - (c.descuento || 0) / 100));
}

// Add frequency period to a date
export function addPeriodo(fecha: string, freq: "mensual" | "trimestral" | "semestral" | "anual"): string {
  const d = parseDate(fecha);
  const map = {
    mensual: [0, 1],
    trimestral: [0, 3],
    semestral: [0, 6],
    anual: [1, 0]
  };
  const [addY, addM] = map[freq] || map.mensual;
  d.setFullYear(d.getFullYear() + addY, d.getMonth() + addM, d.getDate());
  return dateStr(d);
}

// Get period coverage start and end
export function periodoCubierto(desde: string, freq: "mensual" | "trimestral" | "semestral" | "anual") {
  const hasta = parseDate(addPeriodo(desde, freq));
  hasta.setDate(hasta.getDate() - 1);
  return { desde, hasta: dateStr(hasta) };
}

// Parse CSV manually with multi-line quote and custom separator support
export function parseCSVRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  text = text.replace(/^\uFEFF/, "");
  
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
  
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      row.push(cell.trim());
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell.trim());
      if (row.some(v => v !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some(v => v !== "")) rows.push(row);
  return rows;
}

// Normalize imported date format to YYYY-MM-DD
export function normalizeImportDate(value: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const datePart = raw.split(/\s+/)[0];
  let m = datePart.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = datePart.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return raw;
}

// Strip money currency formatting
export function normalizeMoney(value: string): number {
  return Number(String(value || "").replace(/[$,\s]/g, "")) || 0;
}
