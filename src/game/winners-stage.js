import { sides } from './arena.js';

const ordinal = rank => rank+(['st','nd','rd'][rank-1] || 'th');

export function winnersStage(team, roster) {
  const columns=Math.min(5,roster.length);
  const layout=roster.length>5 ? 'wide' : roster.length>3 ? 'medium' : 'close';
  return `<section class="winners-stage ${layout} ${team?'b':'a'}" aria-label="${sides[team]} ranked by damage">
    <div class="stage-lights" aria-hidden="true"></div>
    <ol class="stage-lineup" style="--columns:${columns}">${roster.map((actor,index)=>`
      <li class="stage-place" data-rank="${index+1}">
        <div class="stage-figure" aria-hidden="true">
          <span class="stage-head"></span><span class="stage-body"></span><span class="stage-boots"></span>
        </div>
        <div class="stage-plinth">
          <strong class="stage-rank">${ordinal(index+1)}</strong>
          <strong class="stage-name">${actor.name}</strong>
          <span class="stage-damage">${actor.damage.toLocaleString()} DMG</span>
        </div>
      </li>`).join('')}</ol>
  </section>`;
}
