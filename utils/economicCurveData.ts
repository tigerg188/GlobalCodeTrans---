/**
 * Data-driven parser for GlobalCodeTrans chart:economic / chart:curve blocks.
 *
 * Important:
 * - Never invent data points.
 * - Never substitute demo curves when input data is missing.
 * - Preserve the source order of points.
 * - Axis bounds are honored when valid; missing bounds are derived from actual points.
 */

export type CurvePoint = { x: number; y: number };

export interface CurveSeries {
  id: string;
  label: string;
  points: CurvePoint[];
}

export interface CurveIntersection {
  label: string;
  x: number;
  y: number;
  note?: string;
}

export interface CurveAxis {
  label: string;
  unit?: string;
  min?: number;
  max?: number;
}

export interface ParsedEconomicCurve {
  valid: boolean;
  title: string;
  caption: string;
  xAxis: CurveAxis;
  yAxis: CurveAxis;
  zeroLine: boolean;
  series: CurveSeries[];
  intersections: CurveIntersection[];
  errors: string[];
  warnings: string[];
}

const DEFAULT_TITLE = "工程曲线图";
const DEFAULT_CAPTION = "曲线数据依据输入内容绘制";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readScalar(lines: string[], key: string, fallback: string): string {
  const prefix = new RegExp("^\\s*" + escapeRegExp(key) + "\\s*:\\s*(.*?)\\s*$", "i");
  for (const line of lines) {
    const match = line.match(prefix);
    if (match) return match[1].replace(/^["']|["']$/g, "").trim() || fallback;
  }
  return fallback;
}

function parseAxis(lines: string[], key: string): CurveAxis {
  const line = lines.find(v => new RegExp("^\\s*" + escapeRegExp(key) + "\\s*:", "i").test(v));
  if (!line) return { label: key };
  const raw = line.slice(line.indexOf(":") + 1).trim();
  const rangeMatch = raw.match(/\[\s*(-?\d+(?:\.\d+)?)\s*(?:到|至|to|,)\s*(-?\d+(?:\.\d+)?)\s*\]/i);
  const beforeRange = rangeMatch ? raw.slice(0, rangeMatch.index).trim() : raw;
  const labelParts = beforeRange.split(",").map(s => s.trim()).filter(Boolean);
  const label = labelParts[0] || key;
  const unit = labelParts.length > 1 ? labelParts.slice(1).join(", ") : undefined;
  const min = rangeMatch ? Number(rangeMatch[1]) : undefined;
  const max = rangeMatch ? Number(rangeMatch[2]) : undefined;
  return { label, unit, min, max };
}

function extractPointPairs(raw: string): CurvePoint[] {
  const points: CurvePoint[] = [];
  const pairPattern = /\[\s*(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*,\s*(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*\]/gi;
  let match: RegExpExecArray | null;
  while ((match = pairPattern.exec(raw)) !== null) {
    const x = Number(match[1]);
    const y = Number(match[2]);
    if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
  }
  return points;
}

function collectListEntries(lines: string[], sectionName: string): Array<{ key: string; raw: string }> {
  const start = lines.findIndex(line => new RegExp("^\\s*" + escapeRegExp(sectionName) + "\\s*:\\s*$", "i").test(line));
  if (start < 0) return [];
  const entries: Array<{ key: string; raw: string }> = [];
  let current: { key: string; raw: string } | null = null;
  let depth = 0;

  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*[A-Za-z][A-Za-z0-9_-]*\s*:/.test(line) && !/^\s*-\s/.test(line) && depth <= 0) break;

    const itemMatch = line.match(/^\s*-\s*([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
    if (itemMatch) {
      if (current) entries.push(current);
      current = { key: itemMatch[1], raw: itemMatch[2] || "" };
      depth = (current.raw.match(/\[/g) || []).length - (current.raw.match(/\]/g) || []).length;
      continue;
    }

    if (current) {
      current.raw += " " + line.trim();
      depth += (line.match(/\[/g) || []).length - (line.match(/\]/g) || []).length;
      if (depth < 0) depth = 0;
    }
  }
  if (current) entries.push(current);
  return entries;
}

function deriveBounds(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 1 };
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    const pad = Math.abs(min) > 0 ? Math.abs(min) * 0.1 : 1;
    min -= pad;
    max += pad;
  } else {
    const pad = (max - min) * 0.04;
    min -= pad;
    max += pad;
  }
  return { min, max };
}

export function parseEconomicCurveBlock(content: string): ParsedEconomicCurve {
  const lines = (content || "").split(/\r?\n/);
  const errors: string[] = [];
  const warnings: string[] = [];
  const title = readScalar(lines, "title", DEFAULT_TITLE);
  const caption = readScalar(lines, "caption", DEFAULT_CAPTION);
  const xAxis = parseAxis(lines, "xAxis");
  const yAxis = parseAxis(lines, "yAxis");
  const zeroLine = /^\s*zeroLine\s*:\s*(?:true|yes|1)\s*$/im.test(content || "");

  const seriesEntries = collectListEntries(lines, "series");
  const series: CurveSeries[] = [];
  const seen = new Set<string>();

  for (const entry of seriesEntries) {
    const points = extractPointPairs(entry.raw);
    if (seen.has(entry.key)) {
      errors.push(`曲线系列标识重复：${entry.key}`);
      continue;
    }
    seen.add(entry.key);
    if (points.length < 2) {
      errors.push(`曲线系列 ${entry.key} 少于 2 个有效坐标点`);
      continue;
    }
    for (let i = 1; i < points.length; i++) {
      if (points[i].x < points[i - 1].x) {
        warnings.push(`曲线系列 ${entry.key} 的 X 坐标并非单调递增；已保留原始点序，不自动重排`);
        break;
      }
    }
    series.push({ id: entry.key, label: entry.key, points });
  }

  if (seriesEntries.length === 0) errors.push("缺少 series 数据段；拒绝生成示例曲线");
  if (series.length === 0) errors.push("没有可绘制的有效曲线系列");

  const intersectionEntries = collectListEntries(lines, "intersections");
  const intersections: CurveIntersection[] = [];
  for (const entry of intersectionEntries) {
    const match = entry.raw.match(/\[\s*(-?(?:\d+\.?\d*|\.\d+))\s*,\s*(-?(?:\d+\.?\d*|\.\d+))\s*\]/);
    if (!match) {
      warnings.push(`交点 ${entry.key} 缺少有效 [x, y] 坐标，已忽略`);
      continue;
    }
    const x = Number(match[1]);
    const y = Number(match[2]);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      const noteMatch = entry.raw.match(/\]\s*\((.*?)\)\s*$/);
      intersections.push({ label: entry.key, x, y, note: noteMatch?.[1] });
    }
  }

  const allX = series.flatMap(s => s.points.map(p => p.x));
  const allY = series.flatMap(s => s.points.map(p => p.y));
  const xBounds = deriveBounds(allX);
  const yBounds = deriveBounds(allY);

  if (xAxis.min !== undefined && xAxis.max !== undefined && xAxis.min >= xAxis.max) {
    errors.push("xAxis 范围无效：最小值必须小于最大值");
  }
  if (yAxis.min !== undefined && yAxis.max !== undefined && yAxis.min >= yAxis.max) {
    errors.push("yAxis 范围无效：最小值必须小于最大值");
  }

  if (xAxis.min === undefined) xAxis.min = xBounds.min;
  if (xAxis.max === undefined) xAxis.max = xBounds.max;
  if (yAxis.min === undefined) yAxis.min = yBounds.min;
  if (yAxis.max === undefined) yAxis.max = yBounds.max;

  for (const p of intersections) {
    if (p.x < xAxis.min! || p.x > xAxis.max! || p.y < yAxis.min! || p.y > yAxis.max!) {
      warnings.push(`交点 ${p.label} 超出坐标轴范围；请核对原始数据或坐标轴标定`);
    }
  }

  return {
    valid: errors.length === 0,
    title,
    caption,
    xAxis,
    yAxis,
    zeroLine,
    series,
    intersections,
    errors,
    warnings
  };
}
