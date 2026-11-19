import { SYSTEM_PROMPT, GEMINI_MODEL, getAdaptiveSystemPrompt } from "../constants";
import { SupportedFileType } from "../types";
import { quotaTracker } from "./quotaTracker";

export interface PageBatchInfo {
  startPage: number;
  endPage: number;
  totalPages: number;
}

export async function translatePage(
  base64Data: string,
  mimeType: string,
  onChunk?: (text: string) => void,
  abortSignal?: AbortSignal,
  pageInfo?: PageBatchInfo,
  modelName?: string,
  languageConfig?: { sourceLang: string; targetLang: string },
  onStatusUpdate?: (status: string) => void,
  onLog?: (level: 'info' | 'warn' | 'error' | 'success', message: string, details?: any) => void,
  auditDiagramParams?: boolean,
  onModelSwitch?: (newModel: string) => void
): Promise<string> {
  const sourceLang = languageConfig?.sourceLang || '自动识别小语种';
  const targetLang = languageConfig?.targetLang || '中文 (简体)';
  
  let sanitizedMimeType = mimeType;
  if (mimeType.includes('pdf')) sanitizedMimeType = 'application/pdf';
  else if (mimeType.includes('png')) sanitizedMimeType = 'image/png';
  else if (mimeType.includes('webp')) sanitizedMimeType = 'image/webp';
  else sanitizedMimeType = 'image/jpeg';

  let pageInstruction = "";
  if (pageInfo) {
    pageInstruction = `\n【切片解析与忠实复现准则】：
当前切片正在翻译文档的【第 ${pageInfo.startPage} 页 至 第 ${pageInfo.endPage} 页】（整份文件共 ${pageInfo.totalPages} 页）。

⚠️【最高强制红线：100% 全量汉化，绝对严禁输出老挝语等源语言原文】
1. 你的核心使命是将当前输入切片中的所有老挝语（或源语言）完整、彻底地翻译为规范的目标语言【${targetLang}】！
2. 绝对严禁直接复制或输出未经翻译的老挝语字符！正文、标题、表格、表单每一格、签字盖章栏必须全部翻译为中文！
3. “忠实原文”是指忠实翻译原文的条款语义、技术要求与逻辑结构，绝对不是让你把老挝语原文照搬到译文里！
4. 【第 5-6 页规程与第 22 页起附录表单强制深度汉化】：无论在正文公文规程（如第 5-6 页），还是附录表单（如第 22 页起的 APPENDIX B、C、D、E 申请表、填表须知、材料清单 a~j 项、协议条款 i~iii、适用标准、审查栏、签字盖章栏），表格内外的所有老挝语词句必须 100% 逐项翻译为规范中文！严禁因表格复杂而将老挝语原文照搬遗留在单元格或正文中！
5. 绝对严禁在翻译成果正文中夹带未经原文提及的具体外部标准代号！原文是什么标题就翻译什么标题，原文没有的文字和图表绝对严禁凭空添加！
6. 仅当本页真实存在公式、表格或图表时才进行相应复现。`;
  }

  if (auditDiagramParams) {
    pageInstruction += `
6. 【图表参数复核模式（已开启图表参数复核）】：
当检测到本页真实包含工程曲线图、构造剖面图、受力示意图或计算模型时，在图表下方额外输出提取到的图表参数复核表：
\`\`\`diagram-audit-parameters
[
  {"name": "实测参数名", "value": "真实数值", "unit": "物理单位", "location": "在图中的具体位置或引线", "status": "与原文条文核对状态"}
]
\`\`\``;
  }

  const promptText = `执行【GlobalCodeTrans - 专业翻译与高保真排版复现】：
语言方向：【源语言: ${sourceLang}】 ➔ 【目标语言: ${targetLang}】
【语言铁律】：最终输出的正文必须全部翻译为【${targetLang}】！除通用国际代号外，绝对严禁直接复制或输出未经翻译的老挝语原文！
${pageInstruction}
请直接输出高保真 Markdown 译文。`;

  let currentModel = modelName || GEMINI_MODEL;
  const maxRetries = 4;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (abortSignal?.aborted) {
      throw new DOMException("The user aborted a request.", "AbortError");
    }

    let selectedModel = quotaTracker.getHealthyModel(currentModel);
    currentModel = selectedModel;
    const pageDesc = pageInfo ? `第 ${pageInfo.startPage}-${pageInfo.endPage} 页` : '图像公文';

    onLog?.('info', `调用 Gemini 服务 [${selectedModel}]，${pageDesc} ${attempt > 0 ? `(重试第 ${attempt} 次)` : '首次发起'}`);
    quotaTracker.recordRequest(selectedModel);

    try {
      const response = await fetch('/api/gemini/translate-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data,
          mimeType: sanitizedMimeType,
          promptText,
          systemInstruction: getAdaptiveSystemPrompt({ fileType: 'pdf', sourceLang, targetLang }),
          modelName: selectedModel
        }),
        signal: abortSignal
      });

      if (!response.ok) {
        throw new Error(`Server request failed with status ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const dataStr = trimmed.slice(6);
              if (dataStr === '[DONE]') break;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.error) throw new Error(parsed.error);
                if (parsed.text) {
                  fullText += parsed.text;
                  onChunk?.(parsed.text);
                }
              } catch (e: any) {
                if (e?.message && e.message !== 'Unexpected end of JSON input') {
                  throw e;
                }
              }
            }
          }
        }
      }

      const recordedTokens = Math.ceil((fullText.length + promptText.length) * 0.75);
      quotaTracker.recordUsage(selectedModel, recordedTokens);
      onLog?.('success', `${pageDesc} 成功接收到模型响应 (${fullText.length} 字符, 消耗 ~${recordedTokens} Tokens)`);
      return fullText;

    } catch (error: any) {
      if (abortSignal?.aborted || error?.name === 'AbortError') {
        throw error;
      }
      onLog?.('error', `PDF 切片处理异常: ${error?.message || error}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }

  throw new Error("PDF 切片翻译超出最大重试次数。");
}

export async function translateExcelBatch(
  batchDataPayload: string,
  batchMeta: { 
    sheetName: string; 
    startRow: number; 
    endRow: number; 
    totalRows: number; 
    nonBlankCount?: number; 
    targetModel?: string;
    sourceLang?: string;
    targetLang?: string;
  },
  onChunk?: (text: string) => void,
  abortSignal?: AbortSignal,
  onStatusUpdate?: (status: string) => void,
  onLog?: (level: 'info' | 'warn' | 'error' | 'success', message: string, details?: any) => void
): Promise<string> {
  const sourceLang = batchMeta.sourceLang || '自动识别小语种';
  const targetLang = batchMeta.targetLang || '中文 (简体)';
  const nonBlankStr = batchMeta.nonBlankCount !== undefined ? `，待翻译有效数据行: ${batchMeta.nonBlankCount} 行` : '';
  
  const prompt = `你正在翻译 Excel 表格【工作表: ${batchMeta.sheetName}】。
当前批次为【第 ${batchMeta.startRow} 行 至 第 ${batchMeta.endRow} 行】（全表共 ${batchMeta.totalRows} 行${nonBlankStr}）。
语言方向：【源语言: ${sourceLang}】 ➔ 【目标语言: ${targetLang}】。
请将各单元格的原文翻译为规范的 ${targetLang}，并严格以 JSON 格式返回：
{
  "rows": [
    { "r": ${batchMeta.startRow}, "c": ["译文1", "译文2", ...] }
  ]
}`;

  let selectedModel = quotaTracker.getHealthyModel(batchMeta.targetModel || GEMINI_MODEL);

  const response = await fetch('/api/gemini/translate-excel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      batchDataPayload,
      prompt,
      systemInstruction: getAdaptiveSystemPrompt({ fileType: 'excel', sourceLang, targetLang }),
      targetModel: selectedModel,
      responseSchema: {
        type: "OBJECT",
        properties: {
          rows: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                r: { type: "INTEGER" },
                c: {
                  type: "ARRAY",
                  items: { type: "STRING" }
                }
              },
              required: ["r", "c"]
            }
          }
        },
        required: ["rows"]
      }
    }),
    signal: abortSignal
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error);
  const fullText = data.text || "";
  if (onChunk && fullText) {
    onChunk(fullText);
  }
  return fullText;
}

export async function translateTextChunk(
  textChunk: string,
  sectionMeta: { 
    title: string; 
    current: number; 
    total: number;
    fileType?: SupportedFileType;
    sourceLang?: string;
    targetLang?: string;
  },
  onChunk?: (text: string) => void,
  abortSignal?: AbortSignal
): Promise<string> {
  const sourceLang = sectionMeta.sourceLang || '自动识别小语种';
  const targetLang = sectionMeta.targetLang || '中文 (简体)';
  const fileType = sectionMeta.fileType || 'word';

  const prompt = `当前正在翻译工程规范与技术文档的【${sectionMeta.title}】（第 ${sectionMeta.current} 部分 / 共 ${sectionMeta.total} 部分）。
语言方向：【源语言: ${sourceLang}】 ➔ 【目标语言: ${targetLang}】。
请执行 1:1 完整高精度专业翻译。直接输出 Markdown 译文。`;

  const response = await fetch('/api/gemini/translate-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      textChunk,
      prompt,
      systemInstruction: getAdaptiveSystemPrompt({ fileType, sourceLang, targetLang }),
      fileType
    }),
    signal: abortSignal
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  if (reader) {
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) {
              fullText += parsed.text;
              onChunk?.(parsed.text);
            }
          } catch {}
        }
      }
    }
  }

  return fullText;
}
