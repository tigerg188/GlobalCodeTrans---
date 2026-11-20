/**
 * GlobalCodeTrans V1.7
 *
 * Text-based Flowchart Parser
 *
 * IMPORTANT:
 * This module parses textual / Markdown flowchart descriptions only.
 *
 * It does NOT perform:
 * - Image-based node detection
 * - PDF vector path extraction
 * - Pixel coordinate measurement
 * - Geometric reconstruction
 * - Visual arrow routing recognition
 * - Full graph topology verification
 *
 * Therefore, its output must remain:
 * verificationStatus = 'raw'
 * editabilityGrade = 'E0'
 * isUncertain = true
 *
 * Only explicitly identifiable branch destinations are converted into edges.
 * No implicit sequential edges or fabricated branch destinations are generated.
 */

import {
  GeometryIR,
  GeometryNode,
  GeometryEdge,
  MultiDimensionalConfidence,
  ProvenanceSource,
} from '../types/documentIR';

export interface ParseOptions {
  objectId?: string;
  sourcePage?: number;
  provenance?: ProvenanceSource;
}

interface ParsedBranch {
  condition: 'yes' | 'no';
  targetText: string;
}

/**
 * Extracts an explicit numeric step reference from branch target text.
 *
 * Supported examples:
 * - 步骤4
 * - 返回步骤3
 * - 回至步骤2
 * - Step 4
 * - node-4
 * - 4
 *
 * A descriptive action without an explicit node reference is not converted
 * into an edge.
 */
function extractExplicitTargetStep(targetText: string): number | null {
  const text = targetText.trim();

  if (!text) {
    return null;
  }

  const namedTargetMatch = text.match(
    /(?:步骤|step\s*|node[-_ ]?)(\d+)/i
  );

  if (namedTargetMatch) {
    const stepNumber = Number.parseInt(namedTargetMatch[1], 10);

    return Number.isFinite(stepNumber) && stepNumber > 0
      ? stepNumber
      : null;
  }

  const exactNumberMatch = text.match(/^(\d+)$/);

  if (exactNumberMatch) {
    const stepNumber = Number.parseInt(exactNumberMatch[1], 10);

    return Number.isFinite(stepNumber) && stepNumber > 0
      ? stepNumber
      : null;
  }

  return null;
}

/**
 * Extracts explicit Yes / No branches from a single node description.
 *
 * A branch must contain an explicit arrow:
 * [Yes] -> Step 4
 * [No] -> Return to Step 3
 *
 * A branch label without an explicit destination is ignored.
 */
function extractBranches(text: string): ParsedBranch[] {
  const branches: ParsedBranch[] = [];

  const branchPattern =
    /\[(Yes|No)(?:[^\]]*)\]\s*(?:->|→)\s*([^|]+)/gi;

  for (const match of text.matchAll(branchPattern)) {
    const condition = match[1].toLowerCase() as 'yes' | 'no';
    const targetText = match[2].trim();

    if (!targetText) {
      continue;
    }

    branches.push({
      condition,
      targetText,
    });
  }

  return branches;
}

/**
 * Parses a raw textual / Markdown flowchart description into GeometryIR.
 *
 * This function is a text parser, not a visual geometry recognition engine.
 */
export function parseFlowchartToGeometryIR(
  content: string,
  options: ParseOptions = {}
): GeometryIR {
  const objectId =
    options.objectId ||
    `geom-${Math.random().toString(36).substring(2, 9)}`;

  const sourcePage = options.sourcePage ?? 1;
  const provenance = options.provenance ?? 'gemini_multimodal';

  const nodes: GeometryNode[] = [];
  const edges: GeometryEdge[] = [];

  const nodeStepNumbers = new Set<number>();

  const lines = (content || '').split(/\r?\n/);

  let stepCounter = 1;

  /**
   * Phase 1:
   * Parse textual node descriptions.
   */
  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    // Ignore common metadata lines.
    if (
      /^(title|caption|notes|steps|flow)\s*:/i.test(trimmed)
    ) {
      continue;
    }

    // Remove common Markdown list markers.
    const cleanLine = trimmed
      .replace(/^[-*+]\s*/, '')
      .trim();

    if (!cleanLine) {
      continue;
    }

    const stepNumMatch = cleanLine.match(
      /^(\d+)[.、)]\s*(.*)$/
    );

    const stepNum = stepNumMatch
      ? Number.parseInt(stepNumMatch[1], 10)
      : stepCounter;

    const stepText = stepNumMatch
      ? stepNumMatch[2].trim()
      : cleanLine;

    if (!Number.isFinite(stepNum) || stepNum <= 0 || !stepText) {
      continue;
    }

    // Avoid duplicate node IDs.
    if (nodeStepNumbers.has(stepNum)) {
      continue;
    }

    nodeStepNumbers.add(stepNum);

    stepCounter = Math.max(stepCounter, stepNum + 1);

    const upper = stepText.toUpperCase();

    const isStart =
      upper.includes('START') ||
      stepText.includes('开始');

    const isEnd =
      upper.includes('END') ||
      stepText.includes('结束') ||
      stepText.includes('归档');

    const isDecision =
      stepText.includes('?') ||
      stepText.includes('？') ||
      upper.includes('OK') ||
      /是否|审查|评估|considers/i.test(stepText);

    const nodeType: GeometryNode['type'] = isStart
      ? 'start'
      : isEnd
        ? 'end'
        : isDecision
          ? 'decision'
          : 'process';

    nodes.push({
      id: `node-${stepNum}`,
      type: nodeType,
      originalText: stepText,
      translatedText: stepText,
    });
  }

  /**
   * Phase 2:
   * Parse only explicitly identifiable branch destinations.
   *
   * No automatic sequential connections are created.
   */
  for (const node of nodes) {
    const branches = extractBranches(node.originalText);

    const sourceStepMatch = node.id.match(/^node-(\d+)$/);
    const sourceStep = sourceStepMatch
      ? Number.parseInt(sourceStepMatch[1], 10)
      : null;

    for (const branch of branches) {
      const targetStep = extractExplicitTargetStep(
        branch.targetText
      );

      // The target must be explicitly identifiable.
      if (targetStep === null) {
        continue;
      }

      const targetNodeId = `node-${targetStep}`;

      // The referenced target node must actually exist.
      if (!nodeStepNumbers.has(targetStep)) {
        continue;
      }

      const isLoopback =
        /返回|回至|return|back to/i.test(branch.targetText) ||
        (
          sourceStep !== null &&
          targetStep <= sourceStep
        );

      const edgeId =
        `edge-${node.id}-${branch.condition}-${targetNodeId}`;

      // Avoid duplicate edges.
      if (edges.some(edge => edge.id === edgeId)) {
        continue;
      }

      const edge: GeometryEdge = {
        id: edgeId,
        fromNodeId: node.id,
        toNodeId: targetNodeId,
        condition: branch.condition,
        label: branch.condition === 'yes'
          ? '[Yes / 是]'
          : '[No / 否]',
        isLoopback,
      };

      edges.push(edge);
    }
  }

  /**
   * Phase 3:
   * Conservative confidence declaration.
   *
   * This parser has not performed image extraction, coordinate measurement,
   * geometric validation, or independent semantic verification.
   *
   * Therefore, all unavailable metrics are explicitly null.
   */
  const confidence: MultiDimensionalConfidence = {
    modelConfidence: null,
    extractionQuality: null,
    geometryError: null,
    semanticValidation: null,
  };

  return {
    objectId,
    objectType: 'geometry',
    geometrySubtype: 'flowchart',
    sourcePage,
    provenance,
    confidence,

    // Text parsing alone does not establish structural validation.
    verificationStatus: 'raw',

    // The result remains uncertain until visual and topological verification.
    isUncertain: true,

    // No editable geometric reconstruction has been performed.
    editabilityGrade: 'E0',

    nodes,
    edges,
  };
}