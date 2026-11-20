/**
 * GlobalCodeTrans V1.7 - Document Intermediate Representation (DocumentIR)
 *
 * Unified data contract for document objects.
 *
 * Confidence values may be null when a metric has not actually been measured.
 * Unknown values must never be represented as fabricated numeric scores.
 */

export type EditabilityGrade = 'E1' | 'E2' | 'E3' | 'E0';

export type ProvenanceSource =
  | 'pdf_native_vector'
  | 'ocr_text'
  | 'gemini_multimodal'
  | 'opencv_geometry'
  | 'manual_correction';

export type VerificationStatus =
  | 'raw'
  | 'structural_validated'
  | 'conflict'
  | 'human_verified';

/**
 * Multi-dimensional confidence and measurement record.
 *
 * null means "not measured / not available".
 *
 * It does NOT mean zero confidence, zero extraction quality,
 * zero geometry error, or a failed measurement.
 */
export interface MultiDimensionalConfidence {
  /** Model self-reported confidence (0.0 - 1.0); null if unavailable. */
  modelConfidence: number | null;

  /** Algorithmic extraction completeness (0.0 - 1.0); null if not measured. */
  extractionQuality: number | null;

  /** Spatial/pixel measurement deviation; null if not measured. */
  geometryError: number | null;

  /** Whether semantic validation was actually performed and passed.
   *  null = not evaluated; false = evaluated and failed; true = passed.
   */
  semanticValidation: boolean | null;
}

export interface BaseIRObject {
  objectId: string;
  objectType: 'formula' | 'chart' | 'geometry' | 'annotation' | 'paragraph' | 'table';
  sourcePage: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  provenance: ProvenanceSource;
  confidence: MultiDimensionalConfidence;
  verificationStatus: VerificationStatus;
  isUncertain: boolean;
  editabilityGrade: EditabilityGrade;
}

export interface FormulaIR extends BaseIRObject {
  objectType: 'formula';
  rawLatex: string;
  ommlXml?: string;
  variables?: { name: string; description: string; unit?: string }[];
  numbering?: string;
}

export interface ChartIR extends BaseIRObject {
  objectType: 'chart';
  chartType: 'response_spectrum' | 'wind_pressure' | 'line' | 'bar' | 'pie' | 'engineering_diagram';
  title: string;
  caption: string;
  parameters: Record<string, number | string>;
  dataSeries?: { name: string; x: number[]; y: number[]; unit?: string }[];
  hasExplicitParameters: boolean;
}

export interface GeometryNode {
  id: string;
  type: 'start' | 'process' | 'decision' | 'end' | 'connector' | 'subroutine';
  originalText: string;
  translatedText: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface GeometryEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  condition?: 'yes' | 'no' | 'unconditional' | 'custom';
  label?: string;
  isLoopback: boolean;
}

export interface GeometryIR extends BaseIRObject {
  objectType: 'geometry';
  geometrySubtype: 'flowchart' | 'structural_diagram' | 'cross_section';
  nodes: GeometryNode[];
  edges: GeometryEdge[];
}

export interface AnnotationIR extends BaseIRObject {
  objectType: 'annotation';
  annotationType: 'dimension_line' | 'leader_line' | 'arrow' | 'bubble' | 'note';
  textValue?: string;
  targetReference?: string;
}

export interface TextParagraphIR extends BaseIRObject {
  objectType: 'paragraph';
  originalText: string;
  translatedText: string;
  headingLevel?: number;
  isBold?: boolean;
  isUnderline?: boolean;
}

export type DocumentElementIR =
  | FormulaIR
  | ChartIR
  | GeometryIR
  | AnnotationIR
  | TextParagraphIR;

export interface DocumentIRContainer {
  documentId: string;
  metadata: {
    title: string;
    sourceLang: string;
    targetLang: string;
    totalPages: number;
    createdAt: number;
  };
  elements: DocumentElementIR[];
}

/**
 * Validates a DocumentIR container and returns an audit summary.
 */
export function auditDocumentIR(ir: DocumentIRContainer): {
  totalElements: number;
  gradeBreakdown: Record<EditabilityGrade, number>;
  uncertainCount: number;
  unverifiedCount: number;
} {
  const breakdown: Record<EditabilityGrade, number> = {
    E1: 0,
    E2: 0,
    E3: 0,
    E0: 0,
  };

  let uncertain = 0;
  let unverified = 0;

  for (const el of ir.elements) {
    if (breakdown[el.editabilityGrade] !== undefined) {
      breakdown[el.editabilityGrade]++;
    }

    if (el.isUncertain) {
      uncertain++;
    }

    if (
      el.verificationStatus === 'raw' ||
      el.verificationStatus === 'conflict'
    ) {
      unverified++;
    }
  }

  return {
    totalElements: ir.elements.length,
    gradeBreakdown: breakdown,
    uncertainCount: uncertain,
    unverifiedCount: unverified,
  };
}