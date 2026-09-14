import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildEndpointFixture,
  computeFocusSchematicComputedLayoutAttempt,
  FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
  NESTED_DIRECTIONAL_FOLDER_FIXTURES,
  type EndpointFixtureSpec,
} from '@icarus-graph-explorer/focus-schematic-layout';

import { createLayoutInput } from './dimensions';

const outIndex = process.argv.indexOf('--out');
const requestedOutput =
  outIndex < 0
    ? 'output/hier4a-patch2-nested-directional-lab'
    : (process.argv[outIndex + 1] ??
      'output/hier4a-patch2-nested-directional-lab');
const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const outputDirectory = isAbsolute(requestedOutput)
  ? requestedOutput
  : resolve(repositoryRoot, requestedOutput);

const reviewIds = new Set([
  'ND1',
  'ND3',
  'ND4',
  'ND6',
  'ND7',
  'ND8',
  'ND9',
  'ND12',
]);
const reviewFixtures = NESTED_DIRECTIONAL_FOLDER_FIXTURES.filter(({ id }) =>
  reviewIds.has(id),
);

function artifact(
  spec: EndpointFixtureSpec,
  directionalFolderHierarchy: 'flat' | 'nested-one-level',
) {
  const fixture = buildEndpointFixture(spec);
  const input = createLayoutInput(fixture, {
    ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
    directionalFolderBandsEnabled: true,
    directionalFolderHierarchy,
  });
  const attempt = computeFocusSchematicComputedLayoutAttempt(input, {
    endpointOrderPolicy: 'crossing-optimized',
    internalLayoutVariant: 'adaptive-compass',
  });
  if (attempt.status !== 'success')
    throw new Error(
      `${spec.id}/${directionalFolderHierarchy}: ${attempt.reason}`,
    );
  return {
    candidate: attempt.result.candidate,
    attachments: attempt.result.attachments,
    connections: attempt.result.endpointPlan.connections.map(
      ({ id, kind, role }) => ({ id, kind, role }),
    ),
    folderBandPlan: attempt.result.folderBandPlan,
    quality: attempt.result.quality,
    timings: attempt.timings,
    rootModuleId: fixture.model.rootModuleId,
    modules: fixture.model.modules.map(({ id, folderKey }) => ({
      id,
      folderKey,
    })),
  };
}

const data = Object.fromEntries(
  reviewFixtures.map((spec) => [
    spec.id,
    {
      label: `${spec.id} — ${spec.label}`,
      authored: spec.authored,
      expectation: spec.expectation,
      flat: artifact(spec, 'flat'),
      nested: artifact(spec, 'nested-one-level'),
    },
  ]),
);

const serialized = JSON.stringify(data).replaceAll('<', '\\u003c');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>HIER4A PATCH2 Nested Directional Bands Lab</title><style>
:root{color-scheme:dark;font:14px/1.45 Inter,system-ui,sans-serif;background:#0b0f16;color:#e7edf7}*{box-sizing:border-box}body{margin:0}.top{position:sticky;top:0;z-index:2;background:#101722f2;border-bottom:1px solid #293548;padding:14px 18px}h1{font-size:18px;margin:0 0 10px}.controls{display:flex;gap:16px;flex-wrap:wrap}label{display:grid;gap:4px;color:#b8c7db;font-size:12px}select{font:inherit;color:#eef5ff;background:#182334;border:1px solid #3b4b62;border-radius:7px;padding:7px 9px}.content{padding:16px 18px}.notes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:14px}.note{border:1px solid #263449;background:#111925;border-radius:9px;padding:10px}.canvas{width:100%;height:720px;border:1px solid #29384d;background:#0d131d;border-radius:10px}.parent{fill:#6ca0ff09;stroke:#7eb3ff70;stroke-width:1.4;stroke-dasharray:3 8}.band{fill:#6ca0ff12;stroke:#6ca0ff99;stroke-width:1.5;stroke-dasharray:8 6}.band.root{fill:#f7c66c12;stroke:#f7c66caa}.parent-label,.band-label{fill:#b8d2ff;font-weight:700}.parent-label{font-size:12px}.band-label{font-size:11px}.module{fill:#152033;stroke:#6680a3;stroke-width:2}.module.root{stroke:#f7c66c;stroke-width:3}.module-label{fill:#dce9fa;font-size:11px;font-weight:650}.node{fill:#223752;stroke:#8ca8cc;stroke-width:1.3}.node-label{fill:#f2f7ff;font-size:10px;text-anchor:middle;dominant-baseline:middle}.edge{stroke:#a9bdd7;stroke-width:2;fill:none;opacity:.72}.metrics{white-space:pre-wrap;font:12px/1.5 ui-monospace,Consolas,monospace;color:#bdd0e8}.questions{color:#b8c7db}.questions li{margin:5px 0}@media(max-width:800px){.notes{grid-template-columns:1fr}.canvas{height:560px}}
</style></head><body><header class="top"><h1>HIER4A PATCH2 · One-Level Nested Directional Folder Bands</h1><div class="controls">
<label>Scenario<select id="scenario"></select></label><label>Hierarchy<select id="mode"><option value="nested" selected>Nested (1 level)</option><option value="flat">Flat</option></select></label><label>Folder guides<select id="guides"><option value="on" selected>On</option><option value="off">Off</option></select></label><label>Precise links<select id="links"><option value="on" selected>On</option><option value="off">Off</option></select></label>
</div></header><main class="content"><section class="notes" id="notes"></section><svg class="canvas" id="canvas" role="img"></svg><pre class="metrics" id="metrics"></pre><ol class="questions"><li>Does the outer parent boundary make the folder structure easier to parse?</li><li>Are direct parent Files understandable without a fake label?</li><li>Is simplifying a sole singleton child correct?</li><li>Should singleton children remain visible when siblings exist?</li><li>Is one nesting level enough?</li><li>Does hard folder containment hurt arrow readability too much?</li><li>Are short nested labels clearer than repeated full paths?</li><li>Does excluding the Focus folder from parent nesting feel correct?</li></ol></main>
<script>const DATA=${serialized};const scenario=document.querySelector('#scenario'),mode=document.querySelector('#mode'),guides=document.querySelector('#guides'),links=document.querySelector('#links'),canvas=document.querySelector('#canvas'),notes=document.querySelector('#notes'),metrics=document.querySelector('#metrics');const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const entity=v=>{try{const p=JSON.parse(v);return Array.isArray(p)&&p[0]==='entity'?p[1]:v}catch{return v}};for(const [id,item] of Object.entries(DATA)){const option=document.createElement('option');option.value=id;option.textContent=item.label;scenario.append(option)}scenario.value='ND4';function bounds(item){const rectangles=[...item.candidate.modules,...(item.folderBandPlan.hierarchy?.parentContainers??[]).map(p=>({x:p.x,y:p.topY,width:p.width,height:p.height}))];const left=Math.min(...rectangles.map(r=>r.x)),right=Math.max(...rectangles.map(r=>r.x+r.width)),top=Math.min(...rectangles.map(r=>r.y)),bottom=Math.max(...rectangles.map(r=>r.y+r.height));return{x:left-90,y:top-70,width:right-left+180,height:bottom-top+140}}function render(){const source=DATA[scenario.value],item=source[mode.value],b=bounds(item),moduleInfo=new Map(item.modules.map(m=>[m.id,m])),attachments=new Map(item.attachments.map(a=>[a.connectionId+':'+a.endpoint,a]));canvas.setAttribute('viewBox',[b.x,b.y,b.width,b.height].join(' '));canvas.setAttribute('aria-label',source.label+' '+mode.options[mode.selectedIndex].text);let out='<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#a9bdd7"/></marker></defs>';if(guides.value==='on'){const hierarchy=item.folderBandPlan.hierarchy;if(hierarchy)for(const parent of hierarchy.parentContainers)out+='<g><title>'+esc(parent.fullLabel)+'</title><rect class="parent" x="'+parent.x+'" y="'+parent.topY+'" width="'+parent.width+'" height="'+parent.height+'" rx="14"/><text class="parent-label" x="'+(parent.x+14)+'" y="'+(parent.topY-8)+'">'+esc(parent.label)+'</text></g>';for(const band of item.folderBandPlan.bands){let x=b.x+35,width=b.width-70,label=band.folderKey;if(hierarchy){const child=hierarchy.internalUnits.find(u=>u.kind==='child-band'&&u.folderKey===band.folderKey);if(child){x=child.x;width=child.width;label=child.label}else if(!band.root&&hierarchy.topLevelUnits.some(u=>u.kind==='parent-container'&&u.folderKey===band.folderKey))continue}out+='<g><title>'+esc(band.folderKey)+'</title><rect class="band '+(band.root?'root':'')+'" x="'+x+'" y="'+band.topY+'" width="'+width+'" height="'+band.height+'" rx="12"/><text class="band-label" x="'+(x+12)+'" y="'+(band.topY-8)+'">'+esc(label)+'</text></g>'}}if(links.value==='on')for(const connection of item.connections){if(connection.kind!=='precise'||connection.role==='secondary')continue;const s=attachments.get(connection.id+':source'),t=attachments.get(connection.id+':target');if(s&&t)out+='<path class="edge" d="M'+s.x+' '+s.y+' L'+t.x+' '+t.y+'" marker-end="url(#arrow)"/>'}for(const module of item.candidate.modules){const info=moduleInfo.get(module.moduleId);out+='<g><rect class="module '+(module.moduleId===item.rootModuleId?'root':'')+'" x="'+module.x+'" y="'+module.y+'" width="'+module.width+'" height="'+module.height+'" rx="9"/><text class="module-label" x="'+(module.x+9)+'" y="'+(module.y+16)+'">'+esc(module.moduleId)+'</text><title>'+esc(info?.folderKey??'')+'</title></g>'}for(const node of item.candidate.nodes)out+='<g><rect class="node" x="'+node.x+'" y="'+node.y+'" width="'+node.width+'" height="'+node.height+'" rx="7"/><text class="node-label" x="'+(node.x+node.width/2)+'" y="'+(node.y+node.height/2)+'">'+esc(entity(node.projectionNodeId))+'</text></g>';canvas.innerHTML=out;notes.innerHTML='<div class="note"><b>Authored</b><br>'+esc(source.authored)+'</div><div class="note"><b>Expected</b><br>'+esc(source.expectation)+'</div>';const h=item.folderBandPlan.hierarchy,q=item.quality,s=h?.summary;metrics.textContent=['mode '+mode.options[mode.selectedIndex].text,'Files '+item.folderBandPlan.summary.visibleModuleCount+' · exact folders '+item.folderBandPlan.summary.visibleFolderCount,'parents '+(s?.parentContainerCount??0)+' · child bands '+(s?.childBandCount??0)+' · standalone '+(s?.standaloneBandCount??item.folderBandPlan.bands.length),'simplified singleton children '+(s?.simplifiedSingletonChildCount??0),'parent local sweeps/changes '+(s?.parentLocalOrderingSweepCount??0)+' / '+(s?.parentLocalOrderingChangeCount??0),'crossings '+q.exactEndpointCrossingCount+' · inversions '+q.adjacentRankOrderInversionCount,'layout '+Math.round(item.timings.totalMs*10)/10+' ms'].join('\\n')}for(const control of [scenario,mode,guides,links])control.addEventListener('change',render);render();</script></body></html>`;

export async function writeNestedDirectionalFolderLab(
  targetDirectory = outputDirectory,
): Promise<string> {
  await mkdir(targetDirectory, { recursive: true });
  const indexPath = resolve(targetDirectory, 'index.html');
  await writeFile(indexPath, html, 'utf8');
  await writeFile(
    resolve(targetDirectory, 'README.txt'),
    'HIER4A PATCH2 offline Flat versus Nested (1 level) review lab. Open index.html directly; it has no network dependencies.\n',
    'utf8',
  );
  return indexPath;
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.stdout.write(
    `Generated ${await writeNestedDirectionalFolderLab()}\n`,
  );
}
