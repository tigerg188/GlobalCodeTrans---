# 实施步骤（非程序员操作版）

## 第 1 步：保护当前版本

1. 打开 Google AI Studio 当前 GlobalCodeTrans 项目。
2. 先复制项目，或确保当前版本已导出并保存在本地。
3. 不要直接覆盖唯一的可运行版本。

## 第 2 步：上传补丁包

将 ZIP 解压后，把以下目录中的文件上传/复制到项目相同目录：
- `utils/economicCurveData.ts`
- `utils/economicCurveSvg.ts`
- `components/EconomicCurveChartDataDriven.tsx`
- `scripts/test_economic_curve_data.ts`

同时上传：
- `PATCH.diff`
- `AI_STUDIO_PROMPT.md`
- `README_CN.md`

## 第 3 步：让 AI Studio 执行

把 `AI_STUDIO_PROMPT.md` 全文粘贴到 AI Studio。

要求 AI Studio 先检查文件和差异，再实施。不要让它自行扩大任务范围。

## 第 4 步：检查结果

要求 AI Studio 展示：
- `MarkdownViewer.tsx` 两处预览组件替换；
- `docxExport.ts` 经济曲线分支的修改；
- `package.json` 中新增的 `test:curve` 命令；
- 测试实际控制台输出；
- `npm/bun build` 和 TypeScript 检查结果。

## 第 5 步：真实图样验证

上传原始曲线图及模型输出的 `chart:curve` 代码块，至少选择两张不同图样。比较原图、预览和 Word 输出。

如果原图没有可核对的原始数据，必须把反算坐标标记为“图像估算值”，不得冒充原始实验数据。

## 第 6 步：Word 验收

导出 DOCX，在 Microsoft Word 桌面端打开、检查、保存、关闭后重新打开。

注意：本补丁的 DOCX 曲线仍然通过现有流程栅格化为 PNG，属于 E3，不是 Word 原生图表，也不是可独立编辑的 E2 矢量对象。
