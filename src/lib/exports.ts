/** CSV/Excel export helpers. Files open cleanly in Excel with Persian text (UTF-8 BOM). */

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null)[][],
) {
  const body = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const v = String(cell ?? "");
          return /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(","),
    )
    .join("\r\n");
  const blob = new Blob(["\uFEFF" + body], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
