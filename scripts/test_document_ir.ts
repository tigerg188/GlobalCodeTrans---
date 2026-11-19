/**
 * Verification script for V1.7 Phase 1 DocumentIR
 * Tests IR data structures, sub-typing, multi-dimensional confidence, editability grading, and audit utility.
 */

import { DocumentIRContainer, auditDocumentIR, FormulaIR, ChartIR, GeometryIR } from '../types/documentIR';

function runDocumentIRTests() {
  console.log('=== GlobalCodeTrans V1.7 Phase 1: DocumentIR 契约验证 ===\n');

  const sampleIR: DocumentIRContainer = {
    documentId: 'doc-sample-001',
    metadata: {
      title: '老挝国家抗震设计与合规规程',
      sourceLang: '老挝语',
      targetLang: '中文 (简体)',
      totalPages: 3,
      createdAt: Date.now()
    },
    elements: [
      {
        objectId: 'elem-formula-1',
        objectType: 'formula',
        sourcePage: 19,
        rawLatex: 'S_a = S_{DS} \\left( 0.4 + 0.6 \\frac{T}{T_0} \\right)',
        provenance: 'gemini_multimodal',
        confidence: {
          modelConfidence: 0.95,
          extractionQuality: 0.90,
          geometryError: 0.02,
          semanticValidation: true
        },
        verificationStatus: 'structural_validated',
        isUncertain: false,
        editabilityGrade: 'E1', // Word native OMML formula
        numbering: '(6.6)'
      } as FormulaIR,
      {
        objectId: 'elem-chart-1',
        objectType: 'chart',
        sourcePage: 19,
        chartType: 'response_spectrum',
        title: '设计反应谱',
        caption: '图示：设计加速度反应谱曲线',
        parameters: { SDS: 1.05, SD1: 0.42, T0: 0.08, Ts: 0.40 },
        hasExplicitParameters: true,
        provenance: 'opencv_geometry',
        confidence: {
          modelConfidence: 0.92,
          extractionQuality: 0.85,
          geometryError: 0.05,
          semanticValidation: true
        },
        verificationStatus: 'structural_validated',
        isUncertain: false,
        editabilityGrade: 'E2' // Vector SVG / Chart
      } as ChartIR,
      {
        objectId: 'elem-geom-1',
        objectType: 'geometry',
        sourcePage: 25,
        geometrySubtype: 'flowchart',
        nodes: [
          { id: 'n1', type: 'start', originalText: 'ເລີ່ມຕົ້ນ', translatedText: '开始 (START)' },
          { id: 'n2', type: 'decision', originalText: 'ກວດສອບເອກະສານ?', translatedText: '文件评估是否合格？' }
        ],
        edges: [
          { id: 'e1', fromNodeId: 'n1', toNodeId: 'n2', isLoopback: false }
        ],
        provenance: 'gemini_multimodal',
        confidence: {
          modelConfidence: 0.88,
          extractionQuality: 0.75,
          geometryError: 0.10,
          semanticValidation: false
        },
        verificationStatus: 'raw',
        isUncertain: true,
        editabilityGrade: 'E0' // Unreconstructed fallback
      } as GeometryIR
    ]
  };

  const auditResult = auditDocumentIR(sampleIR);
  console.log('DocumentIR Audit Summary:');
  console.log(`  - Total Elements: ${auditResult.totalElements}`);
  console.log(`  - Grade Breakdown:`, auditResult.gradeBreakdown);
  console.log(`  - Uncertain Count: ${auditResult.uncertainCount}`);
  console.log(`  - Unverified Count: ${auditResult.unverifiedCount}`);

  if (auditResult.totalElements === 3 && auditResult.gradeBreakdown.E1 === 1 && auditResult.gradeBreakdown.E2 === 1 && auditResult.gradeBreakdown.E0 === 1) {
    console.log('\n✅ DocumentIR Contract & Audit Utility Verified Successfully!');
  } else {
    throw new Error('DocumentIR verification failed assertion count.');
  }
}

runDocumentIRTests();
