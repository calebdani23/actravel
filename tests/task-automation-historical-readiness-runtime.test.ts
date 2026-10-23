import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { canonicalHash, canonicalJson, deterministicTaskUuid } from "../lib/admin/task-automation-historical-contract"
import { readTaskAutomationHistoricalReadiness, type HistoricalReadinessRpcArgs } from "../lib/admin/task-automation-historical-readiness"
import type { Database, Json } from "../lib/supabase/database.types"
import { actorSession, applyMigration, migrationNames, prepareBaseDatabase, psql, sqlLiteral, withPostgresContainer } from "./helpers/postgres-runtime"

const enabled = process.env.RUN_TASK_AUTOMATION_HISTORICAL_DB_TESTS === "1"
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false
type Assert<T extends true> = T
type ReadinessRpc = Database["public"]["Functions"]["read_task_automation_historical_readiness"]
const typeProof: [Assert<Equal<ReadinessRpc["Args"], { p_request_id_text: string; p_expected_actor_id: string }>>, Assert<Equal<ReadinessRpc["Returns"], Json>>] = [true, true]
const uuid = (prefix: number, value: number) => `${prefix}0000000-0000-4000-8000-${String(value).padStart(12, "0")}`
const admin=uuid(1,501), inactive=uuid(1,502), advisor=uuid(1,503), owner=uuid(1,504), otherOwner=uuid(1,505)
const contact=uuid(2,501), status=uuid(3,501), request=uuid(6,501), readyRequest=uuid(6,502), missingRequest=uuid(6,503)
const approvalId=uuid(7,501), readyApprovalId=uuid(7,502), receiptId=uuid(8,501), readyReceiptId=uuid(8,502)
const at="2026-01-05T15:00:00.000000Z", due="2026-01-05T15:15:00.000000Z", storedAt="2026-09-27T12:00:00.000000Z"
const cutoffs={opportunityAssignment:"2026-09-01T00:00:00.000000Z",quoteSent:"2026-09-01T00:00:00.000000Z"}
const snapshots={opportunityRoots:null,quoteVersionRoots:null,assignmentEvidence:null,quoteSourceEvidence:null,taskOccupancy:null,automationOrigins:null,automationOutcomes:null,automationTombstones:null}
const projectionKeys=["ordinal","action","operationSourceKind","operationSourceId","sourceKey","sourceOrder","originKey","taskId","taskKind","ownerId","opportunityId","quoteId","quoteVersionId","sentEventId","anchorAt","dueRuleVersion","dueAt","outcomeKey","tombstoneKey"] as const
const dispositions=["apply/generate","apply/suppress","already/projected","already/suppressed","excluded/not-actionable","manual-review/owner-invalid","manual-review/context-invalid","collision/manual-review"] as const
const reasons=["ELIGIBLE_GENERATE","SOURCE_INVALIDATED","ALREADY_PROJECTED","ALREADY_SUPPRESSED","OPPORTUNITY_NOT_OPERATIONAL","PROFILE_INACTIVE","ASSIGNMENT_EVIDENCE_MISSING","IDENTITY_OCCUPIED"] as const
const actionFor=(index:number)=>index===0?"generate":index===1?"suppress":null
const rows=dispositions.map((disposition,index)=>{
  const rootId=uuid(4,index+501), generate=index===0||index===2, suppress=index===1||index===3
  const operationSourceKind=generate?"opportunity_assignment":suppress?"opportunity_unassigned":null
  const sourceKey=operationSourceKind?canonicalHash(["task-automation-source.v1",operationSourceKind,rootId,at]):null
  const originKey=operationSourceKind?canonicalHash(["task-automation:v1","first_contact",rootId]):null
  const action=actionFor(index), operation=generate?"generate":suppress?"suppress":null
  return {ordinal:index,sourceKind:"opportunity_assignment",rootId,anchorAt:at,sourceId:rootId,ownerId:generate?owner:null,opportunityId:rootId,quoteId:null,quoteVersionId:null,sentEventId:null,disposition,reason:reasons[index],action,
    operationSourceKind,operationSourceId:operationSourceKind?rootId:null,sourceKey,sourceOrder:operationSourceKind?1:null,originKey,taskId:generate?deterministicTaskUuid(originKey!):null,taskKind:generate?"first_contact":null,dueRuleVersion:generate?"mx-calendar.v1":null,dueAt:generate?due:null,
    outcomeKey:operationSourceKind?canonicalHash(["task-automation-outcome.v1",operationSourceKind,rootId,sourceKey,operation,originKey]):null,tombstoneKey:suppress?canonicalHash(["task-automation-tombstone.v1",operationSourceKind,rootId,sourceKey,1,originKey,"source_invalidated"]):null}
})
const bytes=(value:unknown)=>Buffer.byteLength(canonicalJson(value),"utf8")
const projection=(row:typeof rows[number],action:string)=>Object.fromEntries(projectionKeys.map((key)=>[key,key==="action"?action:row[key]]))
function approval(planRows: typeof rows, requestId:string, id:string) {
  const normalized=planRows.map((row,index)=>({...row,ordinal:index})), counts=dispositions.map((value)=>normalized.filter((row)=>row.disposition===value).length)
  const projections=normalized.filter((row)=>row.action).map((row)=>projection(row,row.action!))
  const plan={schema:"task-automation-historical-plan.v1",ruleVersion:"task-automation-historical.v1",sourceCutoffs:cutoffs,snapshotCutoffs:snapshots,snapshotHash:"8".repeat(64),rows:normalized,counts,totalCount:normalized.length}
  const planHash=canonicalHash(plan), projectionHash=canonicalHash(projections), preimage=["task-automation-historical-approval-request.v1",requestId,admin,"admin","task-automation-historical-preview.v1","task-automation-historical.v1",cutoffs,snapshots,plan.snapshotHash,planHash,projectionHash,plan,projections]
  const base={id,request_id:requestId,actor_id:admin,actor_role:"admin",schema_version:"task-automation-historical-approval.v1",preview_schema:"task-automation-historical-preview.v1",rule_version:"task-automation-historical.v1",source_cutoffs:cutoffs,snapshot_cutoffs:snapshots,snapshot_hash:plan.snapshotHash,plan,plan_hash:planHash,projections,projection_hash:projectionHash,request_fingerprint:canonicalHash(preimage),approval_fingerprint:"",
    apply_generate_count:counts[0],apply_suppress_count:counts[1],already_projected_count:counts[2],already_suppressed_count:counts[3],excluded_not_actionable_count:counts[4],manual_review_owner_invalid_count:counts[5],manual_review_context_invalid_count:counts[6],collision_manual_review_count:counts[7],total_count:normalized.length,row_count:normalized.length,generate_count:counts[0],suppress_count:counts[1],projection_count:projections.length,plan_byte_count:bytes(plan),projection_byte_count:bytes(projections),request_byte_count:bytes(preimage),created_at:storedAt}
  base.approval_fingerprint=canonicalHash(["task-automation-historical-approval-fingerprint.v1",id,requestId,admin,"admin",base.schema_version,base.preview_schema,base.rule_version,cutoffs,snapshots,base.snapshot_hash,planHash,projectionHash,base.request_fingerprint,plan,projections,counts,base.total_count,base.row_count,base.generate_count,base.suppress_count,base.projection_count,base.plan_byte_count,base.projection_byte_count,base.request_byte_count,storedAt])
  return base
}
function receipt(value:ReturnType<typeof approval>, id:string) {
  const applied=value.plan.rows.filter((row)=>row.action), generated=applied.filter((row)=>row.action==="generate"), suppressed=applied.filter((row)=>row.action==="suppress")
  const result={schema:"task-automation-historical-apply-result.v1",requestId:value.request_id,approvalId:value.id,actorId:admin,planHash:value.plan_hash,projectionHash:value.projection_hash,taskIds:generated.map((row)=>row.taskId),originKeys:generated.map((row)=>row.originKey),outcomeKeys:applied.map((row)=>row.outcomeKey),tombstoneKeys:suppressed.map((row)=>row.tombstoneKey),generatedCount:generated.length,suppressedCount:suppressed.length,projectionCount:applied.length}
  return {id,request_id:value.request_id,approval_id:value.id,actor_id:admin,approval_fingerprint:value.approval_fingerprint,plan_hash:value.plan_hash,projection_hash:value.projection_hash,task_ids:result.taskIds,origin_keys:result.originKeys,outcome_keys:result.outcomeKeys,tombstone_keys:result.tombstoneKeys,generated_count:result.generatedCount,suppressed_count:result.suppressedCount,projection_count:result.projectionCount,result,result_hash:canonicalHash(result),result_byte_count:bytes(result),created_at:storedAt}
}
const record=(table:string,value:unknown)=>`insert into public.${table} select row.* from jsonb_populate_record(null::public.${table},${sqlLiteral(JSON.stringify(value))}::jsonb) row;`
const scalar=(value:string)=>value.split(/\r?\n/).filter(Boolean).at(-1)!
const expectedOutcomes=["generated","suppressed","already_projected","already_suppressed","excluded_not_actionable","manual_review_owner_invalid","manual_review_context_invalid","collision_manual_review"]
const adapterCounts={applyGenerate:1,applySuppress:1,alreadyProjected:1,alreadySuppressed:1,excludedNotActionable:1,manualReviewOwnerInvalid:1,manualReviewContextInvalid:1,collisionManualReview:1,receiptGenerated:1,receiptSuppressed:1,plannedWrites:2,receiptWrites:2,taskBacked:2,suppressed:2,intentionalNoWrite:1,unresolvedManualReview:3,total:8}
const adapterRows=rows.map((row,index)=>({ordinal:index,sourceKind:row.sourceKind,rootId:row.rootId,disposition:row.disposition,outcome:expectedOutcomes[index],taskId:row.taskId,originKey:row.originKey,outcomeKey:row.outcomeKey,tombstoneKey:row.tombstoneKey}))
const adapterSuccess=(overrides:Record<string,unknown>={})=>({ok:true,request_id:request,approval_id:approvalId,apply_receipt_id:receiptId,ready:false,counts:adapterCounts,rows:adapterRows,...overrides})
const adapterAuth=(events?:string[])=>({createAuthClient:async()=>{events?.push("auth");return{}},getUser:async()=>({data:{user:{id:admin}},error:null}),readProfile:async()=>({data:{id:admin,is_active:true},error:null}),readRoles:async()=>({data:[{roles:{name:"admin"}}],error:null})})

test("readiness adapter is auth-first and maps only the exact ordered accounting result",async()=>{
  const events:string[]=[]; let seen:HistoricalReadinessRpcArgs|undefined, persistence=0
  const noUser={createAuthClient:async()=>({}),getUser:async()=>({data:{user:null},error:null})}
  assert.deepEqual(await readTaskAutomationHistoricalReadiness({requestId:"bad",extra:true},{auth:noUser,createPersistenceClient:async()=>{throw new Error("must not construct")}}),{ok:false,error:{code:"AUTH_REQUIRED",message:"AUTH_REQUIRED"}})
  assert.deepEqual(await readTaskAutomationHistoricalReadiness({requestId:request,extra:true},{auth:adapterAuth(),createPersistenceClient:async()=>{persistence++;return{}}}),{ok:false,error:{code:"INVALID_REQUEST",message:"INVALID_REQUEST"}}); assert.equal(persistence,0)
  const value=await readTaskAutomationHistoricalReadiness({requestId:request},{auth:adapterAuth(events),createPersistenceClient:async()=>{events.push("persistence");return{}},invokeRpc:async(_client,args)=>{events.push("rpc");seen=args;return{data:adapterSuccess(),error:null}}})
  assert.deepEqual(events,["auth","persistence","rpc"]); assert.deepEqual(seen,{p_request_id_text:request,p_expected_actor_id:admin}); assert.equal(value.ok,true)
  if(value.ok){assert.deepEqual(Object.keys(value),["ok","requestId","approvalId","applyReceiptId","ready","counts","rows"]);assert.deepEqual(value.counts,adapterCounts);assert.deepEqual(value.rows,adapterRows)}
})

test("readiness adapter preserves domain failures and suppresses malformed provider data",async()=>{
  const invoke=(data:unknown,error:unknown=null)=>readTaskAutomationHistoricalReadiness({requestId:request},{auth:adapterAuth(),createPersistenceClient:async()=>({}),invokeRpc:async()=>({data,error})})
  const codes=["AUTH_REQUIRED","AUTH_INACTIVE","AUTH_NOT_ADMIN","AUTH_ACTOR_MISMATCH","INVALID_REQUEST","APPROVAL_NOT_FOUND","APPLY_RECEIPT_NOT_FOUND","APPROVAL_INTEGRITY_FAILURE","APPLY_RECEIPT_INTEGRITY_FAILURE","ROOT_ACCOUNTING_FAILURE","WRITE_PARITY_FAILURE","LIMIT_EXCEEDED"]
  for(const code of codes) assert.deepEqual(await invoke({ok:false,error:{code,message:code}}),{ok:false,error:{code,message:code}},code)
  const malformed=[{...adapterSuccess(),extra:true},adapterSuccess({request_id:missingRequest}),adapterSuccess({ready:true}),adapterSuccess({counts:{...adapterCounts,total:7}}),adapterSuccess({rows:[...adapterRows].reverse()}),adapterSuccess({rows:adapterRows.map((row,index)=>index?row:{...row,outcome:"provider secret"})}),{ok:false,error:{code:"WRITE_PARITY_FAILURE",message:"provider secret"}}]
  for(const value of malformed) assert.deepEqual(await invoke(value),{ok:false,error:{code:"PERSISTENCE_FAILURE",message:"PERSISTENCE_FAILURE"}})
  assert.deepEqual(await invoke(null,{message:"provider secret"}),{ok:false,error:{code:"PERSISTENCE_FAILURE",message:"PERSISTENCE_FAILURE"}})
})

test("0088 readiness is exact, deterministic, fail-closed, bounded, and read-only",{skip:!enabled,timeout:300_000},async()=>{
  assert.deepEqual(typeProof,[true,true])
  await withPostgresContainer(async()=>{
    const database="task_automation_historical_readiness"; prepareBaseDatabase(); psql("postgres",`create database ${database} template quote_base;`)
    const migrations=migrationNames().filter((name)=>Number(name.slice(0,4))>=57&&Number(name.slice(0,4))<=88)
    assert.equal(migrations.at(-1),"0088_task_automation_historical_readiness.sql"); for(const name of migrations) applyMigration(database,name)
    psql(database,`insert into auth.users(id,email) values ('${admin}','a@test'),('${inactive}','i@test'),('${advisor}','x@test'),('${owner}','o@test'),('${otherOwner}','o2@test'); insert into profiles(id,full_name,is_active) values ('${admin}','A',true),('${inactive}','I',false),('${advisor}','X',true),('${owner}','O',true),('${otherOwner}','O2',true); insert into roles(name,description) values ('admin','Admin'),('asesor','Advisor') on conflict(name) do nothing; insert into profile_roles(profile_id,role_id) select value.id,role.id from (values ('${admin}'::uuid,'admin'),('${inactive}'::uuid,'admin'),('${advisor}'::uuid,'asesor'),('${owner}'::uuid,'asesor'),('${otherOwner}'::uuid,'asesor')) value(id,name) join roles role on role.name=value.name; insert into contacts(id,first_name,email) values ('${contact}','Historical','h@test'); insert into lead_statuses(id,name,label_es,label_en) values ('${status}','readiness_open','Open','Open'); alter table leads disable trigger generate_first_contact_on_assignment; alter table leads disable trigger first_contact_invalidation_before_generation; insert into leads(id,contact_id,status_id,assigned_to,created_at) select id,'${contact}','${status}','${owner}','2026-01-05Z' from unnest(array[${rows.map((row)=>`'${row.rootId}'::uuid`).join(",")}]) id; alter table leads enable trigger generate_first_contact_on_assignment; alter table leads enable trigger first_contact_invalidation_before_generation;`)
    const approved=approval(rows,request,approvalId), readyApproved=approval([{...rows[4],ordinal:0}],readyRequest,readyApprovalId)
    psql(database,record("task_automation_historical_approvals",approved)+record("task_automation_historical_approvals",readyApproved))
    for(const [row,action] of [[rows[0],"generate"],[rows[1],"suppress"],[rows[2],"generate"],[rows[3],"suppress"]] as const) psql(database,`select public.task_automation_historical_write_${action==="generate"?"generate":"suppress"}(${sqlLiteral(JSON.stringify({...projection(row,action),...(action==="suppress"?{anchorAt:null}:{})}))}::jsonb);`)
    psql(database,record("task_automation_historical_apply_receipts",receipt(approved,receiptId)))
    const rpc=(value:string,expected=admin)=>`select public.read_task_automation_historical_readiness(${sqlLiteral(value)},'${expected}')::text;`, call=(value:string,actor:string|null=admin,expected=actor??admin)=>JSON.parse(scalar(psql(database,`${actor?actorSession(actor):""}${rpc(value,expected)}`))), code=(value:{error?:{code?:string}})=>value.error?.code
    assert.equal(code(call("BAD",null)),"AUTH_REQUIRED"); assert.equal(code(call("BAD",inactive)),"AUTH_INACTIVE"); assert.equal(code(call("BAD",advisor)),"AUTH_NOT_ADMIN"); assert.equal(code(call("BAD",admin,owner)),"AUTH_ACTOR_MISMATCH"); assert.equal(code(call("BAD")),"INVALID_REQUEST"); assert.equal(code(call(missingRequest)),"APPROVAL_NOT_FOUND"); assert.equal(code(call(readyRequest)),"APPLY_RECEIPT_NOT_FOUND")
    const first=call(request); assert.deepEqual(Object.keys(first).sort(),["approval_id","apply_receipt_id","counts","ok","ready","request_id","rows"].sort()); assert.equal(first.ready,false); assert.deepEqual(first.rows.map((row:{ordinal:number;rootId:string;outcome:string})=>[row.ordinal,row.rootId,row.outcome]),rows.map((row,index)=>[index,row.rootId,expectedOutcomes[index]])); assert.equal(new Set(first.rows.map((row:{rootId:string})=>row.rootId)).size,8)
    assert.deepEqual(first.counts,{applyGenerate:1,applySuppress:1,alreadyProjected:1,alreadySuppressed:1,excludedNotActionable:1,manualReviewOwnerInvalid:1,manualReviewContextInvalid:1,collisionManualReview:1,receiptGenerated:1,receiptSuppressed:1,plannedWrites:2,receiptWrites:2,taskBacked:2,suppressed:2,intentionalNoWrite:1,unresolvedManualReview:3,total:8}); assert.deepEqual(call(request),first)
    const snapshot=`select public.task_automation_historical_hash(jsonb_build_array((select jsonb_agg(to_jsonb(x) order by id) from tasks x),(select jsonb_agg(to_jsonb(x) order by origin_key) from task_automation_origins x),(select jsonb_agg(to_jsonb(x) order by outcome_key) from task_automation_outcomes x),(select jsonb_agg(to_jsonb(x) order by tombstone_key) from task_automation_tombstones x),(select jsonb_agg(to_jsonb(x) order by id) from task_automation_historical_approvals x),(select jsonb_agg(to_jsonb(x) order by id) from task_automation_historical_apply_receipts x)));`, before=psql(database,snapshot); call(request); assert.equal(psql(database,snapshot),before)
    const transactional=(change:string)=>JSON.parse(psql(database,`begin; ${change}; ${actorSession(admin)} ${rpc(request)} rollback;`).split(/\r?\n/).filter((line)=>line.startsWith("{")).at(-1)!)
    assert.equal(code(transactional(`alter table task_automation_historical_approvals disable trigger user; update task_automation_historical_approvals set plan_hash=repeat('0',64) where request_id='${request}'`)),"APPROVAL_INTEGRITY_FAILURE")
    assert.equal(code(transactional(`alter table task_automation_historical_apply_receipts disable trigger user; update task_automation_historical_apply_receipts set result_hash=repeat('0',64) where request_id='${request}'`)),"APPLY_RECEIPT_INTEGRITY_FAILURE")
    assert.equal(code(transactional(`alter table task_automation_outcomes disable trigger user; delete from task_automation_outcomes where outcome_key='${rows[0].outcomeKey}'`)),"WRITE_PARITY_FAILURE")
    assert.equal(code(transactional(`update tasks set owner_id='${otherOwner}' where id='${rows[0].taskId}'`)),"WRITE_PARITY_FAILURE")
    assert.equal(code(transactional(`alter table task_automation_historical_approvals disable trigger user; alter table task_automation_historical_approvals drop constraint task_automation_historical_approvals_counts_check; update task_automation_historical_approvals set total_count=4001,approval_fingerprint=repeat('0',64) where request_id='${request}'`)),"APPROVAL_INTEGRITY_FAILURE")
    psql(database,record("task_automation_historical_apply_receipts",receipt(readyApproved,readyReceiptId))); const ready=call(readyRequest); assert.equal(ready.ready,true); assert.equal(ready.counts.unresolvedManualReview,0); assert.equal(ready.counts.receiptWrites,0)
    const definition=psql(database,"select pg_get_functiondef('public.read_task_automation_historical_readiness(text,uuid)'::regprocedure);"); assert.doesNotMatch(definition,/\binsert\s+into\b|\bupdate\s+public\.|\bdelete\s+from\b/i); assert.equal(psql(database,"select provolatile,prosecdef,pg_get_function_result(oid) from pg_proc where oid='public.read_task_automation_historical_readiness(text,uuid)'::regprocedure;"),"s|t|jsonb"); assert.equal(psql(database,"select has_function_privilege('authenticated','public.read_task_automation_historical_readiness(text,uuid)','execute'),has_function_privilege('anon','public.read_task_automation_historical_readiness(text,uuid)','execute'),has_function_privilege('service_role','public.read_task_automation_historical_readiness(text,uuid)','execute');"),"t|f|f")
    assert.match(readFileSync("db/migrations/0088_task_automation_historical_readiness.sql","utf8"),/ROOT_ACCOUNTING_FAILURE[\s\S]*WRITE_PARITY_FAILURE[\s\S]*LIMIT_EXCEEDED/)
  })
})
