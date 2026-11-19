import { parseEconomicCurveBlock, ParsedEconomicCurve } from "./economicCurveData";

const SERIES_COLORS = ["#dc2626", "#7c3aed", "#ea580c", "#db2777", "#0891b2", "#16a34a", "#2563eb", "#a16207"];

function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function tickValues(min: number, max: number, count = 6): number[] {
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

function fmt(n: number): string {
  return Number(n.toFixed(4)).toString();
}

export function buildEconomicCurveSvg(data: ParsedEconomicCurve, width = 1350, height = 700): string | null {
  if (!data.valid || data.series.length === 0) return null;
  const left = 115, right = 210, top = 78, bottom = 105;
  const plotW = width - left - right, plotH = height - top - bottom;
  const xMin = data.xAxis.min!, xMax = data.xAxis.max!;
  const yMin = data.yAxis.min!, yMax = data.yAxis.max!;
  if (!(xMax > xMin && yMax > yMin)) return null;

  const X = (x: number) => left + ((x - xMin) / (xMax - xMin)) * plotW;
  const Y = (y: number) => top + plotH - ((y - yMin) / (yMax - yMin)) * plotH;
  const xTicks = tickValues(xMin, xMax);
  const yTicks = tickValues(yMin, yMax);
  const out: string[] = [];

  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  out.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff"/>`);
  out.push(`<text x="${width / 2}" y="35" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#111827">${xmlEscape(data.title)}</text>`);

  for (const t of xTicks) {
    const x = X(t);
    out.push(`<line x1="${fmt(x)}" y1="${top}" x2="${fmt(x)}" y2="${top + plotH}" stroke="#e5e7eb" stroke-width="1"/>`);
    out.push(`<text x="${fmt(x)}" y="${top + plotH + 27}" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" fill="#374151">${fmt(t)}</text>`);
  }
  for (const t of yTicks) {
    const y = Y(t);
    out.push(`<line x1="${left}" y1="${fmt(y)}" x2="${left + plotW}" y2="${fmt(y)}" stroke="#e5e7eb" stroke-width="1"/>`);
    out.push(`<text x="${left - 14}" y="${fmt(y + 5)}" text-anchor="end" font-family="Arial, sans-serif" font-size="13" fill="#374151">${fmt(t)}</text>`);
  }

  if (data.zeroLine && yMin <= 0 && yMax >= 0) {
    const y0 = Y(0);
    out.push(`<line x1="${left}" y1="${fmt(y0)}" x2="${left + plotW}" y2="${fmt(y0)}" stroke="#111827" stroke-width="2"/>`);
  }

  out.push(`<rect x="${left}" y="${top}" width="${plotW}" height="${plotH}" fill="none" stroke="#111827" stroke-width="1.5"/>`);

  data.series.forEach((s, index) => {
    const color = SERIES_COLORS[index % SERIES_COLORS.length];
    const points = s.points.map(p => `${fmt(X(p.x))},${fmt(Y(p.y))}`).join(" ");
    out.push(`<polyline points="${points}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`);
    s.points.forEach(p => out.push(`<circle cx="${fmt(X(p.x))}" cy="${fmt(Y(p.y))}" r="3.2" fill="${color}"/>`));
    const legendY = top + 22 + index * 25;
    out.push(`<line x1="${left + plotW + 25}" y1="${legendY}" x2="${left + plotW + 55}" y2="${legendY}" stroke="${color}" stroke-width="3"/>`);
    out.push(`<text x="${left + plotW + 64}" y="${legendY + 5}" font-family="Arial, sans-serif" font-size="13" fill="#111827">${xmlEscape(s.label)}</text>`);
  });

  data.intersections.forEach(p => {
    if (p.x < xMin || p.x > xMax || p.y < yMin || p.y > yMax) return;
    const x = X(p.x), y = Y(p.y);
    out.push(`<circle cx="${fmt(x)}" cy="${fmt(y)}" r="6" fill="#ffffff" stroke="#111827" stroke-width="2"/>`);
    out.push(`<text x="${fmt(x + 9)}" y="${fmt(y - 9)}" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#111827">${xmlEscape(p.label)}</text>`);
  });

  out.push(`<text x="${left + plotW / 2}" y="${height - 35}" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#111827">${xmlEscape(data.xAxis.label)}${data.xAxis.unit ? " (" + xmlEscape(data.xAxis.unit) + ")" : ""}</text>`);
  out.push(`<text x="28" y="${top + plotH / 2}" transform="rotate(-90 28 ${top + plotH / 2})" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#111827">${xmlEscape(data.yAxis.label)}${data.yAxis.unit ? " (" + xmlEscape(data.yAxis.unit) + ")" : ""}</text>`);
  out.push(`<text x="${width / 2}" y="${height - 8}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#6b7280">${xmlEscape(data.caption)}</text>`);
  out.push(`</svg>`);
  return out.join("");
}

export function generateEconomicCurveSvg(content: string): string | null {
  const parsed = parseEconomicCurveBlock(content);
  return buildEconomicCurveSvg(parsed);
}
