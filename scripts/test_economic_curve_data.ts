import { parseEconomicCurveBlock } from "../utils/economicCurveData";
import { generateEconomicCurveSvg } from "../utils/economicCurveSvg";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

const realDataFixture = `
title: Test chart
caption: Fixture only
xAxis: Year, years [0 to 4]
yAxis: Cashflow, USD [-10 to 30]
zeroLine: true
series:
  - scenario_A: [[0, -10], [1, 0], [2, 12], [4, 25]]
  - scenario_B: [[0, -5], [1, 4], [2, 10], [4, 18]]
intersections:
  - P1: [1, 0] (break-even)
`;

const parsed = parseEconomicCurveBlock(realDataFixture);
assert(parsed.valid, "valid explicit data block is accepted");
assert(parsed.series.length === 2, "two explicit series are parsed");
assert(parsed.series[0].points.length === 4, "all explicit points are preserved");
assert(parsed.series[0].points[2].x === 2 && parsed.series[0].points[2].y === 12, "point coordinates are preserved exactly");
assert(parsed.xAxis.min === 0 && parsed.xAxis.max === 4, "explicit x-axis bounds are preserved");
assert(parsed.intersections.length === 1 && parsed.intersections[0].label === "P1", "intersection marker is parsed");

const svg = generateEconomicCurveSvg(realDataFixture);
assert(Boolean(svg && svg.includes("scenario_A") && svg.includes("scenario_B")), "SVG uses parsed series labels");
assert(Boolean(svg && svg.includes("<polyline") && svg.includes("scenario_A")), "SVG contains plotted paths derived from parsed series");

const missingData = parseEconomicCurveBlock("title: Missing data\nxAxis: X [0 to 10]\nyAxis: Y [0 to 100]");
assert(!missingData.valid, "missing series data is rejected");
assert(missingData.errors.some(e => e.includes("拒绝生成示例曲线")), "missing data explicitly refuses demo fallback");
assert(generateEconomicCurveSvg("title: Missing data") === null, "no SVG is generated without actual series");

const malformed = parseEconomicCurveBlock(`
series:
  - bad_series: [[0, 1]]
`);
assert(!malformed.valid, "series with fewer than two points is rejected");

console.log("All data-driven curve parser tests passed.");
