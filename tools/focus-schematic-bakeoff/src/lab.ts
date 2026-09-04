import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeFocusSchematicLayoutAttempt,
  FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
} from '@icarus-graph-explorer/focus-schematic-layout';

import { createLayoutInput } from './dimensions';
import {
  buildFixture,
  hubFixture,
  SEMANTIC_FIXTURES,
  STABILITY_PAIRS,
  type FixtureSpec,
} from './fixtures';
import {
  computeClassicBaselineAttempt,
  computeCompoundAttempt,
  evaluateHardGates,
} from './strategies';

const outIndex = process.argv.indexOf('--out');
const requestedOutput =
  outIndex < 0
    ? 'output/hier2-layout-lab'
    : (process.argv[outIndex + 1] ?? 'output/hier2-layout-lab');
const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const outputDirectory = isAbsolute(requestedOutput)
  ? requestedOutput
  : resolve(repositoryRoot, requestedOutput);

const configs = {
  compact: FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
  normal: {
    ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
    internalNodeSeparation: 32,
    internalRankSeparation: 56,
    macroNodeSeparation: 48,
    macroRankSeparation: 96,
  },
} as const;

const groups: Record<
  string,
  { label: string; revisions: Record<string, FixtureSpec> }
> = {};
for (const spec of [...SEMANTIC_FIXTURES, hubFixture(48)])
  groups[spec.id] = {
    label: `${spec.id} — ${spec.label}`,
    revisions: { base: spec },
  };
for (const pair of STABILITY_PAIRS.filter(({ id }) =>
  ['S1', 'S3'].includes(id),
))
  groups[pair.id] = {
    label: `${pair.id} — stability: ${pair.label}`,
    revisions: { before: pair.before, after: pair.after },
  };

const data = Object.fromEntries(
  Object.entries(groups).map(([groupId, group]) => [
    groupId,
    {
      label: group.label,
      revisions: Object.fromEntries(
        Object.entries(group.revisions).map(([revisionId, spec]) => [
          revisionId,
          Object.fromEntries(
            (['compact-bridge', 'context-card'] as const).map(
              (filteredPolicy) => [
                filteredPolicy,
                Object.fromEntries(
                  Object.entries(configs).map(([configId, settings]) => {
                    const fixture = buildFixture(spec);
                    const input = createLayoutInput(fixture, {
                      ...settings,
                      filteredModulePolicy: filteredPolicy,
                    });
                    const attempts = {
                      D0: computeClassicBaselineAttempt(input),
                      A: computeFocusSchematicLayoutAttempt(input),
                      B: computeCompoundAttempt(input),
                      C: {
                        status: 'unsupported',
                        strategyId: 'C-bounded-postpass',
                        configId: 'not-built',
                        reason:
                          'Not built: pure two-stage Dagre passed every hard gate and showed no measurable rank/alignment weakness meeting the HIER2 material-improvement rule.',
                      },
                    };
                    return [
                      configId,
                      {
                        model: fixture.model,
                        projection: fixture.projection,
                        attempts: Object.fromEntries(
                          Object.entries(attempts).map(
                            ([strategy, attempt]) => [
                              strategy,
                              'candidate' in attempt
                                ? {
                                    ...attempt,
                                    hardGates: evaluateHardGates(attempt),
                                  }
                                : attempt,
                            ],
                          ),
                        ),
                      },
                    ];
                  }),
                ),
              ],
            ),
          ),
        ]),
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
<title>HIER2 Focus Schematic Layout Lab</title>
<style>
:root{color-scheme:dark;--bg:#0b1020;--panel:#121a2d;--ink:#ecf3ff;--muted:#96a5bd;--line:#31405e;--accent:#6ee7d8;--warn:#ffca6e;--bad:#ff7e8a;--left:#759dff;--right:#c084fc}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.4 ui-sans-serif,system-ui,sans-serif}header{position:sticky;top:0;z-index:3;background:#0b1020ee;border-bottom:1px solid var(--line);padding:16px 20px}h1{font-size:20px;margin:0 0 4px}.intro{color:var(--muted);max-width:1000px}.controls{display:flex;flex-wrap:wrap;gap:12px;margin-top:12px;align-items:end}.controls label{display:grid;gap:4px;color:var(--muted);font-size:12px}.checks{display:flex;gap:12px;align-items:center;padding-bottom:5px}.checks label{display:flex;gap:5px;color:var(--ink)}select{background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:7px}.legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;color:var(--muted);font-size:12px}.swatch{display:inline-block;width:18px;border-top:2px solid var(--accent);vertical-align:middle;margin-right:4px}.swatch.native{border-top-style:dashed}.swatch.secondary{border-top-color:#78869d;border-top-style:dotted}.swatch.backbone{border-top-width:4px}.grid{display:grid;grid-template-columns:repeat(2,minmax(420px,1fr));gap:14px;padding:16px}@media(max-width:950px){.grid{grid-template-columns:1fr}}.panel{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}.panel header{position:static;background:#162038;border:0;padding:10px 12px;display:flex;justify-content:space-between}.status{font-size:12px}.pass{color:var(--accent)}.fail{color:var(--bad)}.unsupported{color:var(--warn)}svg{display:block;width:100%;height:430px;background:#0e1628}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;padding:9px 12px;border-top:1px solid var(--line);font-size:11px;color:var(--muted)}.message{height:430px;display:grid;place-items:center;padding:40px;text-align:center;color:var(--warn)}.guide{stroke:#34425f;stroke-width:1;stroke-dasharray:4 5}.module{fill:#18243b;stroke:#6f819e;stroke-width:1.5;stroke-dasharray:6 4}.module.root{stroke:var(--accent);stroke-width:3}.module.filtered{fill:#2d2934;stroke:var(--warn)}.node{stroke:#9eb0ca;stroke-width:1}.document{fill:#24496b}.section{fill:#3b3d72}.block{fill:#4f3d63}.edge{stroke:#65d9c8;stroke-width:1.5;fill:none;opacity:.8}.edge.secondary{stroke:#78869d;stroke-dasharray:2 5}.edge.backbone{stroke-width:3}.edge.native{stroke:var(--warn);stroke-dasharray:7 4}.label{fill:#eef6ff;font-size:11px;pointer-events:none}.small{fill:#a9b7cc;font-size:9px}.folder{fill:#ffd98a;font-size:9px}.diagnostic{fill:#ffca6e;opacity:.25}.ranklabel{fill:#71809a;font-size:10px}.hidden{display:none}
</style>
</head>
<body>
<header><h1>HIER2 · Dagre-first Focus Schematic layout lab</h1><div class="intro">Synthetic evidence only. D0 is the preserved Classic baseline. A and B consume the same HIER2 plan, dimensions, padding, filtered policy, and backbone. C truthfully remains unbuilt because A cleared the material-improvement gate. Approximate edges are exploratory; native routes are shown separately.</div>
<div class="controls">
<label>Fixture<select id="fixture"></select></label><label>Revision<select id="revision"></select></label><label>Panels<select id="strategy"><option value="all">D0 / A / B / C</option><option>D0</option><option>A</option><option>B</option><option>C</option></select></label><label>Configuration<select id="config"><option value="compact">Frozen compact</option><option value="normal">Calibration normal</option></select></label><label>Filtered module<select id="filtered"><option value="compact-bridge">F-A compact bridge</option><option value="context-card">F-B context card</option></select></label><label>Edges<select id="routes"><option value="approximate">Approximate center edges</option><option value="native">Native Dagre backbone routes</option></select></label>
<div class="checks"><label><input id="bounds" type="checkbox" checked>Bounds</label><label><input id="folders" type="checkbox" checked>Folders</label><label><input id="secondary" type="checkbox" checked>Secondary</label></div></div>
<div class="legend"><span><i class="swatch backbone"></i>selected backbone</span><span><i class="swatch"></i>other Focus path</span><span><i class="swatch secondary"></i>secondary</span><span><i class="swatch native"></i>native Dagre route</span></div></header>
<main id="grid" class="grid"></main>
<script>const DATA=${serialized};
const fixture=document.querySelector('#fixture'),revision=document.querySelector('#revision'),strategy=document.querySelector('#strategy'),config=document.querySelector('#config'),filtered=document.querySelector('#filtered'),routes=document.querySelector('#routes'),bounds=document.querySelector('#bounds'),folders=document.querySelector('#folders'),secondary=document.querySelector('#secondary'),grid=document.querySelector('#grid');
const esc=v=>String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
for(const [id,item] of Object.entries(DATA)){const o=document.createElement('option');o.value=id;o.textContent=item.label;fixture.append(o)}fixture.value='F4';
function revisions(){const prior=revision.value;revision.innerHTML='';for(const id of Object.keys(DATA[fixture.value].revisions)){const o=document.createElement('option');o.value=id;o.textContent=id;revision.append(o)}if([...revision.options].some(o=>o.value===prior))revision.value=prior}
function center(r){return{x:r.x+r.width/2,y:r.y+r.height/2}}function path(points){return points.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ')}
function panel(key,item){const attempt=item.attempts[key];const gate=attempt.hardGates;const ok=attempt.status==='success';const cls=ok?(gate?.passed?'pass':'fail'):'unsupported';const status=ok?(gate?.passed?'hard gates pass':'hard gates fail: '+gate.failures.join(', ')):attempt.status+': '+attempt.reason;if(!ok)return '<section class="panel panel-'+key+'"><header><strong>'+key+' · '+esc(attempt.strategyId)+'</strong><span class="status '+cls+'">'+esc(attempt.status)+'</span></header><div class="message">'+esc(attempt.reason)+'</div></section>';
const c=attempt.candidate,model=item.model,moduleMap=new Map(c.modules.map(m=>[m.moduleId,m])),nodeKinds=new Map(item.projection.nodes.filter(n=>n.kind==='entity').map(n=>[n.id,n.entityKind]));const all=[...c.modules,...c.nodes],minX=Math.min(...all.map(r=>r.x))-90,minY=Math.min(...all.map(r=>r.y))-70,maxX=Math.max(...all.map(r=>r.x+r.width))+90,maxY=Math.max(...all.map(r=>r.y+r.height))+70;let svg='';
for(const rank of [...new Set(attempt.plan.modules.map(p=>p.signedRank))]){const members=attempt.plan.modules.filter(p=>p.signedRank===rank).map(p=>moduleMap.get(p.moduleId)).filter(Boolean);if(members.length){const x=members.reduce((s,m)=>s+center(m).x,0)/members.length;svg+='<line class="guide" x1="'+x+'" y1="'+minY+'" x2="'+x+'" y2="'+maxY+'"/><text class="ranklabel" x="'+(x+5)+'" y="'+(minY+14)+'">rank '+rank+'</text>'}}
const selected=new Set(attempt.plan.modules.map(p=>p.parentRelationshipId).filter(Boolean));if(routes.value==='native'&&attempt.nativeRoutes.length){for(const r of attempt.nativeRoutes)svg+='<path class="edge native" d="'+path(r.points)+'"/>'}else{for(const r of model.relationships){if(r.secondary&&!secondary.checked)continue;const a=moduleMap.get(r.sourceModuleId),b=moduleMap.get(r.targetModuleId);if(!a||!b)continue;svg+='<path class="edge '+(r.secondary?'secondary ':'')+(selected.has(r.id)?'backbone':'')+'" d="'+path([center(a),center(b)])+'"/>'}}
if(bounds.checked)for(const m of c.modules){const semantic=model.modules.find(x=>x.id===m.moduleId),root=m.moduleId===model.rootModuleId;svg+='<rect class="module '+(root?'root ':'')+(semantic?.presentation==='filtered'?'filtered':'')+'" x="'+m.x+'" y="'+m.y+'" width="'+m.width+'" height="'+m.height+'" rx="10"/><text class="small" x="'+(m.x+8)+'" y="'+(m.y+15)+'">'+esc(semantic?.presentation==='filtered'?'Filtered path intermediary':m.moduleId)+'</text>';if(folders.checked)svg+='<text class="folder" x="'+(m.x+8)+'" y="'+(m.y+m.height-8)+'">folder '+esc(semantic?.folderKey??'.')+'</text>';if((semantic?.diagnosticIds.length??0)>0)svg+='<rect class="diagnostic" x="'+(m.x+4)+'" y="'+(m.y+m.height-32)+'" width="'+(m.width-8)+'" height="26"/><text class="small" x="'+(m.x+10)+'" y="'+(m.y+m.height-14)+'">'+semantic.diagnosticIds.length+' diagnostics reserved</text>'}
for(const n of c.nodes){const kind=nodeKinds.get(n.projectionNodeId)||'document';svg+='<rect class="node '+kind+'" x="'+n.x+'" y="'+n.y+'" width="'+n.width+'" height="'+n.height+'" rx="6"/><text class="label" x="'+(n.x+8)+'" y="'+(n.y+20)+'">'+esc(kind)+'</text><text class="small" x="'+(n.x+8)+'" y="'+(n.y+34)+'">'+esc(n.projectionNodeId)+'</text>'}
const q=attempt.quality;return '<section class="panel panel-'+key+'"><header><strong>'+key+' · '+esc(attempt.strategyId)+'</strong><span class="status '+cls+'">'+esc(status)+'</span></header><svg viewBox="'+minX+' '+minY+' '+(maxX-minX)+' '+(maxY-minY)+'" preserveAspectRatio="xMidYMid meet">'+svg+'</svg><div class="metrics"><span>area '+Math.round(q.totalBoundsArea).toLocaleString()+'</span><span>cross '+(q.approximateCrossingCount??'route')+'</span><span>align p95 '+(q.p95AttachmentAlignmentError??'n/a')+'</span><span>native '+Math.round(attempt.routeCoverage*100)+'%</span><span>folder adj '+(q.sameFolderAdjacencyRatio??'n/a')+'</span><span>total '+attempt.timings.totalMs+' ms</span><span>ties '+attempt.plan.arbitraryTieBreakCount+'</span><span>'+esc(attempt.configId)+'</span></div></section>'}
function render(){const item=DATA[fixture.value].revisions[revision.value][filtered.value][config.value];const keys=strategy.value==='all'?['D0','A','B','C']:[strategy.value];grid.innerHTML=keys.map(k=>panel(k,item)).join('')}
fixture.addEventListener('change',()=>{revisions();render()});for(const el of [revision,strategy,config,filtered,routes,bounds,folders,secondary])el.addEventListener('change',render);revisions();render();
</script></body></html>`;

await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, 'index.html'), html, 'utf8');
await writeFile(
  resolve(outputDirectory, 'README.txt'),
  'Synthetic HIER2 layout lab. Serve this directory over a local HTTP server and open index.html. No network resources are used.\n',
  'utf8',
);
process.stdout.write(`Generated ${resolve(outputDirectory, 'index.html')}\n`);
