/**
 * Syntax normalizer for LLM-generated `chart:economic` / `chart:curve` blocks.
 *
 * Strictly converts valid nested YAML / xychart-beta output from multimodal LLMs
 * into the canonical line-oriented schema expected by `utils/economicCurveData.ts`,
 * WITHOUT modifying `economicCurveData.ts` and WITHOUT ever fabricating points or series.
 */

function stripLatexInline(text: string): string {
  return text
    .replace(/\$([^$]+)\$/g, (_, inner) =>
      inner
        .replace(/\\text\{([^}]*)\}/g, "$1")
        .replace(/_\{([^}]*)\}/g, "$1")
        .replace(/[\{\}\\]/g, "")
    )
    .trim();
}

function sanitizeKey(rawKey: string, fallbackIndex: number): string {
  const cleaned = stripLatexInline(rawKey)
    .replace(/^["']|["']$/g, "")
    .trim()
    .replace(/[^A-Za-z0-9_.-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || `series_${fallbackIndex + 1}`;
}

function parseMermaidXyChart(raw: string): string | null {
  const lines = raw.split(/\r?\n/);
  let title = "工程曲线图";
  let xLabel = "X";
  let yLabel = "Y";
  let xTicks: number[] = [];
  let yMin: number | undefined;
  let yMax: number | undefined;
  const lineSeries: number[][] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const titleMatch = trimmed.match(/^title\s+["']?(.+?)["']?$/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      continue;
    }
    const xArrMatch = trimmed.match(/^x-axis\s+(?:["']([^"']+)["']\s*)?\[([^\]]+)\]/i);
    if (xArrMatch) {
      if (xArrMatch[1]) xLabel = xArrMatch[1].trim();
      xTicks = xArrMatch[2]
        .split(",")
        .map(v => Number(v.trim()))
        .filter(n => Number.isFinite(n));
      continue;
    }
    const yRangeMatch = trimmed.match(/^y-axis\s+(?:["']([^"']+)["']\s*)?(-?\d+(?:\.\d+)?)\s*-->\s*(-?\d+(?:\.\d+)?)/i);
    if (yRangeMatch) {
      if (yRangeMatch[1]) yLabel = yRangeMatch[1].trim();
      yMin = Number(yRangeMatch[2]);
      yMax = Number(yRangeMatch[3]);
      continue;
    }
    const lineMatch = trimmed.match(/^line\s+\[([^\]]+)\]/i);
    if (lineMatch) {
      const nums = lineMatch[1]
        .split(",")
        .map(v => Number(v.trim()))
        .filter(n => Number.isFinite(n));
      if (nums.length > 0) lineSeries.push(nums);
    }
  }

  if (lineSeries.length === 0) return null;

  const out: string[] = [
    `title: ${title}`,
    `caption: ${title}`,
  ];
  if (xTicks.length >= 2) {
    out.push(`xAxis: ${xLabel} [${xTicks[0]} to ${xTicks[xTicks.length - 1]}]`);
  } else {
    out.push(`xAxis: ${xLabel}`);
  }
  if (yMin !== undefined && yMax !== undefined) {
    out.push(`yAxis: ${yLabel} [${yMin} to ${yMax}]`);
    if (yMin < 0 && yMax > 0) out.push(`zeroLine: true`);
  } else {
    out.push(`yAxis: ${yLabel}`);
  }
  out.push(`series:`);
  lineSeries.forEach((vals, idx) => {
    const pts = vals.map((y, i) => `[${i < xTicks.length ? xTicks[i] : i}, ${y}]`).join(", ");
    out.push(`  - line_${idx + 1}: [${pts}]`);
  });
  return out.join("\n");
}

export function normalizeEconomicCurveBlock(rawContent: string): string {
  const raw = (rawContent || "").trim();
  if (!raw) return "";

  if (/xychart-beta/i.test(raw)) {
    const converted = parseMermaidXyChart(raw);
    if (converted) return converted;
  }

  // Detect if block already conforms to canonical format without nested YAML objects
  const hasNestedAxis = /^\s*(?:xAxis|yAxis)\s*:\s*$/im.test(raw);
  const hasNestedSeriesItem = /^\s*-\s*(?:name|label|id)\s*:/im.test(raw);
  const hasPointsSection = /^\s*points\s*:\s*$/im.test(raw);
  const hasNonAsciiSeriesKey = /^\s*-\s*[^\x00-\x7F]+\s*:/m.test(raw) || /^\s*-\s*[A-Za-z0-9_.-]*[^\x00-\x7FA-Za-z0-9_.-]+[A-Za-z0-9_.\-\u4e00-\u9fa5]*\s*:/m.test(raw);

  if (!hasNestedAxis && !hasNestedSeriesItem && !hasPointsSection && !hasNonAsciiSeriesKey) {
    return rawContent;
  }

  const lines = raw.split(/\r?\n/);
  let title = "";
  let caption = "";
  let zeroLineExplicit: boolean | undefined;

  let xAxisLabel = "X";
  let xAxisRange: [number, number] | null = null;
  let yAxisLabel = "Y";
  let yAxisRange: [number, number] | null = null;

  interface TempSeries {
    key: string;
    pointsText: string;
  }
  interface TempIntersection {
    key: string;
    coordsText: string;
    note?: string;
  }

  const seriesList: TempSeries[] = [];
  const intersectionList: TempIntersection[] = [];

  type Section = "root" | "xAxis" | "yAxis" | "series" | "intersections";
  let section: Section = "root";
  let currentSeries: { name?: string; data?: string } | null = null;
  let currentPoint: { label?: string; coords?: string; note?: string } | null = null;

  const flushSeries = () => {
    if (!currentSeries) return;
    const key = sanitizeKey(currentSeries.name || "", seriesList.length);
    seriesList.push({
      key,
      pointsText: currentSeries.data || "[]",
    });
    currentSeries = null;
  };

  const flushPoint = () => {
    if (!currentPoint) return;
    if (currentPoint.label && currentPoint.coords) {
      intersectionList.push({
        key: sanitizeKey(currentPoint.label, intersectionList.length),
        coordsText: currentPoint.coords,
        note: currentPoint.note,
      });
    }
    currentPoint = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("```")) continue;

    // Top-level section headers (zero indentation)
    const indent = line.search(/\S/);
    if (indent === 0) {
      if (/^title\s*:/i.test(trimmed)) {
        flushSeries();
        flushPoint();
        section = "root";
        title = stripLatexInline(trimmed.slice(trimmed.indexOf(":") + 1)).replace(/^["']|["']$/g, "").trim();
        continue;
      }
      if (/^caption\s*:/i.test(trimmed)) {
        flushSeries();
        flushPoint();
        section = "root";
        caption = stripLatexInline(trimmed.slice(trimmed.indexOf(":") + 1)).replace(/^["']|["']$/g, "").trim();
        continue;
      }
      if (/^zeroLine\s*:/i.test(trimmed)) {
        flushSeries();
        flushPoint();
        section = "root";
        zeroLineExplicit = /^(?:true|yes|1)$/i.test(trimmed.slice(trimmed.indexOf(":") + 1).trim());
        continue;
      }
      if (/^xAxis\s*:/i.test(trimmed)) {
        flushSeries();
        flushPoint();
        section = "xAxis";
        const val = trimmed.slice(trimmed.indexOf(":") + 1).trim();
        if (val) {
          const r = val.match(/\[\s*(-?\d+(?:\.\d+)?)\s*(?:到|至|to|,)\s*(-?\d+(?:\.\d+)?)\s*\]/i);
          if (r) {
            xAxisRange = [Number(r[1]), Number(r[2])];
            xAxisLabel = stripLatexInline(val.slice(0, r.index)) || "X";
          } else {
            xAxisLabel = stripLatexInline(val) || "X";
          }
        }
        continue;
      }
      if (/^yAxis\s*:/i.test(trimmed)) {
        flushSeries();
        flushPoint();
        section = "yAxis";
        const val = trimmed.slice(trimmed.indexOf(":") + 1).trim();
        if (val) {
          const r = val.match(/\[\s*(-?\d+(?:\.\d+)?)\s*(?:到|至|to|,)\s*(-?\d+(?:\.\d+)?)\s*\]/i);
          if (r) {
            yAxisRange = [Number(r[1]), Number(r[2])];
            yAxisLabel = stripLatexInline(val.slice(0, r.index)) || "Y";
          } else {
            yAxisLabel = stripLatexInline(val) || "Y";
          }
        }
        continue;
      }
      if (/^series\s*:/i.test(trimmed)) {
        flushSeries();
        flushPoint();
        section = "series";
        continue;
      }
      if (/^(?:intersections|points|markers)\s*:/i.test(trimmed)) {
        flushSeries();
        flushPoint();
        section = "intersections";
        continue;
      }
    }

    if (section === "xAxis") {
      if (/^label\s*:/i.test(trimmed)) {
        xAxisLabel = stripLatexInline(trimmed.slice(trimmed.indexOf(":") + 1)).replace(/^["']|["']$/g, "").trim();
      } else if (/^range\s*:/i.test(trimmed)) {
        const r = trimmed.match(/\[\s*(-?\d+(?:\.\d+)?)\s*(?:到|至|to|,)\s*(-?\d+(?:\.\d+)?)\s*\]/i);
        if (r) xAxisRange = [Number(r[1]), Number(r[2])];
      }
      continue;
    }

    if (section === "yAxis") {
      if (/^label\s*:/i.test(trimmed)) {
        yAxisLabel = stripLatexInline(trimmed.slice(trimmed.indexOf(":") + 1)).replace(/^["']|["']$/g, "").trim();
      } else if (/^range\s*:/i.test(trimmed)) {
        const r = trimmed.match(/\[\s*(-?\d+(?:\.\d+)?)\s*(?:到|至|to|,)\s*(-?\d+(?:\.\d+)?)\s*\]/i);
        if (r) yAxisRange = [Number(r[1]), Number(r[2])];
      }
      continue;
    }

    if (section === "series") {
      // Case 1: "- name: a" / "- label: a" / "- id: a"
      const nestedStart = trimmed.match(/^-\s*(?:name|label|id)\s*:\s*(.*)$/i);
      if (nestedStart) {
        flushSeries();
        currentSeries = { name: nestedStart[1].trim() };
        continue;
      }
      // Case 2: direct "- key: [[...]]" (possibly with non-ASCII key)
      const directSeries = trimmed.match(/^-\s*([^:\n]+?)\s*:\s*(.*)$/);
      if (directSeries && !/^(?:data|points|values|style|color)\b/i.test(directSeries[1].trim())) {
        flushSeries();
        currentSeries = {
          name: directSeries[1].trim(),
          data: directSeries[2].trim(),
        };
        continue;
      }
      // Sub-fields of nested series
      if (currentSeries) {
        const dataMatch = trimmed.match(/^(?:data|points|values)\s*:\s*(.*)$/i);
        if (dataMatch) {
          currentSeries.data = dataMatch[1].trim();
        } else if (trimmed.startsWith("[") && currentSeries.data !== undefined) {
          currentSeries.data += " " + trimmed;
        }
      }
      continue;
    }

    if (section === "intersections") {
      const nestedPtStart = trimmed.match(/^-\s*(?:label|name|id)\s*:\s*(.*)$/i);
      if (nestedPtStart) {
        flushPoint();
        currentPoint = { label: nestedPtStart[1].trim() };
        continue;
      }
      const directPt = trimmed.match(/^-\s*([^:\n]+?)\s*:\s*(.*)$/);
      if (directPt && !/^(?:coords|point|position|note|description)\b/i.test(directPt[1].trim())) {
        flushPoint();
        const val = directPt[2].trim();
        const coordsMatch = val.match(/(\[\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\])/);
        const noteMatch = val.match(/\]\s*\((.*?)\)/);
        if (coordsMatch) {
          currentPoint = {
            label: directPt[1].trim(),
            coords: coordsMatch[1],
            note: noteMatch?.[1],
          };
        }
        continue;
      }
      if (currentPoint) {
        const coordsMatch = trimmed.match(/^(?:coords|point|position)\s*:\s*(\[\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\])/i);
        if (coordsMatch) {
          currentPoint.coords = coordsMatch[1];
        } else {
          const noteMatch = trimmed.match(/^(?:note|description)\s*:\s*(.*)$/i);
          if (noteMatch) currentPoint.note = noteMatch[1].trim();
        }
      }
    }
  }

  flushSeries();
  flushPoint();

  const out: string[] = [];
  if (title) out.push(`title: ${title}`);
  if (caption) out.push(`caption: ${caption}`);

  out.push(
    xAxisRange
      ? `xAxis: ${xAxisLabel} [${xAxisRange[0]} to ${xAxisRange[1]}]`
      : `xAxis: ${xAxisLabel}`
  );
  out.push(
    yAxisRange
      ? `yAxis: ${yAxisLabel} [${yAxisRange[0]} to ${yAxisRange[1]}]`
      : `yAxis: ${yAxisLabel}`
  );

  const shouldZeroLine =
    zeroLineExplicit !== undefined
      ? zeroLineExplicit
      : Boolean(yAxisRange && yAxisRange[0] < 0 && yAxisRange[1] > 0);
  if (shouldZeroLine) out.push(`zeroLine: true`);

  if (seriesList.length > 0) {
    out.push(`series:`);
    for (const s of seriesList) {
      out.push(`  - ${s.key}: ${s.pointsText}`);
    }
  }

  if (intersectionList.length > 0) {
    out.push(`intersections:`);
    for (const p of intersectionList) {
      out.push(`  - ${p.key}: ${p.coordsText}${p.note ? ` (${p.note})` : ""}`);
    }
  }

  return out.join("\n");
}
