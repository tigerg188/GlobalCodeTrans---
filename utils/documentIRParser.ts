/**
 * GlobalCodeTrans V1.7 - General Geometry & Flowchart Topological Parser (Phase 2)
 * 
 * Converts raw markdown flowchart/diagram blocks into standardized GeometryIR
 * complying with the DocumentIR specification. Replaces hardcoded standard assumptions
 * with a generalized directed-graph parser supporting nodes, branch tags ([Yes], [No]),
 * arrows (->, →), and loopbacks.
 */

import { GeometryIR, GeometryNode, GeometryEdge, MultiDimensionalConfidence, ProvenanceSource, EditabilityGrade, VerificationStatus } from '../types/documentIR';

export interface ParseOptions {
  objectId?: string;
  sourcePage?: number;
  provenance?: ProvenanceSource;
}

/**
 * Parses a raw flowchart or diagram text block into a standardized GeometryIR object.
 */
export function parseFlowchartToGeometryIR(content: string, options: ParseOptions = {}): GeometryIR {
  const objectId = options.objectId || `geom-${Math.random().toString(36).substring(2, 9)}`;
  const sourcePage = options.sourcePage || 1;
  const provenance = options.provenance || 'gemini_multimodal';

  const nodes: GeometryNode[] = [];
  const edges: GeometryEdge[] = [];

  const lines = (content || '').split('\n');
  let stepCounter = 1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('title:') || trimmed.startsWith('caption:') || trimmed.startsWith('notes:') || trimmed.startsWith('steps:') || trimmed.startsWith('flow:')) {
      continue;
    }

    // Clean list markers
    const cleanLine = trimmed.replace(/^[-*]\s*/, '').trim();
    const stepNumMatch = cleanLine.match(/^(\d+)[\.、]\s*(.*)$/);
    const stepNum = stepNumMatch ? parseInt(stepNumMatch[1], 10) : stepCounter;
    const stepText = stepNumMatch ? stepNumMatch[2].trim() : cleanLine;

    // Classify node type
    const upper = stepText.toUpperCase();
    const isStart = upper.includes('START') || stepText.includes('开始');
    const isEnd = upper.includes('END') || stepText.includes('结束') || stepText.includes('归档');
    const isDecision = stepText.includes('?') || stepText.includes('？') || upper.includes('OK') || /是否|审查|评估|considers/i.test(stepText);

    const nodeType: GeometryNode['type'] = isStart ? 'start' : (isEnd ? 'end' : (isDecision ? 'decision' : 'process'));

    const nodeId = `node-${stepNum}`;
    nodes.push({
      id: nodeId,
      type: nodeType,
      originalText: stepText,
      translatedText: stepText,
    });

    // Detect branches or inline edges (e.g., [Yes] -> 步骤4 | [No] -> 纠正)
    const noMatch = stepText.match(/\[No[^\]]*\]\s*(?:->|→)?\s*([^|]+)/i);
    if (noMatch) {
      const loopMatch = noMatch[1].match(/(?:->|→|返回|回至)\s*(?:步骤)?\s*(\d+|[A-Za-z0-9_-]+)/i);
      const targetId = loopMatch ? `node-${loopMatch[1]}` : nodeId; // loopback or self-correction
      edges.push({
        id: `edge-${nodeId}-no-${Math.random().toString(36).substring(2, 5)}`,
        fromNodeId: nodeId,
        toNodeId: targetId,
        condition: 'no',
        label: '[No / 否]',
        isLoopback: Boolean(loopMatch),
      });
    }

    const yesMatch = stepText.match(/\[Yes[^\]]*\]\s*(?:->|→)?\s*([^|]+)/i);
    if (yesMatch) {
      edges.push({
        id: `edge-${nodeId}-yes-${Math.random().toString(36).substring(2, 5)}`,
        fromNodeId: nodeId,
        toNodeId: `node-${stepNum + 1}`,
        condition: 'yes',
        label: '[Yes / 是]',
        isLoopback: false,
      });
    }

    stepCounter++;
  }

  // Automatically link sequential linear nodes if no explicit edges exist between adjacent nodes
  for (let i = 0; i < nodes.length - 1; i++) {
    const currentId = nodes[i].id;
    const nextId = nodes[i + 1].id;
    const hasOutgoing = edges.some(e => e.fromNodeId === currentId);
    if (!hasOutgoing) {
      edges.push({
        id: `edge-seq-${currentId}-${nextId}`,
        fromNodeId: currentId,
        toNodeId: nextId,
        condition: 'unconditional',
        isLoopback: false,
      });
    }
  }

  const confidence: MultiDimensionalConfidence = {
    modelConfidence: 0.90,
    extractionQuality: nodes.length > 0 ? 0.88 : 0.40,
    geometryError: 0.08,
    semanticValidation: nodes.length > 0,
  };

  const verificationStatus: VerificationStatus = nodes.length > 0 ? 'structural_validated' : 'raw';
  const editabilityGrade: EditabilityGrade = nodes.length > 0 ? 'E2' : 'E0';

  return {
    objectId,
    objectType: 'geometry',
    geometrySubtype: 'flowchart',
    sourcePage,
    provenance,
    confidence,
    verificationStatus,
    isUncertain: nodes.length === 0,
    editabilityGrade,
    nodes,
    edges,
  };
}
