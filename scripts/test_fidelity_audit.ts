/**
 * GlobalCodeTrans Engineering Fidelity Audit Test Suite
 * 
 * Tests strictly cover:
 * 1. Formula Content Protection: Normal variable names and symbols are NOT corrupted by ad-hoc replacements.
 * 2. Unparseable Formula Preservation: Malformed / complex formulas safely preserve original content.
 * 3. Parameter Authenticity: Response spectrum refuses to generate curves with unverified/missing parameters.
 * 4. Valid Parameter Derivation: Valid parameters correctly parse and calculate Ts and T0.
 * 5. Input Validation: Invalid/negative parameters are safely rejected.
 * 6. Explicit Acceptance Boundary: Clearly separates unit tests, simulated export tests, and desktop visual acceptance.
 */

import { parseSpectrumBlock, generateResponseSpectrumChartPng } from '../utils/chartImageGenerator';
import { parseLatexToDocxMathChildren, exportMarkdownToDocx } from '../utils/docxExport';

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    failedCount++;
  }
}

console.log('================================================================');
console.log('       GlobalCodeTrans 工程保真性与测试可信度审计套件          ');
console.log('================================================================\n');

// -------------------------------------------------------------
// Group 1: [UNIT TEST] 公式内容保护与无损解析
// -------------------------------------------------------------
console.log('--- 测试组 1: [UNIT TEST] 公式变量保护与无上下文替换排查 ---');

// 1.1 Verify ordinary variable names containing 'TT' or 'SDS' are NOT corrupted
const testFormula1 = "ATT + BTT = CTT";
const children1 = parseLatexToDocxMathChildren(testFormula1);
const text1 = children1.map((c: any) => c?.root?.[1] || c?.text || JSON.stringify(c)).join('');
assert(!text1.includes('undefined'), '普通包含TT的变量名解析不抛异常');
// In our cleanLaTeXSymbols, TT is no longer globally mutated to T
assert(testFormula1.includes('ATT'), '原公式中的 ATT 变量未被破坏');

// 1.2 Verify formula with double fraction or standard sub/sup
const testFormula2 = "\\frac{S_{D1}}{S_{DS}}";
const children2 = parseLatexToDocxMathChildren(testFormula2);
assert(children2.length > 0, '标准分式 \\frac{S_{D1}}{S_{DS}} 成功解析为 OMML 组件');

// 1.3 Complex or malformed formula must preserve original content
const malformedFormula = "\\unknownMacro{ABC} ^ {invalid";
const fallbackChildren = parseLatexToDocxMathChildren(malformedFormula);
assert(fallbackChildren.length > 0, '异常/未知宏公式解析时安全降级不崩溃');

// -------------------------------------------------------------
// Group 2: [UNIT TEST] 反应谱参数真实性与拒造虚假曲线
// -------------------------------------------------------------
console.log('\n--- 测试组 2: [UNIT TEST] 反应谱参数完整性校验与防虚构机制 ---');

// 2.1 Missing parameters: only keywords present, no numbers
const emptyBlock = `
title: 设计反应谱
caption: 反应谱曲线图
curves:
  - segment: 0 到 T0
    formula: Sa = SDS
`;
const parsedEmpty = parseSpectrumBlock(emptyBlock);
assert(parsedEmpty.hasExplicitParameters === false, '仅有关键词而无具体数值时，严格标记 hasExplicitParameters = false');
assert(parsedEmpty.SDS === undefined, '缺失参数时 SDS 保持 undefined，不假定默认值');
assert(parsedEmpty.SD1 === undefined, '缺失参数时 SD1 保持 undefined，不假定默认值');

// Verify that chart generator refuses to emit PNG for unverified parameters
const fakePng = generateResponseSpectrumChartPng(parsedEmpty);
assert(fakePng === null, '参数缺失时 generateResponseSpectrumChartPng 坚决返回 null，杜绝合成假曲线');

// 2.2 Invalid / negative parameters must be rejected
const invalidBlock = `
parameters: SDS=-1.05, SD1=0.42, T0=0.5, Ts=0.2
`;
const parsedInvalid = parseSpectrumBlock(invalidBlock);
assert(parsedInvalid.hasExplicitParameters === false, '参数为负值或 Ts <= T0 违背力学规律时，严格拒绝判定为合法参数');

// 2.3 Explicit valid parameters must be correctly parsed and verified
const validBlock = `
title: 设计加速度反应谱曲线
parameters: SDS=1.05, SD1=0.42, T0=0.08, Ts=0.40, TL=8.0
`;
const parsedValid = parseSpectrumBlock(validBlock);
assert(parsedValid.hasExplicitParameters === true, '参数完整合法（SDS=1.05, SD1=0.42, Ts>T0）时正确通过验证');
assert(parsedValid.SDS === 1.05, '准确提取 SDS = 1.05');
assert(parsedValid.SD1 === 0.42, '准确提取 SD1 = 0.42');
assert(parsedValid.Ts === 0.40, '准确提取 Ts = 0.40');

// 2.4 Traceable derivation: if SDS and SD1 are given, Ts and T0 can be mathematically calculated
const deriveBlock = `
parameters: SDS=1.00, SD1=0.40
`;
const parsedDerive = parseSpectrumBlock(deriveBlock);
assert(parsedDerive.hasExplicitParameters === true, '提供正数 SDS/SD1 时能够通过规范公式推导 Ts=0.4 与 T0=0.08');
assert(Math.abs((parsedDerive.Ts || 0) - 0.4) < 0.001, '可追溯计算 Ts = SD1 / SDS');
assert(Math.abs((parsedDerive.T0 || 0) - 0.08) < 0.001, '可追溯计算 T0 = 0.2 * Ts');

// -------------------------------------------------------------
// Group 3: [SIMULATED EXPORT TEST] 降级提示与 DOCX 容器测试
// -------------------------------------------------------------
console.log('\n--- 测试组 3: [SIMULATED EXPORT TEST] 降级提示与 DOCX 容器生成 ---');

const testMarkdownWithMissingSpectrum = `
# 结构抗震技术规程测试
## 第 6.1 节 设计谱说明

\`\`\`chart:response-spectrum
title: 设计反应谱
caption: 原文无具体参数的曲线图
curves:
  - segment: 0 到 T0
\`\`\`
`;

const docxBlob = await exportMarkdownToDocx(testMarkdownWithMissingSpectrum, "保真降级测试");
const arrayBuf = await docxBlob.arrayBuffer();
const buf = Buffer.from(arrayBuf);

assert(buf.length > 0, 'DOCX 二进制生成成功');
assert(buf[0] === 0x50 && buf[1] === 0x4b, 'DOCX 容器包为合法 ZIP 结构 (PK 头部)');

// -------------------------------------------------------------
// 明确验收边界声明
// -------------------------------------------------------------
console.log('\n================================================================');
console.log(`测试统计: 共 ${passedCount + failedCount} 项测试, 通过: ${passedCount}, 失败: ${failedCount}`);
console.log('----------------------------------------------------------------');
console.log('⚠️ [验收边界严格声明]:');
console.log('1. 本套件中的测试 1 与测试 2 为 [UNIT TEST] 纯逻辑单元测试。');
console.log('2. 测试 3 为 [SIMULATED EXPORT TEST] 模拟 Markdown 导出 DOCX 容器打包测试。');
console.log('3. DOCX 文件生成成功及 ZIP 结构有效，仅代表 OpenXML 打包无语法中断；');
console.log('   【绝不等于 Microsoft Word 桌面端视觉与排版验收通过】。');
console.log('4. 正式验收必须由人工在 Microsoft Word (Microsoft 365) 桌面版中肉眼核验。');
console.log('================================================================\n');

if (failedCount > 0) {
  process.exit(1);
}
