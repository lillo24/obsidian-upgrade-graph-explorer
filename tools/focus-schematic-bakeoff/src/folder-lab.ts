import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildEndpointFixture,
  computeFocusSchematicComputedLayoutAttempt,
  DIRECTIONAL_FOLDER_BAND_FIXTURES,
  FOLDER_FIXTURES,
  FOLDER_STABILITY_PAIRS,
  FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
  INTERNAL_LAYOUT_FIXTURES,
  type EndpointFixtureSpec,
} from '@icarus-graph-explorer/focus-schematic-layout';

import { createLayoutInput } from './dimensions';

const outIndex = process.argv.indexOf('--out');
const requestedOutput =
  outIndex < 0
    ? 'output/hier4a-directional-folder-lab'
    : (process.argv[outIndex + 1] ?? 'output/hier4a-directional-folder-lab');
const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const outputDirectory = isAbsolute(requestedOutput)
  ? requestedOutput
  : resolve(repositoryRoot, requestedOutput);

interface ScenarioGroup {
  readonly label: string;
  readonly revisions: Readonly<Record<string, EndpointFixtureSpec>>;
}

function requiredFixture(
  id: string,
  collection: readonly EndpointFixtureSpec[],
): EndpointFixtureSpec {
  const value = collection.find((fixture) => fixture.id === id);
  if (value === undefined)
    throw new Error(`Missing HIER4A review fixture ${id}.`);
  return value;
}

const fb3 = requiredFixture('FB3', FOLDER_FIXTURES);
const fb4 = requiredFixture('FB4', FOLDER_FIXTURES);
const fb9 = requiredFixture('FB9', FOLDER_FIXTURES);
const fb18 = requiredFixture('FB18', FOLDER_FIXTURES);
const db1 = requiredFixture('DB1', DIRECTIONAL_FOLDER_BAND_FIXTURES);
const db2 = requiredFixture('DB2', DIRECTIONAL_FOLDER_BAND_FIXTURES);
const db3 = requiredFixture('DB3', DIRECTIONAL_FOLDER_BAND_FIXTURES);
const db5 = requiredFixture('DB5', DIRECTIONAL_FOLDER_BAND_FIXTURES);
const db6Hidden = requiredFixture('DB6', DIRECTIONAL_FOLDER_BAND_FIXTURES);
const db9 = requiredFixture('DB9', DIRECTIONAL_FOLDER_BAND_FIXTURES);
const db10 = requiredFixture('DB10', DIRECTIONAL_FOLDER_BAND_FIXTURES);
const db11 = requiredFixture('DB11', DIRECTIONAL_FOLDER_BAND_FIXTURES);
const db12 = requiredFixture('DB12', DIRECTIONAL_FOLDER_BAND_FIXTURES);
const db13 = requiredFixture('DB13', DIRECTIONAL_FOLDER_BAND_FIXTURES);
const db14 = requiredFixture('DB14', DIRECTIONAL_FOLDER_BAND_FIXTURES);
const db15 = requiredFixture('DB15', DIRECTIONAL_FOLDER_BAND_FIXTURES);
const db16 = requiredFixture('DB16', DIRECTIONAL_FOLDER_BAND_FIXTURES);
const db17 = requiredFixture('DB17', DIRECTIONAL_FOLDER_BAND_FIXTURES);
const db18 = requiredFixture('DB18', DIRECTIONAL_FOLDER_BAND_FIXTURES);
const db19 = requiredFixture('DB19', DIRECTIONAL_FOLDER_BAND_FIXTURES);
const internalFixtures = Object.fromEntries(
  INTERNAL_LAYOUT_FIXTURES.map((fixture) => [fixture.id, fixture]),
);
const db6Visible = { ...db6Hidden };
delete db6Visible.filters;
const fs5 = FOLDER_STABILITY_PAIRS.find(({ id }) => id === 'FS5')!;
const fs8 = FOLDER_STABILITY_PAIRS.find(({ id }) => id === 'FS8')!;

const groups: Readonly<Record<string, ScenarioGroup>> = {
  'FB4-safe': {
    label: 'FB4-safe — topology permits exact-folder ordering',
    revisions: { base: fb3 },
  },
  'FB4-topology-tension': {
    label: 'FB4 topology tension — candidate-specific ordering',
    revisions: { base: fb4 },
  },
  FB9: {
    label: 'FB9 — visible singleton folders',
    revisions: { base: fb9 },
  },
  FB16: {
    label: 'FB16 — File changes exact folder',
    revisions: { before: fs5.before, after: fs5.after },
  },
  FB18: {
    label: 'FB18 — no unexplained movement away from own band',
    revisions: { base: fb18 },
  },
  DB1: { label: 'DB1 — all singleton folders', revisions: { base: db1 } },
  DB2: {
    label: 'DB2 — singleton and repeated folder mix',
    revisions: { base: db2 },
  },
  DB3: {
    label: 'DB3 — contradictory rank folder order',
    revisions: { base: db3 },
  },
  DB5: {
    label: 'DB5 — center-spine composition',
    revisions: { base: db5 },
  },
  DB6: {
    label: 'DB6 — query hide and restore',
    revisions: {
      visible: db6Visible as EndpointFixtureSpec,
      hidden: db6Hidden,
      restored: db6Visible as EndpointFixtureSpec,
    },
  },
  DB9: {
    label: 'DB9 — balanced two-folder partition',
    revisions: { base: db9 },
  },
  DB10: {
    label: 'DB10 — unequal-height root balance',
    revisions: { base: db10 },
  },
  DB11: {
    label: 'DB11 — root balance requiring endpoint reorder',
    revisions: { base: db11 },
  },
  DB12: {
    label: 'DB12 — root internal-layout pressure',
    revisions: { base: db12 },
  },
  DB13: {
    label: 'DB13 — balance outranks baseline displacement',
    revisions: { base: db13 },
  },
  DB14: {
    label: 'DB14 — balanced assignment chooses shorter endpoints',
    revisions: { base: db14 },
  },
  DB15: {
    label: 'DB15 — source order wins an exact tie',
    revisions: { base: db15 },
  },
  DB16: {
    label: 'DB16 — secondary-invariant joint ordering',
    revisions: { base: db16 },
  },
  DB17: {
    label: 'DB17 — multiple reorderable sibling groups',
    revisions: { base: db17 },
  },
  DB18: {
    label: 'DB18 — reroot with crossing-optimized order',
    revisions: { base: db18 },
  },
  DB19: {
    label: 'DB19 — true blocked after internal-layout optimization',
    revisions: { base: db19 },
  },
  ...Object.fromEntries(
    INTERNAL_LAYOUT_FIXTURES.map((fixture) => [
      fixture.id,
      {
        label: `${fixture.id} — ${fixture.label}`,
        revisions: { base: internalFixtures[fixture.id]! },
      },
    ]),
  ),
  REROOT: {
    label: 'Reroot — new Focus folder becomes central',
    revisions: { before: fs8.before, after: fs8.after },
  },
};

const data = Object.fromEntries(
  Object.entries(groups).map(([scenarioId, group]) => [
    scenarioId,
    {
      label: group.label,
      revisions: Object.fromEntries(
        Object.entries(group.revisions).map(([revisionId, spec]) => {
          const fixture = buildEndpointFixture(spec);
          let connections: readonly {
            readonly id: string;
            readonly kind: 'precise' | 'fallback';
            readonly role: 'selected-backbone' | 'focus-path' | 'secondary';
          }[] = [];
          const policies = Object.fromEntries(
            (['document-order', 'crossing-optimized'] as const).map(
              (endpointOrderPolicy) => {
                const artifact = (
                  enabled: boolean,
                  internalLayoutVariant:
                    'current' | 'vertical-spine' | 'adaptive-compass',
                ) => {
                  const input = createLayoutInput(fixture, {
                    ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
                    directionalFolderBandsEnabled: enabled,
                  });
                  const attempt = computeFocusSchematicComputedLayoutAttempt(
                    input,
                    { endpointOrderPolicy, internalLayoutVariant },
                  );
                  if (attempt.status !== 'success')
                    throw new Error(
                      `${scenarioId}/${revisionId}/${endpointOrderPolicy}/${internalLayoutVariant}/${enabled ? 'on' : 'off'} failed: ${attempt.reason}`,
                    );
                  if (!enabled)
                    connections = attempt.result.endpointPlan.connections.map(
                      ({ id, kind, role }) => ({ id, kind, role }),
                    );
                  return {
                    candidate: attempt.result.candidate,
                    attachments: attempt.result.attachments,
                    folderBandPlan: attempt.result.folderBandPlan,
                    folderBandQuality: attempt.result.folderBandQuality,
                    endpointQuality: attempt.result.quality,
                    internalLayoutEvidence:
                      attempt.result.internalLayoutEvidence,
                    runtimeMs: attempt.timings.totalMs,
                  };
                };
                return [
                  endpointOrderPolicy,
                  {
                    off: artifact(false, 'current'),
                    variants: Object.fromEntries(
                      (
                        [
                          'current',
                          'vertical-spine',
                          'adaptive-compass',
                        ] as const
                      ).map((variant) => [variant, artifact(true, variant)]),
                    ),
                  },
                ];
              },
            ),
          );
          return [
            revisionId,
            {
              explanation: {
                authored: spec.authored,
                expectation: spec.expectation,
                inspect: spec.inspect,
              },
              model: {
                rootModuleId: fixture.model.rootModuleId,
                modules: fixture.model.modules.map(
                  ({ id, folderKey, presentation }) => ({
                    id,
                    folderKey: presentation === 'filtered' ? null : folderKey,
                    presentation,
                  }),
                ),
                nodes: fixture.projection.nodes.flatMap((node) =>
                  node.kind === 'entity'
                    ? [{ id: node.id, entityKind: node.entityKind }]
                    : [],
                ),
                hierarchyEdges: fixture.projection.edges.flatMap((edge) =>
                  edge.kind === 'hierarchy'
                    ? [
                        {
                          id: edge.id,
                          sourceNodeId: edge.sourceNodeId,
                          targetNodeId: edge.targetNodeId,
                        },
                      ]
                    : [],
                ),
              },
              connections,
              policies,
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
<title>HIER4A-FIX2 internal File-module layout bakeoff</title>
<style>
:root{color-scheme:dark;font:14px/1.45 Inter,ui-sans-serif,system-ui,sans-serif;background:#0b0f16;color:#e7edf7}*{box-sizing:border-box}body{margin:0}.shell{display:grid;grid-template-rows:auto 1fr;min-height:100vh}.top{position:sticky;top:0;z-index:2;background:#101722ef;border-bottom:1px solid #293548;padding:14px 18px;backdrop-filter:blur(12px)}h1{font-size:18px;margin:0 0 10px}.controls{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:end}label{display:grid;gap:4px;color:#aebdd2;font-size:12px}select{font:inherit;color:#eef5ff;background:#182334;border:1px solid #3b4b62;border-radius:7px;padding:7px 9px}.content{padding:16px 18px 28px}.explain{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.note{border:1px solid #263449;background:#111925;border-radius:9px;padding:10px}.note b{color:#8fb9ff;display:block;margin-bottom:3px}.views{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.views.single{grid-template-columns:1fr}.panel{min-width:0;border:1px solid #29384d;background:#0d131d;border-radius:10px;overflow:hidden}.panel h2{font-size:14px;margin:0;padding:9px 12px;background:#141e2c;border-bottom:1px solid #29384d}.canvas{width:100%;height:650px;display:block}.folder-guide{fill:#6ca0ff12;stroke:#6ca0ff88;stroke-width:1.5;stroke-dasharray:8 6}.folder-guide.root{fill:#f7c66c12;stroke:#f7c66c99}.folder-label{fill:#a8c7ff;font-size:14px;font-weight:700}.module{fill:#152033cc;stroke:#6680a3;stroke-width:2}.module.root{stroke:#f7c66c;stroke-width:3}.module.filtered{fill:#171b22;stroke:#758094;stroke-dasharray:6 5}.module.exception{stroke:#ff8c83;stroke-width:3}.module-label{fill:#9fb2c9;font-size:11px;font-weight:650}.folder-chip{fill:#8fb9ff;font-size:10px}.node{fill:#20334b;stroke:#8ca8cc;stroke-width:1.5}.node.document{fill:#263d59}.node.section{fill:#213247}.node.block{fill:#1b293b}.node-label{fill:#eff6ff;font-size:11px;font-weight:600;text-anchor:middle;dominant-baseline:middle}.edge{stroke:#a9bdd7;stroke-width:2;fill:none;opacity:.76}.edge.secondary{stroke:#728198;stroke-dasharray:6 5;opacity:.45}.hierarchy{stroke:#657d9e;stroke-width:1.5;fill:none;opacity:.7}.exception-marker{fill:#ff8c83;stroke:#371415;stroke-width:2}.exception-text{fill:#180809;font-size:10px;font-weight:900;text-anchor:middle;dominant-baseline:middle}.metrics{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;white-space:pre-wrap;margin:0;padding:12px;color:#bdd0e8}.exceptions{margin:0;padding:0 12px 12px 30px;color:#ffb3ad}.advanced{margin-top:14px;border:1px solid #29384d;border-radius:9px;padding:10px 12px;background:#101722}.questions{margin-top:14px;color:#b8c7db}.questions li{margin:4px 0}@media(max-width:1050px){.explain{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:900px){.explain,.views{grid-template-columns:1fr}.canvas{height:540px}}
</style>
</head>
<body><div class="shell">
<header class="top"><h1>HIER4A-FIX2 · Root Module Internal Layout Bakeoff</h1><div class="controls">
<label>Scenario<select id="scenario"></select></label>
<label>Revision<select id="revision"></select></label>
<label>Folder Bands<select id="mode"><option value="off">Off</option><option value="on" selected>On</option></select></label>
<label>Heading order<select id="heading"><option value="document-order">Document order</option><option value="crossing-optimized" selected>Crossing optimized</option></select></label>
<label>Internal layout<select id="internal"><option value="current">Current</option><option value="vertical-spine" selected>Vertical spine</option><option value="adaptive-compass">Adaptive compass</option></select></label>
<label>View<select id="view"><option value="spine-compass" selected>Vertical spine vs Adaptive compass</option><option value="current-spine">Current vs Vertical spine</option><option value="off-on">Product Off vs selected On</option><option value="selected">Selected variant only</option></select></label>
<label>Folder guides<select id="guides"><option value="on">On</option><option value="off">Off</option></select></label>
<label>Exception reasons<select id="reasons"><option value="on">On</option><option value="off">Off</option></select></label>
<label>Precise links<select id="links"><option value="on">On</option><option value="off">Off</option></select></label>
</div></header>
<main class="content"><section class="explain" id="explain"></section><section class="views" id="views"></section>
<details class="advanced"><summary>Advanced: folder order, exact intervals, exception table, and graph metrics</summary><pre class="metrics" id="advanced"></pre></details>
<ol class="questions"><li>Does the File remain obviously the center and owner of its Headings?</li><li>Does Vertical Spine feel clearer than Current mosaic geometry?</li><li>Does Compass ever justify its added width and visual complexity?</li><li>Are Vertical Spine branches balanced sensibly above and below the File?</li><li>Do DB12, DB5, DB11, FB4, VS2, VS6, CP1, CP4, CP5, and DB19 remain readable with low crossings?</li><li>Does Compass blur the distinction between internal placement and external incoming/outgoing ranks?</li><li>Which internal grammar should Directional Folder Bands adopt?</li></ol>
</main></div>
<script>
const DATA=${serialized};
const scenario=document.querySelector('#scenario'),revision=document.querySelector('#revision'),mode=document.querySelector('#mode'),heading=document.querySelector('#heading'),internalSelect=document.querySelector('#internal'),view=document.querySelector('#view'),guides=document.querySelector('#guides'),reasons=document.querySelector('#reasons'),links=document.querySelector('#links'),views=document.querySelector('#views'),explain=document.querySelector('#explain'),advanced=document.querySelector('#advanced');
const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const entityId=value=>{if(Array.isArray(value)&&value[0]==='entity')return value[1];const text=String(value);try{const parsed=JSON.parse(text);return Array.isArray(parsed)&&parsed[0]==='entity'?parsed[1]:text}catch(error){if(!(error instanceof SyntaxError))throw error;return text}};
for(const [id,item] of Object.entries(DATA)){const option=document.createElement('option');option.value=id;option.textContent=item.label;scenario.append(option)}scenario.value='DB12';
function updateRevisions(){const values=Object.keys(DATA[scenario.value].revisions);revision.replaceChildren(...values.map(value=>{const option=document.createElement('option');option.value=value;option.textContent=value;return option}));revision.value=values[0]}
function bounds(item){const rectangles=item.candidate.modules;if(!rectangles.length)return{x:-100,y:-100,width:200,height:200};const left=Math.min(...rectangles.map(r=>r.x)),right=Math.max(...rectangles.map(r=>r.x+r.width)),moduleTop=Math.min(...rectangles.map(r=>r.y)),moduleBottom=Math.max(...rectangles.map(r=>r.y+r.height)),bandTop=Math.min(moduleTop,...item.folderBandPlan.bands.map(b=>b.topY)),bandBottom=Math.max(moduleBottom,...item.folderBandPlan.bands.map(b=>b.bottomY));return{x:left-100,y:bandTop-80,width:right-left+200,height:bandBottom-bandTop+160}}
function exceptionLabel(value){return value.reason.replaceAll('-',' ')+' · crossings '+value.evidence.baselineCrossings+'→'+value.evidence.candidateCrossings+' · inversions '+value.evidence.baselineInversions+'→'+value.evidence.candidateInversions}
function balanceOverrideLabel(value){return 'Root balance override · '+value.reason.replaceAll('-',' ')+' · attempted '+value.attemptedFolderOrder.join(' → ')+' · crossings '+value.evidence.baselineCrossings+'→'+value.evidence.candidateCrossings+' · inversions '+value.evidence.baselineInversions+'→'+value.evidence.candidateInversions}
function svgFor(title,item,revisionData){const candidate=item.candidate,b=bounds(item),moduleInfo=new Map(revisionData.model.modules.map(m=>[m.id,m])),nodeInfo=new Map(revisionData.model.nodes.map(n=>[n.id,n])),attachments=new Map(item.attachments.map(a=>[a.connectionId+':'+a.endpoint,a])),connections=new Map(revisionData.connections.map(c=>[c.id,c])),placements=new Map(item.folderBandPlan.modulePlacements.map(p=>[p.moduleId,p])),exceptions=new Map(item.folderBandPlan.exceptions.map(e=>[e.id,e]));let markup='<svg class="canvas" role="img" aria-label="'+esc(title)+'" viewBox="'+[b.x,b.y,b.width,b.height].join(' ')+'"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#a9bdd7"/></marker></defs>';
if(guides.value==='on')for(const band of item.folderBandPlan.bands)markup+='<rect class="folder-guide '+(band.root?'root':'')+'" x="'+b.x+'" y="'+band.topY+'" width="'+b.width+'" height="'+band.height+'"/><text class="folder-label" x="'+(b.x+12)+'" y="'+(band.topY+19)+'">'+esc(band.folderKey+'/')+(band.singleton?' · singleton':'')+'</text>';
const candidateNodes=new Map(candidate.nodes.map(node=>[node.projectionNodeId,node]));for(const edge of revisionData.model.hierarchyEdges){const source=candidateNodes.get(edge.sourceNodeId),target=candidateNodes.get(edge.targetNodeId);if(!source||!target)continue;markup+='<path class="hierarchy" d="M'+(source.x+source.width/2)+' '+(source.y+source.height/2)+' L'+(target.x+target.width/2)+' '+(target.y+target.height/2)+'"/>'}
if(links.value==='on')for(const [id,connection] of connections){const source=attachments.get(id+':source'),target=attachments.get(id+':target');if(!source||!target||connection.kind!=='precise')continue;markup+='<path class="edge '+(connection.role==='secondary'?'secondary':'')+'" d="M'+source.x+' '+source.y+' L'+target.x+' '+target.y+'" marker-end="url(#arrow)"/>'}
for(const module of candidate.modules){const info=moduleInfo.get(module.moduleId)||{},folder=info.folderKey,displayId=info.presentation==='filtered'?'Filtered bridge':module.moduleId,placement=placements.get(module.moduleId),exception=placement?.exceptionId?exceptions.get(placement.exceptionId):null,classes='module '+(module.moduleId===revisionData.model.rootModuleId?'root ':'')+(info.presentation==='filtered'?'filtered ':'')+(exception?'exception':'');markup+='<g tabindex="0" aria-label="File module '+esc(displayId)+(folder?' folder '+esc(folder):'')+(exception?' exception '+esc(exceptionLabel(exception)):'')+'"><rect class="'+classes+'" x="'+module.x+'" y="'+module.y+'" width="'+module.width+'" height="'+module.height+'" rx="9"/><text class="module-label" x="'+(module.x+10)+'" y="'+(module.y+16)+'">'+esc(displayId)+'</text>'+(folder?'<text class="folder-chip" x="'+(module.x+10)+'" y="'+(module.y+31)+'">'+esc(folder+'/')+'</text>':'')+(exception&&reasons.value==='on'?'<g><circle class="exception-marker" cx="'+(module.x+module.width-12)+'" cy="'+(module.y+12)+'" r="9"><title>'+esc(exceptionLabel(exception))+'</title></circle><text class="exception-text" x="'+(module.x+module.width-12)+'" y="'+(module.y+12)+'">!</text></g>':'')+'</g>'}
for(const node of candidate.nodes){const id=entityId(node.projectionNodeId),info=nodeInfo.get(id)||{entityKind:'entity'};markup+='<g tabindex="0" aria-label="'+esc(info.entityKind)+' '+esc(id)+'"><rect class="node '+esc(info.entityKind)+'" x="'+node.x+'" y="'+node.y+'" width="'+node.width+'" height="'+node.height+'" rx="7"/><text class="node-label" x="'+(node.x+node.width/2)+'" y="'+(node.y+node.height/2)+'">'+esc(id)+'</text></g>'}markup+='</svg>';const exceptionItems=item.folderBandPlan.exceptions.map(value=>'<li><b>'+esc(value.moduleId)+'</b> · '+esc(value.folderKey+'/')+' · '+esc(exceptionLabel(value))+'</li>'),balanceOverride=item.folderBandPlan.rootBalance?.topologyOverride;const reasonItems=[...exceptionItems,...(balanceOverride?['<li><b>'+esc(balanceOverrideLabel(balanceOverride))+'</b></li>']:[])].join('');return '<article class="panel"><h2>'+esc(title)+'</h2>'+markup+'<pre class="metrics">'+esc(metrics(item))+'</pre>'+(reasons.value==='on'&&reasonItems?'<ol class="exceptions">'+reasonItems+'</ol>':'')+'</article>'}
function metrics(item){const f=item.folderBandQuality,e=item.endpointQuality,p=item.folderBandPlan,b=p.rootBalance,o=p.optimization,m=o?.selectedCandidate.metrics,r=o?.nearestRejectedCandidate,i=item.internalLayoutEvidence,q=i.metrics,root=i.moduleMetrics.find(value=>value.moduleId===item.candidate.rootModuleId),s=f.folderBandSatisfactionRatio==null?'n/a':Math.round(f.folderBandSatisfactionRatio*1000)/10+'%',balance=b==null?'Off':round(b.abovePackedExtent)+' / '+round(b.belowPackedExtent)+' / '+round(b.packedExtentImbalance),regions=root?root.branchesAboveFile+' / '+root.branchesBelowFile+' / '+root.branchesLeftOfFile+' / '+root.branchesRightOfFile:'n/a',dimensions=root?round(root.width)+' × '+round(root.height)+' · area '+round(root.area):'n/a';return ['internal layout '+i.variant+' · development comparison','visible folders '+f.visibleFolderCount+' · visible Files '+f.visibleModuleCount,'inside own band '+f.folderBandSatisfiedModuleCount+' · exceptions '+f.folderBandExceptionModuleCount+' · satisfaction '+s,'folder order '+(p.folderOrder.join(' → ')||'Off'),'root balance above/below/imbalance '+balance+(b?.topologyOverride?' · '+b.topologyOverride.reason.replaceAll('-',' '):''),'crossings '+f.baselineExactEndpointCrossingCount+' → '+f.finalExactEndpointCrossingCount+' · inversions '+f.baselineAdjacentRankOrderInversionCount+' → '+f.finalAdjacentRankOrderInversionCount,'primary Manhattan total/mean/p95 '+round(q.totalPrimaryReferenceManhattanSpan)+' / '+round(q.meanPrimaryReferenceManhattanSpan)+' / '+round(q.p95PrimaryReferenceManhattanSpan),'primary vertical total/mean '+round(q.totalPrimaryReferenceVerticalSpan)+' / '+round(q.meanPrimaryReferenceVerticalSpan),'internal hierarchy crossings '+q.internalHierarchyCrossingCount+' · source deviation '+q.internalSourceOrderDeviation,'root branches above/below/left/right '+regions,'root module '+dimensions,'internal candidates/assignments/local sweeps/joint rounds '+i.placementCandidatesEvaluated+' / '+i.completeCompassAssignmentsEvaluated+' / '+i.localRelocationSweeps+' / '+i.jointFolderRounds,'folder candidates/partitions/rounds/crossing metrics '+round(o?.folderOrderCandidatesEvaluated)+' / '+round(o?.folderPartitionsEvaluated)+' / '+round(o?.jointRounds)+' / '+round(o?.crossingMetricEvaluations),'nearest rejected '+(r?r.folderOrder.join(' → ')+' · '+r.rejectionReason:'n/a'),'runtime '+round(item.runtimeMs)+' ms · overlaps '+e.moduleOverlapPairs.length+' modules, '+e.nodeOverlapPairs.length+' nodes'].join('\\n')}
function round(value){return value==null?'n/a':Math.round(value*10)/10}
function variantLabel(value){return value==='current'?'M0 · Current':value==='vertical-spine'?'V1 · Vertical spine':'C1 · Adaptive compass'}
function render(){const group=DATA[scenario.value],revisionData=group.revisions[revision.value],policyData=revisionData.policies[heading.value],off=policyData.off,selectedOn=policyData.variants[internalSelect.value],selected=mode.value==='off'?off:selectedOn,spine=policyData.variants['vertical-spine'],compass=policyData.variants['adaptive-compass'],current=policyData.variants.current;explain.innerHTML=['Authored|'+revisionData.explanation.authored,'Expected|'+revisionData.explanation.expectation,'Current|Previous File + Heading packing baseline.','Vertical spine|File is central; whole top-level branches stack only above and below.','Adaptive compass|File is central; whole branches may occupy top, bottom, left, or right from endpoint demand.','Semantics|Source order, hierarchy, ownership, and Markdown are unchanged in every variant.'].map(value=>{const [key,...rest]=value.split('|');return '<div class="note"><b>'+esc(key)+'</b>'+esc(rest.join('|'))+'</div>'}).join('');let panels;if(view.value==='spine-compass')panels=svgFor(variantLabel('vertical-spine'),spine,revisionData)+svgFor(variantLabel('adaptive-compass'),compass,revisionData);else if(view.value==='current-spine')panels=svgFor(variantLabel('current'),current,revisionData)+svgFor(variantLabel('vertical-spine'),spine,revisionData);else if(view.value==='off-on')panels=svgFor('Product Folder Bands Off · pure A1',off,revisionData)+svgFor('Folder Bands On · '+variantLabel(internalSelect.value),selectedOn,revisionData);else panels=svgFor((mode.value==='off'?'Product Off · ':variantLabel(internalSelect.value)+' · ')+heading.options[heading.selectedIndex].text,selected,revisionData);views.className='views '+(view.value==='selected'?'single':'');views.innerHTML=panels;advanced.textContent=JSON.stringify({internalLayoutEvidence:selected.internalLayoutEvidence,folderBandPlan:selected.folderBandPlan,folderBandQuality:selected.folderBandQuality,endpointQuality:selected.endpointQuality},null,2)}
scenario.addEventListener('change',()=>{updateRevisions();render()});for(const control of [revision,mode,heading,internalSelect,view,guides,reasons,links])control.addEventListener('change',render);updateRevisions();render();
</script></body></html>`;

export async function writeFolderLab(
  targetDirectory = outputDirectory,
): Promise<string> {
  await mkdir(targetDirectory, { recursive: true });
  const indexPath = resolve(targetDirectory, 'index.html');
  await writeFile(indexPath, html, 'utf8');
  await writeFile(
    resolve(targetDirectory, 'README.txt'),
    'Synthetic HIER4A-FIX2 Current vs Vertical Spine vs Adaptive Compass review lab. Open index.html directly. No network resources are used.\n',
    'utf8',
  );
  return indexPath;
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const indexPath = await writeFolderLab();
  process.stdout.write(`Generated ${indexPath}\n`);
}
