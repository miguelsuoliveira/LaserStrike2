#!/usr/bin/env node
// Claude Code status line: model, money spent this session, reminder to save.
let raw = '';
for await (const chunk of process.stdin) raw += chunk;
let d = {};
try {
  d = JSON.parse(raw);
} catch {
  // show the defaults
}
const model = d.model?.display_name || 'Claude';
const cost = d.cost?.total_cost_usd;
const mins = d.cost?.total_duration_ms ? Math.round(d.cost.total_duration_ms / 60000) : null;
const parts = [model];
if (cost !== undefined) parts.push(`$${cost.toFixed(2)} spent`);
if (mins !== null) parts.push(`${mins} min`);
parts.push('save often: npm run save -- "what works"');
console.log(parts.join(' · '));
