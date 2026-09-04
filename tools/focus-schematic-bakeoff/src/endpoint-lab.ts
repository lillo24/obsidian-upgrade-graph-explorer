import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildEndpointFixture,
  computeFocusSchematicComputedLayoutAttempt,
  computeFocusSchematicUniformLayoutAttempt,
  createFocusSchematicEndpointAttachments,
  ENDPOINT_FIXTURES,
  ENDPOINT_STABILITY_PAIRS,
  evaluateFocusSchematicEndpointLayoutQuality,
  type EndpointFixtureSpec,
} from '@icarus-graph-explorer/focus-schematic-layout';

import { createLayoutInput } from './dimensions';

const outIndex = process.argv.indexOf('--out');
const requestedOutput =
  outIndex < 0
    ? 'output/hier3a-endpoint-lab'
    : (process.argv[outIndex + 1] ?? 'output/hier3a-endpoint-lab');
const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const outputDirectory = isAbsolute(requestedOutput)
  ? requestedOutput
  : resolve(repositoryRoot, requestedOutput);

const groups: Record<
  string,
  {
    readonly label: string;
    readonly revisions: Record<string, EndpointFixtureSpec>;
  }
> = {};
for (const fixture of ENDPOINT_FIXTURES)
  groups[fixture.id] = {
    label: `${fixture.id} — ${fixture.label}`,
    revisions: { base: fixture },
  };
for (const pair of ENDPOINT_STABILITY_PAIRS)
  groups[pair.id] = {
    label: `${pair.id} — ${pair.label}`,
    revisions: { before: pair.before, after: pair.after },
  };

const data = Object.fromEntries(
  Object.entries(groups).map(([groupId, group]) => [
    groupId,
    {
      label: group.label,
      revisions: Object.fromEntries(
        Object.entries(group.revisions).map(([revisionId, fixtureSpec]) => {
          const fixture = buildEndpointFixture(fixtureSpec);
          const input = createLayoutInput(fixture);
          const a0 = computeFocusSchematicUniformLayoutAttempt(input);
          const a1 = computeFocusSchematicComputedLayoutAttempt(input);
          if (a0.status !== 'success')
            throw new Error(`${groupId}/${revisionId} A0 failed: ${a0.reason}`);
          if (a1.status !== 'success')
            throw new Error(`${groupId}/${revisionId} A1 failed: ${a1.reason}`);
          const a0Attachments = createFocusSchematicEndpointAttachments(
            a1.result.endpointPlan,
            a0.candidate,
          );
          const a0Quality = evaluateFocusSchematicEndpointLayoutQuality(
            input,
            a1.result.endpointPlan,
            a1.result.internalLanePlan,
            a0.candidate,
            a0Attachments,
          );
          return [
            revisionId,
            {
              explanation: {
                authored: fixtureSpec.authored,
                expectation: fixtureSpec.expectation,
                inspect: fixtureSpec.inspect,
              },
              model: fixture.model,
              projection: {
                nodes: fixture.projection.nodes,
                hierarchyEdges: fixture.projection.edges.filter(
                  ({ kind }) => kind === 'hierarchy',
                ),
              },
              endpointPlan: a1.result.endpointPlan,
              modulePlan: a1.result.modulePlan,
              lanePlan: a1.result.internalLanePlan,
              views: {
                A0: {
                  strategyLabel: 'A0 — uniform internal LR',
                  candidate: a0.candidate,
                  attachments: a0Attachments,
                  quality: a0Quality,
                  timings: a0.timings,
                  nativeRoutes: a0.nativeRoutes,
                },
                A1: {
                  strategyLabel: 'A1 — endpoint-facing split lanes',
                  candidate: a1.result.candidate,
                  attachments: a1.result.attachments,
                  quality: a1.result.quality,
                  timings: a1.timings,
                  nativeRoutes: a1.nativeRoutes,
                },
              },
            },
          ];
        }),
      ),
    },
  ]),
);

const serialized = JSON.stringify(data).replaceAll('<', '\\u003c');
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>HIER3A precise endpoint and lane review</title>
<style>
:root{color-scheme:dark;--bg:#09111f;--panel:#111d31;--panel2:#172641;--ink:#eef6ff;--muted:#9bb0c9;--line:#334964;--accent:#5eead4;--focus:#fbbf24;--secondary:#8b9ab0;--file:#164e63;--heading:#4338ca;--block:#7e22ce;--hier:#6b7c92;--left:#60a5fa;--center:#94a3b8;--right:#c084fc}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 ui-sans-serif,system-ui,sans-serif}header{position:sticky;top:0;z-index:5;padding:16px 20px;background:#09111fee;border-bottom:1px solid var(--line);backdrop-filter:blur(8px)}h1{margin:0 0 4px;font-size:21px}.intro{max-width:1050px;color:var(--muted)}.controls{display:flex;gap:12px;flex-wrap:wrap;margin-top:13px;align-items:end}.controls label{display:grid;gap:4px;color:var(--muted);font-size:12px}select{min-width:145px;padding:7px 9px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink)}details{margin-top:10px;color:var(--muted)}details .advanced{display:flex;flex-wrap:wrap;gap:14px;padding:9px 0}details label{display:flex;gap:6px;color:var(--ink)}.legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;color:var(--muted);font-size:12px}.key{display:inline-block;width:20px;margin-right:5px;vertical-align:middle;border-top:2px solid var(--accent)}.key.hierarchy{border-top-color:var(--hier);border-top-style:dashed}.key.secondary{border-top-color:var(--secondary);border-top-style:dotted}.key.backbone{border-top-width:4px}.guide{font-family:ui-monospace,monospace}.explanation{margin:16px;padding:14px 16px;border:1px solid var(--line);border-radius:10px;background:var(--panel);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.explanation strong{display:block;color:var(--accent);margin-bottom:4px}.grid{display:grid;grid-template-columns:repeat(2,minmax(420px,1fr));gap:14px;padding:0 16px 18px}.grid.single{grid-template-columns:minmax(420px,1fr);max-width:1200px;margin:auto}@media(max-width:980px){.explanation,.grid{grid-template-columns:1fr}}.panel{overflow:hidden;border:1px solid var(--line);border-radius:10px;background:var(--panel)}.panel>h2{margin:0;padding:10px 12px;background:var(--panel2);font-size:14px;display:flex;justify-content:space-between;gap:12px}.status{font-size:12px;color:var(--muted)}svg{display:block;width:100%;height:520px;background:#0c1728}.module{fill:#12223a;stroke:#60758e;stroke-width:1.5;stroke-dasharray:6 5}.module.root{stroke:var(--accent);stroke-width:3}.module.filtered{fill:#33283b;stroke:var(--focus)}.node{stroke:#b4c4d8;stroke-width:1.2}.document{fill:var(--file)}.section{fill:var(--heading)}.block{fill:var(--block)}.hierarchy{stroke:var(--hier);stroke-width:1.4;stroke-dasharray:5 5;fill:none;opacity:.75}.reference{stroke:var(--accent);stroke-width:2.2;fill:none;opacity:.9;marker-end:url(#arrow)}.reference.backbone{stroke-width:4}.reference.secondary{stroke:var(--secondary);stroke-dasharray:3 5}.reference:focus,.endpoint:focus{outline:none;stroke:var(--focus);stroke-width:5;opacity:1}.approx{stroke:#f59e0b;stroke-width:1.5;stroke-dasharray:8 5;fill:none;opacity:.7}.native{stroke:#fb7185;stroke-width:1.4;stroke-dasharray:4 5;fill:none}.label{fill:#f8fbff;font-size:11px;pointer-events:none}.small{fill:#b1c0d3;font-size:9px;pointer-events:none}.rank{stroke:#334964;stroke-width:1;stroke-dasharray:4 6}.ranklabel{fill:#748aa3;font-size:10px}.lane{stroke-width:1;stroke-dasharray:3 5;opacity:.8}.lane.left{stroke:var(--left)}.lane.center{stroke:var(--center)}.lane.right{stroke:var(--right)}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;padding:9px 12px;border-top:1px solid var(--line);color:var(--muted);font-size:11px}.connections{padding:0 12px 12px}.connections summary{cursor:pointer;color:var(--muted)}.connections ol{max-height:190px;overflow:auto;margin:8px 0 0;padding-left:24px}.connections button{width:100%;text-align:left;border:1px solid transparent;border-radius:5px;padding:5px;background:transparent;color:var(--ink)}.connections button:focus{border-color:var(--focus);outline:none;background:#22314a}.hidden{display:none}
</style>
</head>
<body>
<header>
<h1>HIER3A · precise endpoints and endpoint-facing lanes</h1>
<div class="intro">Compare the preserved HIER2 A0 internals with candidate A1. Quiet dashed lines mean File/Heading/Block containment. Arrowheads always show the authored cross-file reference direction. Full obstacle-aware routing is reserved for HIER5.</div>
<div class="controls">
<label>Scenario<select id="scenario"></select></label>
<label id="revision-label">Revision<select id="revision"></select></label>
<label>View<select id="view"><option value="both">A0 vs A1 side-by-side</option><option value="A0">A0 only</option><option value="A1">A1 only</option></select></label>
<label>Edges<select id="edges"><option value="precise">Precise endpoints</option><option value="hidden">Hidden</option></select></label>
</div>
<details><summary>Advanced details</summary><div class="advanced"><label><input id="bounds" type="checkbox" checked>Module bounds</label><label><input id="lanes" type="checkbox">Lane guides</label><label><input id="secondary" type="checkbox">Secondary edges</label><label><input id="approximate" type="checkbox">Approximate module-center edges</label><label><input id="native" type="checkbox">Native macro route evidence</label></div></details>
<div class="legend"><span><i class="key hierarchy"></i>quiet hierarchy</span><span><i class="key backbone"></i>selected backbone reference</span><span><i class="key"></i>other Focus path</span><span><i class="key secondary"></i>secondary reference</span><span class="guide">−2 −1 ← 0 Focus → +1 +2</span></div>
</header>
<section id="explanation" class="explanation" aria-live="polite"></section>
<main id="grid" class="grid"></main>
<script>const DATA=${serialized};
const scenario=document.querySelector('#scenario'),revision=document.querySelector('#revision'),revisionLabel=document.querySelector('#revision-label'),view=document.querySelector('#view'),edges=document.querySelector('#edges'),bounds=document.querySelector('#bounds'),lanes=document.querySelector('#lanes'),secondary=document.querySelector('#secondary'),approximate=document.querySelector('#approximate'),nativeRoutes=document.querySelector('#native'),grid=document.querySelector('#grid'),explanation=document.querySelector('#explanation');
const esc=v=>String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
for(const [id,item] of Object.entries(DATA)){const option=document.createElement('option');option.value=id;option.textContent=item.label;scenario.append(option)}scenario.value='EP4';
function updateRevisions(){const prior=revision.value;revision.innerHTML='';const ids=Object.keys(DATA[scenario.value].revisions);for(const id of ids){const option=document.createElement('option');option.value=id;option.textContent=id;revision.append(option)}revisionLabel.classList.toggle('hidden',ids.length===1);revision.value=ids.includes(prior)?prior:ids[0]}
function center(r){return{x:r.x+r.width/2,y:r.y+r.height/2}}function path(points){return points.map((point,index)=>(index?'L':'M')+point.x+' '+point.y).join(' ')}
function panel(strategy,item){const current=item.views[strategy],candidate=current.candidate,moduleMap=new Map(candidate.modules.map(module=>[module.moduleId,module])),nodeMap=new Map(candidate.nodes.map(node=>[node.projectionNodeId,node])),nodeMeta=new Map(item.projection.nodes.filter(node=>node.kind==='entity').map(node=>[node.id,node])),attachmentMap=new Map(current.attachments.map(attachment=>[attachment.connectionId+':'+attachment.endpoint,attachment]));const rectangles=[...candidate.modules,...candidate.nodes],minX=Math.min(...rectangles.map(rectangle=>rectangle.x))-100,minY=Math.min(...rectangles.map(rectangle=>rectangle.y))-75,maxX=Math.max(...rectangles.map(rectangle=>rectangle.x+rectangle.width))+100,maxY=Math.max(...rectangles.map(rectangle=>rectangle.y+rectangle.height))+75;let svg='<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/></marker></defs>';
for(const rank of [...new Set(item.modulePlan.modules.map(module=>module.signedRank))]){const modules=item.modulePlan.modules.filter(module=>module.signedRank===rank).map(module=>moduleMap.get(module.moduleId)).filter(Boolean);if(modules.length){const x=modules.reduce((sum,module)=>sum+center(module).x,0)/modules.length;svg+='<line class="rank" x1="'+x+'" y1="'+minY+'" x2="'+x+'" y2="'+maxY+'"/><text class="ranklabel" x="'+(x+5)+'" y="'+(minY+14)+'">rank '+rank+'</text>'}}
if(bounds.checked)for(const module of candidate.modules){const semantic=item.model.modules.find(value=>value.id===module.moduleId);svg+='<rect class="module '+(module.moduleId===item.model.rootModuleId?'root ':'')+(semantic?.presentation==='filtered'?'filtered':'')+'" x="'+module.x+'" y="'+module.y+'" width="'+module.width+'" height="'+module.height+'" rx="10"/><text class="small" x="'+(module.x+8)+'" y="'+(module.y+15)+'">'+esc(semantic?.presentation==='filtered'?'Filtered bridge':semantic?.sourcePath??module.moduleId)+'</text>'}
for(const hierarchy of item.projection.hierarchyEdges){const source=nodeMap.get(hierarchy.sourceNodeId),target=nodeMap.get(hierarchy.targetNodeId);if(source&&target)svg+='<path class="hierarchy" d="'+path([center(source),center(target)])+'"/>'}
if(lanes.checked&&strategy==='A1')for(const module of candidate.modules){const semantic=item.model.modules.find(value=>value.id===module.moduleId);if(!semantic||semantic.presentation==='filtered')continue;const document=semantic.documentProjectionNodeId?nodeMap.get(semantic.documentProjectionNodeId):null,coreX=document?center(document).x:center(module).x;svg+='<line class="lane left" x1="'+(module.x+module.width*.2)+'" y1="'+(module.y+18)+'" x2="'+(module.x+module.width*.2)+'" y2="'+(module.y+module.height-8)+'"/><line class="lane center" x1="'+coreX+'" y1="'+(module.y+18)+'" x2="'+coreX+'" y2="'+(module.y+module.height-8)+'"/><line class="lane right" x1="'+(module.x+module.width*.8)+'" y1="'+(module.y+18)+'" x2="'+(module.x+module.width*.8)+'" y2="'+(module.y+module.height-8)+'"/>'}
if(approximate.checked)for(const relationship of item.model.relationships){if(relationship.secondary&&!secondary.checked)continue;const source=moduleMap.get(relationship.sourceModuleId),target=moduleMap.get(relationship.targetModuleId);if(source&&target)svg+='<path class="approx" d="'+path([center(source),center(target)])+'"/>'}
if(nativeRoutes.checked)for(const route of current.nativeRoutes)svg+='<path class="native" d="'+path(route.points)+'"/>';
if(edges.value==='precise')for(const connection of item.endpointPlan.connections){if(connection.role==='secondary'&&!secondary.checked)continue;const source=attachmentMap.get(connection.id+':source'),target=attachmentMap.get(connection.id+':target');if(!source||!target)continue;const label=(connection.source.kind==='visible-entity'?connection.source.entityKind+' '+connection.source.entityId:'module anchor '+connection.source.moduleId)+' → '+(connection.target.kind==='visible-entity'?connection.target.entityKind+' '+connection.target.entityId:'module anchor '+connection.target.moduleId)+', '+connection.role+', '+connection.referenceIds.length+' reference'+(connection.referenceIds.length===1?'':'s');svg+='<path tabindex="0" role="img" aria-label="'+esc(label)+'" class="reference '+(connection.role==='selected-backbone'?'backbone ':connection.role==='secondary'?'secondary ':'')+'" d="'+path([source,target])+'"><title>'+esc(label)+'</title></path>'}
for(const node of candidate.nodes){const meta=nodeMeta.get(node.projectionNodeId),kind=meta?.entityKind??'document',label=(kind==='document'?(meta?.sourcePath??meta?.entityId):meta?.title??meta?.entityId??node.projectionNodeId);svg+='<g class="endpoint" tabindex="0" role="img" aria-label="'+esc(kind+' '+label)+'"><rect class="node '+kind+'" x="'+node.x+'" y="'+node.y+'" width="'+node.width+'" height="'+node.height+'" rx="6"/><text class="label" x="'+(node.x+8)+'" y="'+(node.y+20)+'">'+esc(kind==='document'?'File':kind==='section'?'Heading':'Block')+'</text><text class="small" x="'+(node.x+8)+'" y="'+(node.y+35)+'">'+esc(label)+'</text><title>'+esc(kind+' '+label+', '+node.projectionNodeId)+'</title></g>'}
const quality=current.quality,connectionItems=item.endpointPlan.connections.filter(connection=>secondary.checked||connection.role!=='secondary').map(connection=>{const source=connection.source.kind==='visible-entity'?connection.source.entityKind+' '+connection.source.entityId:'module anchor '+connection.source.moduleId,target=connection.target.kind==='visible-entity'?connection.target.entityKind+' '+connection.target.entityId:'module anchor '+connection.target.moduleId;return '<li><button>'+esc(source+' → '+target+' · '+connection.role+' · '+connection.referenceIds.length+' ref')+'</button></li>'}).join('');return '<section class="panel"><h2><span>'+esc(current.strategyLabel)+'</span><span class="status">'+candidate.modules.length+' modules · '+candidate.nodes.length+' nodes</span></h2><svg viewBox="'+minX+' '+minY+' '+(maxX-minX)+' '+(maxY-minY)+'" preserveAspectRatio="xMidYMid meet" aria-label="'+esc(current.strategyLabel)+' schematic">'+svg+'</svg><div class="metrics"><span>precise '+quality.preciseConnectionCount+'</span><span>fallback '+quality.fallbackConnectionCount+'</span><span>side violations '+(quality.leftDemandViolationNodeIds.length+quality.rightDemandViolationNodeIds.length)+'</span><span>obstructed '+(quality.obstructedSourceAttachmentConnectionIds.length+quality.obstructedTargetAttachmentConnectionIds.length)+'</span><span>area '+Math.round(quality.totalBoundsArea).toLocaleString()+'</span><span>overlap '+(quality.moduleOverlapPairs.length+quality.nodeOverlapPairs.length)+'</span><span>p95 vertical '+(quality.p95PreciseEndpointVerticalError??'n/a')+'</span><span>time '+current.timings.totalMs+' ms</span></div><details class="connections"><summary>Keyboard-accessible endpoint details</summary><ol>'+connectionItems+'</ol></details></section>'}
function render(){const group=DATA[scenario.value],item=group.revisions[revision.value];explanation.innerHTML='<div><strong>Authored relationship</strong>'+esc(item.explanation.authored)+'</div><div><strong>Root and side expectation</strong>'+esc(item.explanation.expectation)+'</div><div><strong>What to inspect</strong>'+esc(item.explanation.inspect)+'</div>';const strategies=view.value==='both'?['A0','A1']:[view.value];grid.classList.toggle('single',strategies.length===1);grid.innerHTML=strategies.map(strategy=>panel(strategy,item)).join('')}
scenario.addEventListener('change',()=>{updateRevisions();render()});for(const control of [revision,view,edges,bounds,lanes,secondary,approximate,nativeRoutes])control.addEventListener('change',render);updateRevisions();render();
</script>
</body>
</html>`;

export async function writeEndpointLab(
  targetDirectory = outputDirectory,
): Promise<string> {
  await mkdir(targetDirectory, { recursive: true });
  const indexPath = resolve(targetDirectory, 'index.html');
  await writeFile(indexPath, html, 'utf8');
  await writeFile(
    resolve(targetDirectory, 'README.txt'),
    'Synthetic HIER3A endpoint review lab. Open index.html directly or serve this directory with a local static server. No network resources are used.\n',
    'utf8',
  );
  return indexPath;
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const indexPath = await writeEndpointLab();
  process.stdout.write(`Generated ${indexPath}\n`);
}
