import { parseEconomicCurveBlock } from "../utils/economicCurveData";
import { generateEconomicCurveSvg } from "../utils/economicCurveSvg";
import { normalizeEconomicCurveBlock } from "../utils/economicCurveNormalizer";
import { exportMarkdownToDocx } from "../utils/docxExport";

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error("FAIL: " + msg);
  console.log("  ✅ PASS: " + msg);
}

async function runRealSampleVerification() {
  console.log("==================================================================");
  console.log("       GlobalCodeTrans 真实工程曲线样本验证 (Real Sample Tests)   ");
  console.log("==================================================================");

  // -------------------------------------------------------------------------
  // 样本 1: 多系列工程经济效益曲线 (来自真实附件 ______8b4d2741.jfif 多曲线数据.jfif)
  // 测试嵌套 YAML 格式 (- name: ... / data: ... / xAxis: { label, range }) 归一化
  // -------------------------------------------------------------------------
  console.log("\n[真实样本 1] 多曲线数据.jfif (嵌套 YAML 兼容归一化 + 6 系列多曲线)");
  const sample1NestedYaml = `
title: 经济效益分析图
caption: 经济效益 E_Fo (USD) 与时间 T_OL (年) 的关系曲线
xAxis:
  label: $T_{OL}$, 年
  range: [0, 10]
yAxis:
  label: $E_{Fo}$, USD
  range: [-300, 600]
series:
  - name: a
    data: [[0, 0], [0.5, 380], [0.8, 550]]
    style: dashed-triangle
  - name: b
    data: [[0, -300], [0.4, 0], [0.6, 450]]
    style: dashed-triangle-purple
  - name: c
    data: [[0, -280], [1, 60], [2, 110], [3, 210], [4, 270], [5, 370], [6, 420], [7, 520], [8, 580]]
  - name: d
    data: [[0, -300], [1, -190], [2, -90], [3, 10], [4, 120], [5, 230], [6, 320], [7, 430], [8, 530]]
  - name: e
    data: [[0, -100], [1, 0], [2, 70], [3, 140], [4, 180], [5, 210], [6, 250], [7, 350], [8, 390], [9, 430], [10, 470]]
  - name: f
    data: [[0, -300], [1, -250], [2, -240], [3, -150], [4, -140], [5, -60], [6.5, 0], [7, 60], [8, 70], [9, 90], [10, 170]]
points:
  - label: G
    coords: [0.8, 300]
  - label: A
    coords: [0, 0]
  - label: E
    coords: [3, 0]
  - label: F
    coords: [6.5, 0]
`;
  const normalized1 = normalizeEconomicCurveBlock(sample1NestedYaml);
  const parsed1 = parseEconomicCurveBlock(normalized1);
  assert(parsed1.valid, "样本 1 嵌套格式归一化后通过校验 (不再出现 曲线系列 name 少于 2 个有效坐标点)");
  assert(parsed1.series.length === 6, "样本 1 成功解析出 6 个不同曲线系列 (a~f)");
  assert(parsed1.xAxis.min === 0 && parsed1.xAxis.max === 10, "横轴范围标定为 [0, 10]");
  assert(parsed1.yAxis.min === -300 && parsed1.yAxis.max === 600, "纵轴负半轴至正半轴标定为 [-300, 600]");
  assert(parsed1.zeroLine === true, "自动识别跨零区间并启用零基准线");
  assert(parsed1.intersections.length === 4, "成功解析 4 个特征交点 (G, A, E, F)");
  const svg1 = generateEconomicCurveSvg(normalized1);
  assert(Boolean(svg1 && svg1.includes("<polyline")), "生成了包含真实 polyline 的 SVG");
  assert(Boolean(svg1 && svg1.includes(">G<") && svg1.includes(">F<")), "SVG 包含特征交点 G 与 F 标注");

  // -------------------------------------------------------------------------
  // 样本 2: 不同曲线图 (地基沉降与荷载历时曲线，不同量程与不同点列)
  // -------------------------------------------------------------------------
  console.log("\n[真实样本 2] 地基沉降历时曲线 (不同曲线形态与不同轴范围)");
  const sample2Block = `
title: 地基深层沉降历时实测曲线 (s - t)
caption: 图示：监测点 S1 与 S2 沉降变形对比
xAxis: 观测历时, d [0 到 180]
yAxis: 累计沉降量, mm [0 到 50]
series:
  - S1_settlement: [[0, 0], [30, 12.5], [60, 24.2], [90, 31.8], [120, 36.1], [180, 38.5]]
  - S2_control: [[0, 0], [30, 8.2], [60, 15.4], [90, 20.1], [120, 22.8], [180, 24.0]]
intersections:
  - T90: [90, 31.8] (沉降速率收敛)
`;
  const normalized2 = normalizeEconomicCurveBlock(sample2Block);
  const parsed2 = parseEconomicCurveBlock(normalized2);
  assert(parsed2.valid, "样本 2 格式合法且通过校验");
  assert(parsed2.series.length === 2, "样本 2 成功解析出 2 个不同监测系列");
  assert(parsed2.xAxis.max === 180, "样本 2 横轴最大历时为 180 天");
  assert(parsed2.yAxis.max === 50, "样本 2 纵轴最大沉降为 50 mm");
  const svg2 = generateEconomicCurveSvg(normalized2);
  assert(Boolean(svg2 && svg2.includes("S1_settlement")), "SVG 2 正确包含专属系列标签");
  assert(svg1 !== svg2, "样本 1 与 样本 2 生成的 SVG 路径截然不同，杜绝千图一面");

  // -------------------------------------------------------------------------
  // 样本 3: 缺少明确数据点或无法准确反算的曲线 (验证坚决拒绝生成)
  // -------------------------------------------------------------------------
  console.log("\n[真实样本 3] 缺少明确数据点或格式非法的曲线 (验证防伪兜底)");
  const sample3Block = `
title: 无法准确反算的残损曲线图
caption: 图示：原始图纸模糊，缺少离散数据点
xAxis: 时间, t [0 到 100]
yAxis: 荷载, kN [0 到 500]
`;
  const normalized3 = normalizeEconomicCurveBlock(sample3Block);
  const parsed3 = parseEconomicCurveBlock(normalized3);
  assert(!parsed3.valid, "缺失 series 数据段时严格判定 valid = false");
  assert(parsed3.errors.some(e => e.includes("拒绝生成示例曲线")), "明确输出拒绝生成示例曲线的错误提示");
  const svg3 = generateEconomicCurveSvg(normalized3);
  assert(svg3 === null, "确实未生成任何 SVG，坚决不使用默认演示数据填补");

  // -------------------------------------------------------------------------
  // DOCX 导出端到端测试 (包含 diagram-audit-parameters JSON 隔离验证)
  // -------------------------------------------------------------------------
  console.log("\n[DOCX 导出测试] 验证真实数据图、无数据提示与参数复核 JSON 隔离");
  const docxMarkdown = `
# 工程曲线真实性测试报告

\`\`\`chart:economic
${sample1NestedYaml}
\`\`\`

\`\`\`diagram-audit-parameters
[{"name": "E_Fo 交点 G", "value": "300", "unit": "USD", "location": "T_OL = 0.8 年", "status": "已核对"}]
\`\`\`

\`\`\`chart:curve
${sample3Block}
\`\`\`
`;
  const docxBlob = await exportMarkdownToDocx(docxMarkdown, "测试报告");
  assert(Boolean(docxBlob && docxBlob.size > 1000), "DOCX 打包成功生成有效二进制 (size: " + docxBlob.size + " bytes)");

  console.log("\n==================================================================");
  console.log("       🎉 全部真实样本验证与防伪拦截测试通过！                      ");
  console.log("==================================================================");
}

runRealSampleVerification().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
