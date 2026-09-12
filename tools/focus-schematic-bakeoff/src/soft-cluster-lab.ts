import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildEndpointFixture,
  computeFocusSchematicComputedLayoutAttempt,
  computeFocusSchematicSoftClusterLayoutAttempt,
  createSoftClusterHubFixture,
  createSoftClusterMultiplicityFixture,
  FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
  SOFT_ADAPTIVE_COMPASS_FIXTURES,
  SOFT_CLUSTER_FIXTURES,
  SOFT_CLUSTER_STABILITY_PAIRS,
  type EndpointFixtureSpec,
} from '@icarus-graph-explorer/focus-schematic-layout';

import { createLayoutInput } from './dimensions';

const strengths = [0, 25, 50, 75, 100] as const;
const internalVariants = ['adaptive-compass', 'vertical-spine'] as const;
const orderPolicies = ['crossing-optimized', 'document-order'] as const;
const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));

interface ScenarioGroup {
  readonly label: string;
  readonly revisions: Readonly<Record<string, EndpointFixtureSpec>>;
}

function scenarios(): Readonly<Record<string, ScenarioGroup>> {
  const groups = Object.fromEntries(
    [...SOFT_CLUSTER_FIXTURES, ...SOFT_ADAPTIVE_COMPASS_FIXTURES].map(
      (spec) => [
        spec.id,
        { label: `${spec.id} — ${spec.label}`, revisions: { base: spec } },
      ],
    ),
  ) as Record<string, ScenarioGroup>;
  groups.SC11 = {
    label: 'SC11 — hub scale 20 / 50 / 100',
    revisions: Object.fromEntries(
      [20, 50, 100].map((count) => [
        `${count} leaves`,
        createSoftClusterHubFixture(count),
      ]),
    ),
  };
  groups.SC12 = {
    label: 'SC12 — multiplicity saturation 1 / 2 / 5 / 20 / 100',
    revisions: Object.fromEntries(
      [1, 2, 5, 20, 100].map((count) => [
        `${count} references`,
        createSoftClusterMultiplicityFixture(count),
      ]),
    ),
  };
  const stability = SOFT_CLUSTER_STABILITY_PAIRS[0]!;
  groups.SC17 = {
    label: 'SC17 — perturbation stability',
    revisions: { before: stability.before, after: stability.after },
  };
  const hidden = SOFT_CLUSTER_FIXTURES.find(({ id }) => id === 'SC18')!;
  const visible = { ...hidden };
  delete visible.filters;
  groups.SC18 = {
    label: 'SC18 — hide and restore',
    revisions: {
      visible: visible as EndpointFixtureSpec,
      hidden,
      restored: visible as EndpointFixtureSpec,
    },
  };
  const reroot = SOFT_CLUSTER_FIXTURES.find(({ id }) => id === 'SC19')!;
  groups.SC19 = {
    label: 'SC19 — reroot',
    revisions: {
      'Focus root': reroot,
      'A1 root': { ...reroot, rootDocumentId: 'A1' },
    },
  };
  return groups;
}

function artifact(spec: EndpointFixtureSpec) {
  const fixture = buildEndpointFixture(spec);
  const referenceInput = createLayoutInput(fixture, {
    ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
    directionalFolderBandsEnabled: true,
  });
  const reference = computeFocusSchematicComputedLayoutAttempt(referenceInput, {
    endpointOrderPolicy: 'crossing-optimized',
    internalLayoutVariant: 'adaptive-compass',
  });
  if (reference.status !== 'success')
    throw new Error(`${spec.id}/directional: ${reference.reason}`);
  const softInput = createLayoutInput(fixture, {
    ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
    directionalFolderBandsEnabled: false,
  });
  const soft = Object.fromEntries(
    orderPolicies.map((policy) => [
      policy,
      Object.fromEntries(
        internalVariants.map((internal) => [
          internal,
          Object.fromEntries(
            strengths.map((strength) => {
              const attempt = computeFocusSchematicSoftClusterLayoutAttempt(
                softInput,
                {
                  strength,
                  endpointOrderPolicy: policy,
                  internalLayoutVariant: internal,
                },
              );
              if (attempt.status !== 'success')
                throw new Error(
                  `${spec.id}/${policy}/${internal}/${strength}: ${attempt.reason}`,
                );
              return [
                strength,
                {
                  candidate: attempt.result.candidate,
                  attachments: attempt.result.attachments,
                  quality: attempt.result.quality,
                  evidence: attempt.evidence,
                },
              ];
            }),
          ),
        ]),
      ),
    ]),
  );
  const projectionKinds = Object.fromEntries(
    fixture.projection.nodes.flatMap((node) =>
      node.kind === 'entity' ? [[node.id, node.entityKind]] : [],
    ),
  );
  return {
    explanation: {
      authored: spec.authored,
      expectation: spec.expectation,
      inspect: spec.inspect,
    },
    model: {
      rootModuleId: fixture.model.rootModuleId,
      modules: fixture.model.modules.map(
        ({ id, folderKey, presentation, focusDistance }) => ({
          id,
          folderKey: presentation === 'filtered' ? null : folderKey,
          presentation,
          focusDistance,
        }),
      ),
      nodeKinds: projectionKinds,
      hierarchyEdges: fixture.projection.edges.flatMap((edge) =>
        edge.kind === 'hierarchy'
          ? [
              {
                sourceNodeId: edge.sourceNodeId,
                targetNodeId: edge.targetNodeId,
              },
            ]
          : [],
      ),
    },
    connections: reference.result.endpointPlan.connections.map(
      ({ id, role, sourceModuleId, targetModuleId }) => ({
        id,
        role,
        sourceModuleId,
        targetModuleId,
      }),
    ),
    directional: {
      candidate: reference.result.candidate,
      attachments: reference.result.attachments,
      quality: reference.result.quality,
      evidence: {
        layoutFamily: 'directional-folder-bands',
        folderBandQuality: reference.result.folderBandQuality,
        runtimeMs: reference.timings.totalMs,
      },
    },
    soft,
  };
}

export async function writeSoftClusterLab(
  requestedOutput?: string,
): Promise<string> {
  const output = requestedOutput ?? 'output/hier4b-soft-clusters-lab';
  const outputDirectory = isAbsolute(output)
    ? output
    : resolve(repositoryRoot, output);
  const data = Object.fromEntries(
    Object.entries(scenarios()).map(([id, group]) => [
      id,
      {
        label: group.label,
        revisions: Object.fromEntries(
          Object.entries(group.revisions).map(([revision, spec]) => [
            revision,
            artifact(spec),
          ]),
        ),
      },
    ]),
  );
  const serialized = JSON.stringify(data).replaceAll('<', '\\u003c');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>HIER4B PATCH1 Soft Compass Lab</title>
<style>
:root{color-scheme:dark;font:14px/1.45 Inter,system-ui,sans-serif;background:#08101a;color:#e8f0fb}*{box-sizing:border-box}body{margin:0}.top{position:sticky;top:0;z-index:3;background:#0e1825f2;border-bottom:1px solid #2a3b50;padding:13px 18px;backdrop-filter:blur(12px)}h1{font-size:18px;margin:0 0 9px}.controls{display:flex;flex-wrap:wrap;align-items:end;gap:9px 15px}label{display:grid;gap:3px;color:#b5c5d9;font-size:11px}select{font:inherit;color:#f3f7fc;background:#17263a;border:1px solid #3b526d;border-radius:7px;padding:6px 8px}.checks{display:flex;flex-wrap:wrap;gap:9px}.checks label{display:flex;align-items:center;gap:4px}.content{padding:15px 18px 28px}.notes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-bottom:12px}.note{border:1px solid #273a50;background:#0d1723;border-radius:8px;padding:9px}.note b{display:block;color:#86bdff;margin-bottom:2px}.views{display:grid;grid-template-columns:repeat(auto-fit,minmax(440px,1fr));gap:12px}.panel{border:1px solid #2a3d53;background:#0b141f;border-radius:10px;overflow:hidden;min-width:0}.panel h2{font-size:13px;margin:0;padding:8px 11px;background:#121f2e;border-bottom:1px solid #2a3d53}.canvas{display:block;width:100%;height:660px}.module{fill:#13253acc;stroke:#6d8aad;stroke-width:2}.module.root{stroke:#ffc867;stroke-width:3}.module.filtered{stroke-dasharray:6 5;fill:#181d25}.bounds{fill:none;stroke:#ffcf7555;stroke-dasharray:5 4}.node{fill:#23415e;stroke:#8bb3dc;stroke-width:1.4}.node.section{fill:#1d344c}.node.block{fill:#172b3f}.label{fill:#f0f6ff;font-size:10px;text-anchor:middle;dominant-baseline:middle}.module-label{fill:#a9bdd3;font-size:10px;font-weight:700}.edge{fill:none;stroke:#b3c8df;stroke-width:2;opacity:.78}.edge.secondary{stroke:#73849a;stroke-dasharray:5 5;opacity:.38}.hierarchy{fill:none;stroke:#66819e;stroke-width:1.3;opacity:.65}.hull{fill:#63a8ff12;stroke:#63a8ff77;stroke-dasharray:9 6}.centroid{fill:#7ac0ff;stroke:#07101a;stroke-width:2}.hop{fill:none;stroke:#f4c96e40;stroke-dasharray:4 7}.metrics{white-space:pre-wrap;font:11px/1.45 ui-monospace,Consolas,monospace;padding:9px 11px;margin:0;color:#bcd0e6;border-top:1px solid #23364b}.decision{margin-top:13px;border:1px solid #35506f;background:#101d2c;border-radius:9px;padding:11px}.decision b{color:#8fc4ff}.legend{color:#9db1c7;margin:8px 0 0}.warning{color:#ffcb77}.hidden{display:none}
</style></head><body><div class="top"><h1>HIER4B PATCH1 Soft Compass Lab</h1><div class="controls">
<label>Scenario<select id="scenario"></select></label><label>Revision<select id="revision"></select></label>
<label>Macro layout<select id="macro"><option value="soft">Soft Clusters</option><option value="directional">Directional Bands reference</option></select></label>
<label>Strength<select id="strength">${strengths.map((value) => `<option${value === 50 ? ' selected' : ''}>${value}</option>`).join('')}</select></label>
<label>Internal layout<select id="internal"><option value="adaptive-compass">Adaptive Compass</option><option value="vertical-spine">Vertical Spine</option></select></label>
<label>Heading order<select id="order"><option value="crossing-optimized">Crossing optimized</option><option value="document-order">Markdown order</option></select></label>
<div class="checks">
${[
  ['links', 'Primary links / arrows', true],
  ['hulls', 'Folder hulls', true],
  ['centroids', 'Centroids', true],
  ['hops', 'Hop guides', false],
  ['bounds', 'Module bounds', false],
]
  .map(
    ([id, label, checked]) =>
      `<label><input id="${id}" type="checkbox"${checked ? ' checked' : ''}>${label}</label>`,
  )
  .join('')}
</div></div><p class="legend">SC16 deliberately shows all five strengths side by side. Directional Bands is the unchanged HIER4A production reference. Soft Clusters is development evidence only.</p></div>
<main class="content"><div class="notes"><div class="note"><b>Authored</b><span id="authored"></span></div><div class="note"><b>Expected</b><span id="expected"></span></div><div class="note"><b>Inspect</b><span id="inspect"></span></div></div><div id="views" class="views"></div>
<div class="decision"><b>Graphical review gate</b><br>After inspecting the priority cases SC3, SC5, SC7, SC9, SC11, SC14, SC15, SC16, SC17, SC21, SC23, and SC24, choose one decision and a preferred strength:<br>ADOPT_SOFT_FOLDER_CLUSTERS · SOFT_CLUSTERS_REQUIRE_TUNING · KEEP_DIRECTIONAL_BANDS_ONLY · SOFT_CLUSTERS_REQUIRE_REDESIGN</div></main>
<script>const DATA=${serialized};
const q=id=>document.getElementById(id);const controls=['scenario','revision','macro','strength','internal','order','links','hulls','centroids','hops','bounds'];
function options(select,entries){select.innerHTML=entries.map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('')}
options(q('scenario'),Object.entries(DATA).map(([id,g])=>[id,g.label]));q('scenario').value='SC16';
function revisions(){const g=DATA[q('scenario').value];options(q('revision'),Object.keys(g.revisions).map(v=>[v,v]))}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function boundsOf(candidate){const all=candidate.modules;return{l:Math.min(...all.map(r=>r.x))-180,t:Math.min(...all.map(r=>r.y))-180,r:Math.max(...all.map(r=>r.x+r.width))+180,b:Math.max(...all.map(r=>r.y+r.height))+180}}
function renderPanel(data,title){const candidate=data.candidate,model=current().model,box=boundsOf(candidate),width=box.r-box.l,height=box.b-box.t;const nodes=new Map(candidate.nodes.map(n=>[n.projectionNodeId,n]));const at=new Map(data.attachments.map(a=>[a.connectionId+':'+a.endpoint,a]));
const folders={};for(const m of model.modules){if(m.folderKey===null)continue;(folders[m.folderKey]??=[]).push(candidate.modules.find(x=>x.moduleId===m.id))}
const hulls=q('hulls').checked?Object.entries(folders).filter(([,ms])=>ms.length>1).map(([folder,ms])=>{const x=Math.min(...ms.map(r=>r.x))-36,y=Math.min(...ms.map(r=>r.y))-36,r=Math.max(...ms.map(r=>r.x+r.width))+36,b=Math.max(...ms.map(r=>r.y+r.height))+36;return '<g><rect class="hull" x="'+x+'" y="'+y+'" width="'+(r-x)+'" height="'+(b-y)+'" rx="42"/><text class="module-label" x="'+(x+12)+'" y="'+(y+18)+'">'+esc(folder)+'</text></g>'}).join(''):'';
const centroids=q('centroids').checked?Object.entries(folders).filter(([,ms])=>ms.length>1).map(([,ms])=>{const x=ms.reduce((s,r)=>s+r.x+r.width/2,0)/ms.length,y=ms.reduce((s,r)=>s+r.y+r.height/2,0)/ms.length;return '<circle class="centroid" cx="'+x+'" cy="'+y+'" r="7"/>'}).join(''):'';
const hopGuides=q('hops').checked?[1,2,3].map(h=>'<circle class="hop" cx="0" cy="0" r="'+(h*520)+'"/>').join(''):'';
const edges=q('links').checked?current().connections.map(c=>{const s=at.get(c.id+':source'),t=at.get(c.id+':target');if(!s||!t)return'';return '<path class="edge '+(c.role==='secondary'?'secondary':'')+'" marker-end="url(#arrow)" d="M '+s.x+' '+s.y+' L '+t.x+' '+t.y+'"/>'}).join(''):'';
const hierarchy=model.hierarchyEdges.map(e=>{const s=nodes.get(e.sourceNodeId),t=nodes.get(e.targetNodeId);if(!s||!t)return'';return '<path class="hierarchy" d="M '+(s.x+s.width/2)+' '+(s.y+s.height)+' L '+(t.x+t.width/2)+' '+t.y+'"/>'}).join('');
const modules=candidate.modules.map(m=>{const meta=model.modules.find(x=>x.id===m.moduleId);const root=m.moduleId===model.rootModuleId;return '<g><rect class="module '+(root?'root ':'')+(meta.presentation==='filtered'?'filtered':'')+'" x="'+m.x+'" y="'+m.y+'" width="'+m.width+'" height="'+m.height+'" rx="16"/><text class="module-label" x="'+(m.x+10)+'" y="'+(m.y+16)+'">'+esc(m.moduleId)+(meta.folderKey?' · '+esc(meta.folderKey):' · filtered')+'</text>'+(q('bounds').checked?'<rect class="bounds" x="'+m.x+'" y="'+m.y+'" width="'+m.width+'" height="'+m.height+'"/>':'')+'</g>'}).join('');
const nodeShapes=candidate.nodes.map(n=>'<g><rect class="node '+model.nodeKinds[n.projectionNodeId]+'" x="'+n.x+'" y="'+n.y+'" width="'+n.width+'" height="'+n.height+'" rx="8"/><text class="label" x="'+(n.x+n.width/2)+'" y="'+(n.y+n.height/2)+'">'+esc(n.projectionNodeId)+'</text></g>').join('');
const evidence=data.evidence;const metrics=evidence.metrics??evidence.folderBandQuality;const summary={family:evidence.layoutFamily,strength:evidence.strength??'categorical',crossings:data.quality.exactEndpointCrossingCount,overlaps:data.quality.moduleOverlapPairs.length,boundsArea:Math.round(data.quality.totalBoundsArea),folderRmsMean:metrics.repeatedFolderRmsRadiusMean??null,connectedDistanceMean:metrics.connectedPairDistanceMean??null,hopError:metrics.hopMeanAbsoluteRadiusError??null,compass:evidence.compass??null,layoutMs:evidence.runtime?.layoutMs??evidence.runtimeMs};
return '<section class="panel"><h2>'+esc(title)+'</h2><svg class="canvas" viewBox="'+box.l+' '+box.t+' '+width+' '+height+'"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#b3c8df"/></marker></defs>'+hopGuides+hulls+edges+hierarchy+modules+nodeShapes+centroids+'</svg><pre class="metrics">'+esc(JSON.stringify(summary,null,2))+'</pre></section>'}
function current(){return DATA[q('scenario').value].revisions[q('revision').value]}
function render(){const d=current();q('authored').textContent=d.explanation.authored;q('expected').textContent=d.explanation.expectation;q('inspect').textContent=d.explanation.inspect;let panels=[];if(q('macro').value==='directional')panels=[renderPanel(d.directional,'Directional Bands reference')];else{const selected=d.soft[q('order').value][q('internal').value];const values=q('scenario').value==='SC16'?[0,25,50,75,100]:[Number(q('strength').value)];panels=values.map(v=>renderPanel(selected[v],'Soft Clusters · strength '+v))}q('views').innerHTML=panels.join('')}
q('scenario').addEventListener('change',()=>{revisions();render()});for(const id of controls.slice(1))q(id).addEventListener('change',render);revisions();render();</script></body></html>`;
  await mkdir(outputDirectory, { recursive: true });
  const indexPath = resolve(outputDirectory, 'index.html');
  await writeFile(indexPath, html, 'utf8');
  await writeFile(
    resolve(outputDirectory, 'README.txt'),
    'HIER4B-PATCH1 development-only Soft Compass graphical QA. Directional settings are unchanged.\n',
    'utf8',
  );
  return indexPath;
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const outIndex = process.argv.indexOf('--out');
  const requested = outIndex < 0 ? undefined : process.argv[outIndex + 1];
  const indexPath = await writeSoftClusterLab(requested);
  process.stdout.write(`Generated ${indexPath}\n`);
}
