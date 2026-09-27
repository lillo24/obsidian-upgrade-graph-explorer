import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createFocusSchematicModel } from '@icarus-graph-explorer/focus-schematic';
import {
  buildEndpointFixture,
  classifyFocusSchematicLayoutTransition,
  computeFocusSchematicIncrementalLayoutAttempt,
  computeFocusSchematicSoftClusterLayoutAttempt,
  createFocusSchematicLayoutTransitionPrior,
  FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
  type EndpointFixtureSpec,
  type FocusSchematicComputedLayout,
  type FocusSchematicLayoutInput,
  type FocusSchematicProductLayoutPolicies,
} from '@icarus-graph-explorer/focus-schematic-layout';
import { projectLocalView } from '@icarus-graph-explorer/view-projection';
import { createLayoutInput } from './dimensions';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const policies: FocusSchematicProductLayoutPolicies = {
  macroLayout: 'soft-folder-clusters',
  softFolderStrength: 50,
  softFolderScopeMode: 'nested',
  softAncestorDecayBase: 3,
  softFolderDisplayIntent: { fileParentOverrides: [], flattenedFolderKeys: [] },
  endpointOrderPolicy: 'crossing-optimized',
  internalLayoutVariant: 'adaptive-compass',
};

const fixtureSpec: EndpointFixtureSpec = {
  id: 'SS22-before',
  label: 'HIERSTAB1 graphical continuity',
  authored: 'Synthetic Focus with four branches and two exact-folder groups.',
  expectation: 'Small semantic edits keep established File positions.',
  inspect: 'Compare movement vectors from Before to both After layouts.',
  rootDocumentId: 'Focus',
  documents: [
    { id: 'Focus', path: 'root/Focus.md' },
    { id: 'Alpha', path: 'science/Alpha.md' },
    { id: 'Beta', path: 'science/Beta.md' },
    { id: 'Gamma', path: 'language/Gamma.md' },
  ],
  entities: [
    ...['H1', 'H2', 'H3', 'H4'].map((id, index) => ({
      id,
      kind: 'section' as const,
      documentId: 'Focus',
      parentId: 'Focus',
      line: 2 + index * 2,
    })),
    ...['Alpha', 'Beta', 'Gamma'].map((documentId) => ({
      id: `${documentId}-target`,
      kind: 'section' as const,
      documentId,
      parentId: documentId,
      line: 2,
    })),
  ],
  references: [
    { sourceEntityId: 'H1', targetEntityId: 'Alpha-target' },
    { sourceEntityId: 'H2', targetEntityId: 'Beta-target' },
    { sourceEntityId: 'Focus', targetEntityId: 'Gamma-target' },
  ],
  hops: 1,
};

function cold(input: FocusSchematicLayoutInput): FocusSchematicComputedLayout {
  const attempt = computeFocusSchematicSoftClusterLayoutAttempt(input, {
    strength: policies.softFolderStrength,
    folderScopeMode: policies.softFolderScopeMode,
    ancestorDecayBase: policies.softAncestorDecayBase,
    displayIntent: policies.softFolderDisplayIntent,
    endpointOrderPolicy: policies.endpointOrderPolicy,
    internalLayoutVariant: policies.internalLayoutVariant,
  });
  if (attempt.status !== 'success') throw new Error(attempt.reason);
  return attempt.result;
}

function inputForHidden(
  built: ReturnType<typeof buildEndpointFixture>,
  hiddenEntityIds: readonly string[],
): FocusSchematicLayoutInput {
  const state = {
    ...built.state,
    disclosure: { ...built.state.disclosure, hiddenEntityIds },
  };
  const projection = projectLocalView(built.workspace, state);
  const model = createFocusSchematicModel({
    workspace: built.workspace,
    state,
    projection,
  });
  return createLayoutInput(
    { projection, model },
    {
      ...FOCUS_SCHEMATIC_LAYOUT_SETTINGS,
      directionalFolderBandsEnabled: false,
    },
  );
}

function comparison(
  beforeInput: FocusSchematicLayoutInput,
  afterInput: FocusSchematicLayoutInput,
  before: FocusSchematicComputedLayout,
) {
  const afterCold = cold(afterInput);
  const prior = createFocusSchematicLayoutTransitionPrior(
    beforeInput,
    policies,
    before,
  );
  const classification = classifyFocusSchematicLayoutTransition(
    afterInput,
    policies,
    prior,
  );
  const attempt = computeFocusSchematicIncrementalLayoutAttempt(
    afterInput,
    policies,
    prior,
    classification,
  );
  if (attempt.status !== 'success') throw new Error(attempt.reason);
  return {
    before: before.candidate,
    cold: afterCold.candidate,
    incremental: attempt.result.candidate,
    evidence: attempt.evidence,
  };
}

function data() {
  const built = buildEndpointFixture(fixtureSpec);
  const beforeInput = inputForHidden(built, []);
  const before = cold(beforeInput);
  const unconnected = comparison(
    beforeInput,
    inputForHidden(built, ['H4']),
    before,
  );
  const connected = comparison(
    beforeInput,
    inputForHidden(built, ['H1']),
    before,
  );
  const h4 = beforeInput.projection.nodes.find(
    (node) => node.kind === 'entity' && node.entityId === 'H4',
  );
  let growth: ReturnType<typeof comparison> | undefined;
  for (const width of [240, 300, 360, 420, 480, 560, 640, 720]) {
    const grown = {
      ...beforeInput,
      nodeDimensions: beforeInput.nodeDimensions.map((dimension) =>
        dimension.projectionNodeId === h4?.id
          ? { ...dimension, width }
          : dimension,
      ),
    };
    const result = comparison(beforeInput, grown, before);
    if (result.evidence.mode === 'incremental-local-repair') {
      growth = result;
      break;
    }
  }
  if (growth === undefined)
    throw new Error('Growth repair scenario was not found.');
  const alphaShrinkBase = inputForHidden(built, [
    'Alpha-target',
    'Beta-target',
  ]);
  const shrunkenFileIds = new Set(
    alphaShrinkBase.projection.nodes
      .filter(
        (node) =>
          node.kind === 'entity' &&
          (node.entityId === 'Alpha' || node.entityId === 'Beta'),
      )
      .map(({ id }) => id),
  );
  const folderShrink = comparison(
    beforeInput,
    {
      ...alphaShrinkBase,
      nodeDimensions: alphaShrinkBase.nodeDimensions.map((dimension) =>
        shrunkenFileIds.has(dimension.projectionNodeId)
          ? { ...dimension, width: 1 }
          : dimension,
      ),
    },
    before,
  );
  return {
    unconnected: { label: 'Unconnected H4 hide', ...unconnected },
    connected: {
      label: 'Connected Heading hide / endpoint roll-up',
      ...connected,
    },
    growth: { label: 'Growth collision / bounded repair', ...growth },
    folder: {
      label: 'Folder split / local folder-aware repair',
      ...folderShrink,
    },
  };
}

export async function writeIncrementalLayoutLab(requestedOutput?: string) {
  const output = requestedOutput ?? 'output/hierstab1-incremental-layout-lab';
  const directory = isAbsolute(output)
    ? output
    : resolve(repositoryRoot, output);
  const serialized = JSON.stringify(data()).replaceAll('<', '\\u003c');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HIERSTAB1 Continuity Lab</title><style>
:root{color-scheme:dark;font:14px/1.4 Inter,system-ui;background:#09121d;color:#edf5ff}*{box-sizing:border-box}body{margin:0}.top{position:sticky;top:0;z-index:2;padding:14px 18px;background:#101c2bf2;border-bottom:1px solid #30445b}h1{font-size:19px;margin:0 0 9px}select{font:inherit;color:inherit;background:#18283b;border:1px solid #49627d;border-radius:7px;padding:6px 9px}.content{padding:16px}.views{display:grid;grid-template-columns:repeat(3,minmax(340px,1fr));gap:12px}.panel{background:#0e1926;border:1px solid #2d4258;border-radius:10px;overflow:hidden}.panel h2{font-size:13px;margin:0;padding:9px 11px;background:#142337}.canvas{display:block;width:100%;height:620px}.module{fill:#16304a;stroke:#82a9d1;stroke-width:2}.root{stroke:#ffcb6b;stroke-width:3}.node{fill:#244867;stroke:#96bbdc;stroke-width:1}.label{fill:#eaf4ff;font-size:10px;text-anchor:middle;dominant-baseline:middle}.name{fill:#b8cbe0;font-size:11px;font-weight:700}.vector{stroke:#ff7b72;stroke-width:4;marker-end:url(#arrow)}.metrics{margin:12px 0 0;padding:12px;background:#101e2d;border:1px solid #2f465e;border-radius:8px;white-space:pre-wrap;font:12px/1.45 ui-monospace,Consolas,monospace}.good{color:#8ad9a0}.legend{color:#afc0d2;margin:8px 0 0}@media(max-width:1150px){.views{grid-template-columns:1fr}}
</style></head><body><div class="top"><h1>HIERSTAB1 · Before / cold / incremental</h1><label>Scenario <select id="scenario"></select></label><p class="legend">Red arrows show File-center movement from Before. The incremental view should contain few or no arrows; cold is the deterministic fallback oracle.</p></div><main class="content"><div id="views" class="views"></div><pre id="metrics" class="metrics"></pre></main><script>
const DATA=${serialized};const q=id=>document.getElementById(id);const select=q('scenario');select.innerHTML=Object.entries(DATA).map(([id,v])=>'<option value="'+id+'">'+v.label+'</option>').join('');
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const center=r=>({x:r.x+r.width/2,y:r.y+r.height/2});
function panel(title,candidate,before){const all=candidate.modules;const l=Math.min(...all.map(r=>r.x))-140,t=Math.min(...all.map(r=>r.y))-140,r=Math.max(...all.map(r=>r.x+r.width))+140,b=Math.max(...all.map(r=>r.y+r.height))+140;const prior=new Map(before.modules.map(m=>[m.moduleId,m]));const vectors=candidate.modules.map(m=>{const p=prior.get(m.moduleId);if(!p)return'';const a=center(p),z=center(m);return Math.hypot(z.x-a.x,z.y-a.y)<.001?'':'<path class="vector" d="M '+a.x+' '+a.y+' L '+z.x+' '+z.y+'"/>'}).join('');const modules=candidate.modules.map(m=>'<g><rect class="module '+(m.moduleId==='Focus'?'root':'')+'" x="'+m.x+'" y="'+m.y+'" width="'+m.width+'" height="'+m.height+'" rx="14"/><text class="name" x="'+(m.x+9)+'" y="'+(m.y+16)+'">'+esc(m.moduleId)+'</text></g>').join('');const nodes=candidate.nodes.map(n=>'<g><rect class="node" x="'+n.x+'" y="'+n.y+'" width="'+n.width+'" height="'+n.height+'" rx="7"/><text class="label" x="'+(n.x+n.width/2)+'" y="'+(n.y+n.height/2)+'">'+esc(n.projectionNodeId)+'</text></g>').join('');return '<section class="panel"><h2>'+title+'</h2><svg class="canvas" viewBox="'+l+' '+t+' '+(r-l)+' '+(b-t)+'"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8z" fill="#ff7b72"/></marker></defs>'+modules+nodes+vectors+'</svg></section>'}
function render(){const d=DATA[select.value];q('views').innerHTML=panel('Before',d.before,d.before)+panel('After · cold solve',d.cold,d.before)+panel('After · incremental',d.incremental,d.before);q('metrics').textContent=JSON.stringify(d.evidence,null,2)}select.addEventListener('change',render);render();</script></body></html>`;
  await mkdir(directory, { recursive: true });
  const path = resolve(directory, 'index.html');
  await writeFile(path, html, 'utf8');
  await writeFile(
    resolve(directory, 'README.txt'),
    'Development-only HIERSTAB1 comparator. Inspect Before, deterministic cold After, and transition-prior incremental After. Red vectors are File-center movement from Before.\n',
    'utf8',
  );
  return path;
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const outIndex = process.argv.indexOf('--out');
  const path = await writeIncrementalLayoutLab(
    outIndex < 0 ? undefined : process.argv[outIndex + 1],
  );
  process.stdout.write(`Generated ${path}\n`);
}
