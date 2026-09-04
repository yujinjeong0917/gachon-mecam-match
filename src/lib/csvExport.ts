interface CsvColumn<T> {
  key: keyof T;
  label: string;
}

function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join(", ") : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => toCsvCell(c.label)).join(",");
  const body = rows.map((row) => columns.map((c) => toCsvCell(row[c.key])).join(","));
  // 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM을 붙인다.
  return "﻿" + [header, ...body].join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
