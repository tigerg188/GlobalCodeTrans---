import { parseFlowchartBlock, isAseanDesignationProcedure } from '../components/OfficialDocLayoutComponents';

// Test Case 1: Legitimate ASEAN EE MRA designation procedure
const case1_asean = `
title: 指定申请程序流程图 (Application Procedure for Designation Flow Chart)
caption: 图示：合格评定机构（CAB）指定申请与审批程序流程图
notes: * CAB 指已列名的合格评定机构 (LISTED CAB) | * COD 意为指定证书 (Certificate of Designation)
steps:
1. START 开始
2. CAB向指定机构(DB)提交申请文件与申请费
3. 文件评估是否合格？ [No] -> CAB纠正不符合项 -> 步骤3
4. 现场评估是否合格？ [No] -> CAB纠正不符合项 -> 步骤4
5. 指定机构(DB)通过东盟秘书处向联合委员会(JSC)提名CAB
6. 联合委员会(JSC)审议CAB列名资格？ [No] -> 返回步骤5
7. 联合委员会列名并由DB颁发指定证书(COD)
8. 东盟秘书处将列名CAB录入注册名录
9. END 结束
`;

// Test Case 2: Bridge load combination evaluation (Engineering calculation)
const case2_bridge = `
title: 桥梁荷载组合与极限状态验算流程 (Bridge Load Combination & Limit State Verification)
caption: 图示：公路桥梁结构承载能力极限状态验算流程图
steps:
1. 恒载与可变荷载效应计算 (Dead & Live Load Calculation)
2. 基本荷载组合效应设计值计算 (Load Combination)
3. 承载能力极限状态是否满足？ [No] -> 调整截面尺寸并重新验算 -> 步骤1
4. 正常使用极限状态裂缝宽度验算 (Serviceability Limit State Verification)
5. 结构设计验算完成，形成计算报告 (Calculation Report)
`;

// Test Case 3: Electrical system fault diagnosis (Decision branching with loopback)
const case3_electrical = `
title: 高压断路器控制回路故障诊断流程 (Circuit Breaker Fault Diagnosis Flow)
caption: 图示：变电站断路器分合闸回路异常排查流程
steps:
1. 监控系统发出断路器控制回路断线告警 (Control Circuit Wire-Break Alarm)
2. 测量控制回路直流母线电压是否正常？ [No] -> 检查直流配电屏熔断器与空气开关 -> 步骤1
3. 检查断路器辅助触点分合状态是否到位？ [No] -> 机械连杆机构润滑维护与微动开关校准 -> 步骤2
4. 告警信号复归，恢复主设备受控运行 (Restore Normal Operation)
`;

// Test Case 4: Quality management & conformity assessment (Contains "合格评定", MUST NOT trigger ASEAN template)
const case4_qa = `
title: ISO 9001 质量管理体系不合格品审理与合格评定流程
caption: 图示：工程材料进场合格评定与不合格品处置程序
steps:
1. 进场批次抽样检测与技术指标评定 (Conformity Assessment & Material Sampling)
2. 检测指标是否符合设计规范要求？ [No] -> 标记退场并启动质量调查程序 -> 步骤1
3. 监理工程师签署合格评定放行单 (Conformity Sign-Off)
4. 原材料进入施工库房投料使用 (Proceed to Storage)
`;

// Test Case 5: Multi-branch engineering change flow (Complex multidisciplinary flow)
const case5_engineering_change = `
title: 跨专业工程变更审批与图纸会签流程 (Engineering Change Order Flow)
caption: 图示：重大设计变更跨部门会签与实施闭环
steps:
1. 施工单位提出工程设计变更申请单 (ECO Application)
2. 结构专业审核计算指标是否通过？ [No] -> 重新核算受力并修改加固方案 -> 步骤1
3. 机电专业与造价专业协同会签是否同意？ [No] -> 调整管线空间布局与投资概算 -> 步骤2
4. 总监理工程师与建设单位主管审批签署 (Chief Engineer Approval)
5. 变更图纸正式归档并下发施工现场执行 (Archive & Field Execution)
`;

let failureCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    failureCount++;
  } else {
    console.log(`✅ [PASS] ${testName}`);
  }
}

console.log('====================================================');
console.log('       A1 流程图分流回归验证测试 (A1 Flowchart Regression)      ');
console.log('====================================================\n');

// 1. Test isAseanDesignationProcedure predicate
console.log('--- 1. 判定函数 isAseanDesignationProcedure 纯谓词测试 ---');
assert(isAseanDesignationProcedure(case1_asean) === true, 'Case 1 应识别为东盟指定程序');
assert(isAseanDesignationProcedure(case2_bridge) === false, 'Case 2 (桥梁荷载) 绝不能被识别为东盟程序');
assert(isAseanDesignationProcedure(case3_electrical) === false, 'Case 3 (电力故障) 绝不能被识别为东盟程序');
assert(isAseanDesignationProcedure(case4_qa) === false, 'Case 4 (含“合格评定”关键词) 绝不能被误判为东盟程序');
assert(isAseanDesignationProcedure(case5_engineering_change) === false, 'Case 5 (多分支工程变更) 绝不能被误判为东盟程序');

// Test explicit override directives
assert(isAseanDesignationProcedure('template: generic\n1. 步骤一\n2. 步骤二') === false, '显式 template: generic 必须为 false');
assert(isAseanDesignationProcedure('type: asean-designation\n1. 步骤一\n2. 步骤二') === true, '显式 type: asean-designation 必须为 true');

// 2. Test parseFlowchartBlock output structure
console.log('\n--- 2. parseFlowchartBlock 解析结构与文本污染检测 ---');

const res1 = parseFlowchartBlock(case1_asean);
assert(res1.isDesignationProcedure === true, 'Case 1 解析结果 isDesignationProcedure 为 true');
assert(res1.title.includes('指定申请程序流程图'), 'Case 1 标题为指定申请程序流程图');

const res2 = parseFlowchartBlock(case2_bridge);
assert(res2.isDesignationProcedure === false, 'Case 2 解析结果 isDesignationProcedure 为 false');
assert(res2.title.includes('桥梁荷载组合'), 'Case 2 标题正确保留自身标题');
assert(!JSON.stringify(res2).includes('CAB rectifies discrepancies'), 'Case 2 绝不含 CAB rectifies discrepancies');
assert(!JSON.stringify(res2).includes('东盟秘书处'), 'Case 2 绝不含 东盟秘书处');
assert(res2.steps.length === 5, 'Case 2 保持原有 5 步流程，未被替换为 9 步模版');

const res3 = parseFlowchartBlock(case3_electrical);
assert(res3.isDesignationProcedure === false, 'Case 3 解析结果 isDesignationProcedure 为 false');
assert(res3.title.includes('高压断路器'), 'Case 3 标题正确保留自身标题');
assert(!JSON.stringify(res3).includes('CAB rectifies discrepancies'), 'Case 3 绝不含 CAB rectifies discrepancies');
assert(!JSON.stringify(res3).includes('COD'), 'Case 3 绝不含 COD 证书');
assert(res3.steps.length === 4, 'Case 3 保持原有 4 步流程');

const res4 = parseFlowchartBlock(case4_qa);
assert(res4.isDesignationProcedure === false, 'Case 4 解析结果 isDesignationProcedure 为 false (即使标题含“合格评定”)');
assert(res4.title.includes('ISO 9001'), 'Case 4 标题正确保留自身标题');
assert(!JSON.stringify(res4).includes('CAB rectifies discrepancies'), 'Case 4 绝不含 CAB rectifies discrepancies');
assert(!JSON.stringify(res4).includes('JSC'), 'Case 4 绝不含 JSC 联合委员会');
assert(res4.steps.length === 4, 'Case 4 保持原有 4 步流程');

const res5 = parseFlowchartBlock(case5_engineering_change);
assert(res5.isDesignationProcedure === false, 'Case 5 解析结果 isDesignationProcedure 为 false');
assert(res5.title.includes('跨专业工程变更'), 'Case 5 标题正确保留自身标题');
assert(!JSON.stringify(res5).includes('CAB rectifies discrepancies'), 'Case 5 绝不含 CAB rectifies discrepancies');
assert(!JSON.stringify(res5).includes('指定机构(DB)'), 'Case 5 绝不含 指定机构(DB)');
assert(res5.steps.length === 5, 'Case 5 保持原有 5 步流程');

// 3. Step 3 & Step 4 default action non-contamination test
console.log('\n--- 3. 步骤 3 & 4 默认动作防污染测试 ---');
const genericWithDecisionAtStep3 = `
title: 测试第3步为判断的通用流程
steps:
1. 开始
2. 数据采集
3. 温度是否超标？
4. 告警通知
5. 结束
`;
const resStep3 = parseFlowchartBlock(genericWithDecisionAtStep3);
assert(resStep3.isDesignationProcedure === false, '普通含步骤3判定的流程 isDesignationProcedure 为 false');
const step3 = resStep3.steps.find(s => s.stepNumber === 3);
assert(step3 !== undefined, '找到步骤 3');
assert(step3?.noBranchAction === '', `普通流程步骤3未提供[No]时，noBranchAction 应为空字符串，实测: "${step3?.noBranchAction}"`);
assert(!step3?.noBranchAction?.includes('CAB'), '普通流程步骤3绝不被注入 CAB 文本');

console.log('\n====================================================');
if (failureCount === 0) {
  console.log('🎉 全部 21 项回归断言 100% 通过！无错误分流，无文本污染。');
  console.log('====================================================');
  process.exit(0);
} else {
  console.error(`💥 存在 ${failureCount} 项断言失败，请检查逻辑！`);
  console.log('====================================================');
  process.exit(1);
}
