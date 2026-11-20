/**
 * GlobalCodeTrans V1.7
 *
 * Synthetic Text Fixture Test
 *
 * This test verifies textual parsing behavior only.
 *
 * It does NOT verify:
 * - Real PDF flowchart recognition
 * - Image-based node detection
 * - Arrow coordinate extraction
 * - Geometric reconstruction
 * - Visual topology accuracy
 *
 * Do not report this test as a real-sample recognition benchmark.
 */

import { parseFlowchartToGeometryIR } from '../utils/documentIRParser';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`TEST FAILED: ${message}`);
  }
}

function runGeometryParserTests(): void {
  console.log(
    '=== GlobalCodeTrans: Synthetic Flowchart Text Parser Tests ===\n'
  );

  const sampleFlowchartMarkdown = `
title: Synthetic engineering approval flowchart
steps:
  - 1. START: Application begins
  - 2. Applicant submits technical documents
  - 3. Does the application meet technical requirements? [Yes] -> Step 4 | [No] -> Applicant corrects documents and returns to Step 3
  - 4. Site inspection and testing
  - 5. END: Approval completed and archived
`;

  const geometryIR = parseFlowchartToGeometryIR(
    sampleFlowchartMarkdown,
    {
      objectId: 'test-geom-001',
      sourcePage: 12,
    }
  );

  console.log('Parsed textual GeometryIR:');

  console.log(`  Object ID: ${geometryIR.objectId}`);
  console.log(`  Subtype: ${geometryIR.geometrySubtype}`);
  console.log(`  Nodes: ${geometryIR.nodes.length}`);
  console.log(`  Edges: ${geometryIR.edges.length}`);

  geometryIR.nodes.forEach(node => {
    console.log(
      `  Node: ${node.id} | ${node.type} | ${node.originalText}`
    );
  });

  geometryIR.edges.forEach(edge => {
    console.log(
      `  Edge: ${edge.fromNodeId} -> ${edge.toNodeId}` +
      ` | condition=${edge.condition}` +
      ` | loopback=${edge.isLoopback}`
    );
  });

  /**
   * Test 1:
   * Five textual nodes should be parsed.
   */
  assert(
    geometryIR.nodes.length === 5,
    'Expected exactly five textual nodes.'
  );

  /**
   * Test 2:
   * Explicit Yes branch should point to existing node-4.
   */
  const yesEdge = geometryIR.edges.find(
    edge =>
      edge.fromNodeId === 'node-3' &&
      edge.condition === 'yes'
  );

  assert(
    yesEdge !== undefined,
    'Explicit Yes branch was not parsed.'
  );

  assert(
    yesEdge.toNodeId === 'node-4',
    'Yes branch should point to explicitly referenced node-4.'
  );

  /**
   * Test 3:
   * Explicit No branch should point back to node-3.
   */
  const noEdge = geometryIR.edges.find(
    edge =>
      edge.fromNodeId === 'node-3' &&
      edge.condition === 'no'
  );

  assert(
    noEdge !== undefined,
    'Explicit No branch was not parsed.'
  );

  assert(
    noEdge.toNodeId === 'node-3',
    'No branch should point to explicitly referenced node-3.'
  );

  assert(
    noEdge.isLoopback === true,
    'Return-to-step branch should be marked as loopback.'
  );

  /**
   * Test 4:
   * No nonexistent target nodes may be referenced.
   */
  const existingNodeIds = new Set(
    geometryIR.nodes.map(node => node.id)
  );

  for (const edge of geometryIR.edges) {
    assert(
      existingNodeIds.has(edge.fromNodeId),
      `Edge source does not exist: ${edge.fromNodeId}`
    );

    assert(
      existingNodeIds.has(edge.toNodeId),
      `Edge target does not exist: ${edge.toNodeId}`
    );
  }

  /**
   * Test 5:
   * No implicit sequential edges should be generated.
   */
  assert(
    !geometryIR.edges.some(
      edge =>
        edge.fromNodeId === 'node-1' ||
        edge.fromNodeId === 'node-2' ||
        edge.fromNodeId === 'node-4'
    ),
    'Parser must not automatically create sequential edges.'
  );

  /**
   * Test 6:
   * Text parsing must not fabricate confidence measurements.
   */
  assert(
    geometryIR.confidence.modelConfidence === null,
    'Model confidence should remain null when not measured.'
  );

  assert(
    geometryIR.confidence.extractionQuality === null,
    'Extraction quality should remain null when not measured.'
  );

  assert(
    geometryIR.confidence.geometryError === null,
    'Geometry error should remain null when not measured.'
  );

  assert(
    geometryIR.confidence.semanticValidation === null,
    'Semantic validation should remain null when not performed.'
  );

  /**
   * Test 7:
   * Text-only parsing must not claim geometric validation.
   */
  assert(
    geometryIR.verificationStatus === 'raw',
    'Text parser must not claim structural validation.'
  );

  assert(
    geometryIR.editabilityGrade === 'E0',
    'Text parser must not claim editable vector reconstruction.'
  );

  assert(
    geometryIR.isUncertain === true,
    'Text-only result must remain uncertain.'
  );

  /**
   * Test 8:
   * Descriptive branch destinations without explicit node references
   * must not generate fabricated edges.
   */
  const incompleteBranchInput = `
1. Does the document pass inspection? [No] -> Applicant must revise the document
2. END: Process completed
`;

  const incompleteIR = parseFlowchartToGeometryIR(
    incompleteBranchInput,
    {
      objectId: 'test-geom-incomplete-001',
    }
  );

  assert(
    incompleteIR.edges.length === 0,
    'A descriptive branch without an explicit node target must not create an edge.'
  );

  /**
   * Test 9:
   * A reference to a nonexistent node must not generate an edge.
   */
  const missingTargetInput = `
1. Does the document pass inspection? [Yes] -> Step 99
2. END: Process completed
`;

  const missingTargetIR = parseFlowchartToGeometryIR(
    missingTargetInput,
    {
      objectId: 'test-geom-missing-target-001',
    }
  );

  assert(
    missingTargetIR.edges.length === 0,
    'A branch pointing to a nonexistent node must not create an edge.'
  );

  console.log('\nAll synthetic text parser tests passed.');

  console.log(
    'NOTICE: These tests do not establish real image/PDF recognition accuracy.'
  );
}

runGeometryParserTests();