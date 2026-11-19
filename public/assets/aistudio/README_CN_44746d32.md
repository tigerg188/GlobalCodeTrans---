# GlobalCodeTrans 定点修复包：工程曲线数据真实性 V1.0

## 本补丁解决什么问题

当前仓库中的工程经济曲线存在一个可直接确认的缺陷：

1. `components/EngineeringCharts.tsx` 的 `EconomicCurveChart` 虽然接收 `content`，但实际曲线点、坐标轴范围和图例均为固定写死的数据。
2. `utils/chartImageGenerator.ts` 的 `generateEconomicCurveChartPng()` 也使用固定曲线点，函数不接收模型识别出的系列数据。
3. `utils/docxExport.ts` 在识别到 economic/curve 代码块后，无条件调用 `generateEconomicCurveChartPng()`，没有把 `blockContent` 传给绘图函数。
4. 因此，不同原始工程曲线可能被渲染成同一组演示曲线。即使模型识别出正确数据，绘图层也没有使用这些数据。

本补丁新增数据驱动解析和 SVG 生成模块：
- `utils/economicCurveData.ts`
- `utils/economicCurveSvg.ts`
- `components/EconomicCurveChartDataDriven.tsx`
- `scripts/test_economic_curve_data.ts`

## 重要边界

- 本补丁只处理模型已经输出为 `chart:economic` / `chart:curve` 结构化代码块的数据。
- 它不负责从原始 PDF 图像中自动识别曲线像素、标定坐标轴或反算数据点。
- 如果模型没有提供真实数据点，补丁拒绝生成曲线，不使用演示数据兜底。
- 浏览器预览使用 SVG；当前 DOCX 集成仍通过现有 `renderSvgToPngBuffer` 转成 PNG，因此 Word 内是 E3 图片，不得标称 E1 或 E2。
- 这不是 GlobalCodeTrans 全项目替换包，不修改 App.tsx、翻译主链路、UI 布局、服务端、依赖版本或现有公式处理。

## 应用文件

将本 ZIP 中的 `utils/`、`components/`、`scripts/` 文件复制到项目对应目录。然后按 `PATCH.diff` 中的两处小改动修改：
- `components/MarkdownViewer.tsx`
- `utils/docxExport.ts`

修改前请在 AI Studio 中建立项目副本或保存当前 Git commit。

## 测试

在项目根目录执行：

```bash
bun run test:curve
```

并在 `package.json` 的 scripts 中添加：

```json
"test:curve": "tsx scripts/test_economic_curve_data.ts"
```

若使用 npm：

```bash
npx tsx scripts/test_economic_curve_data.ts
```

该测试只验证结构化数据解析和 SVG 生成逻辑，不代表真实 PDF 图像识别精度或 Word 桌面端验收通过。

## 输入代码块格式

````text
```chart:curve
title: 多系列工程经济曲线
caption: 图示：工程经济曲线
xAxis: TOL, years [0 to 10]
yAxis: EFo, USD [-300 to 600]
zeroLine: true
series:
  - scenario_A: [[0, -100], [1, 0], [2, 180], [4, 260]]
  - scenario_B: [[0, -80], [1, 20], [2, 130], [4, 210]]
intersections:
  - A: [1, 0] (break-even)
```
````

若缺少 `series` 或任何系列少于两个有效坐标点，预览和 DOCX 均不得生成默认曲线。

## 验收重点

1. 输入两组不同曲线数据，预览结果必须明显不同。
2. 修改任意坐标点，曲线必须随之改变。
3. 删除 `series` 数据段，系统必须显示“缺少可核验数据”，不得出现任何曲线。
4. Word 导出必须与预览使用同一组解析数据。
5. 不能把 PNG 输出标为矢量对象或 Word 原生图表。
