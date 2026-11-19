import React, { useMemo } from "react";
import { parseEconomicCurveBlock } from "../utils/economicCurveData";
import { buildEconomicCurveSvg } from "../utils/economicCurveSvg";

export const EconomicCurveChartDataDriven: React.FC<{ content: string }> = ({ content }) => {
  const parsed = useMemo(() => parseEconomicCurveBlock(content || ""), [content]);
  const svg = useMemo(() => buildEconomicCurveSvg(parsed), [parsed]);

  if (!parsed.valid || !svg) {
    return (
      <div className="my-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="font-bold">未生成工程曲线图：缺少可核验的数据</div>
        <div className="mt-1">系统不会使用示例曲线或默认数据替代原始数据。</div>
        {parsed.errors.map((error, i) => <div key={i} className="mt-1">• {error}</div>)}
        {parsed.warnings.map((warning, i) => <div key={`w${i}`} className="mt-1 text-amber-800">• {warning}</div>)}
      </div>
    );
  }

  return (
    <figure className="my-6 overflow-hidden rounded-xl border border-slate-300 bg-white">
      <figcaption className="border-b border-slate-200 px-4 py-3 text-sm font-bold text-slate-800">
        {parsed.title}
      </figcaption>
      <div className="overflow-x-auto p-2" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
        数据点：{parsed.series.reduce((sum, s) => sum + s.points.length, 0)}；
        曲线系列：{parsed.series.length}；
        交点标注：{parsed.intersections.length}。
        {parsed.warnings.length > 0 ? " 存在待核对提示。" : ""}
      </div>
    </figure>
  );
};
