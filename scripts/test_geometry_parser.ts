/**
 * Verification script for V1.7 Phase 2: General Geometry & Flowchart Topological Parser
 */

import { parseFlowchartToGeometryIR } from '../utils/documentIRParser';

function runGeometryParserTests() {
  console.log('=== GlobalCodeTrans V1.7 Phase 2: 通用几何与流程图拓扑解析测试 ===\n');

  const sampleFlowchartMarkdown = `
title: 通用工程合规审批流程图
steps:
  - 1. START: 开始申请
  - 2. 申请人提交技术文件与资质证明 (Applicant submits tech files)
  - 3. 审查机构评估是否符合技术规范？ [Yes] -> 步骤4 | [No] -> 申请人补充修改资料并返回步骤3
  - 4. 现场实地核查与测试 (Site verification and testing)
  - 5. END: 审批通过归档结束
  `;

  const geometryIR = parseFlowchartToGeometryIR(sampleFlowchartMarkdown, { objectId: 'test-geom-001', sourcePage: 12 });

  console.log('Parsed GeometryIR Result:');
  console.log(`  - Object ID: ${geometryIR.objectId}`);
  console.log(`  - Subtype: ${geometryIR.geometrySubtype}`);
  console.log(`  - Total Nodes: ${geometryIR.nodes.length}`);
  geometryIR.nodes.forEach(n => console.log(`    * [Node ${n.id}] type: ${n.type}, text: ${n.originalText}`));
  console.log(`  - Total Edges: ${geometryIR.edges.length}`);
  geometryIR.edges.forEach(e => console.log(`    * [Edge ${e.id}] ${e.fromNodeId} -> ${e.toNodeId} (condition: ${e.condition}, label: ${e.label}, loopback: ${e.isLoopback})`));
  console.log(`  - Confidence Extraction Quality: ${geometryIR.confidence.extractionQuality}`);
  console.log(`  - Verification Status: ${geometryIR.verificationStatus}`);
  console.log(`  - Editability Grade: ${geometryIR.editabilityGrade}`);

  if (geometryIR.nodes.length === 5 && geometryIR.edges.length >= 4) {
    console.log('\n✅ V1.7 Phase 2 Geometry & Topological Parser Verified Successfully!');
  } else {
    throw new Error('Geometry parser validation assertion failed.');
  }
}

runGeometryParserTests();
