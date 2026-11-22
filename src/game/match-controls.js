import { roundOptions } from './match.js';

export function roundStepper(rounds) {
  return `<div class="settings-row"><span>Rounds</span><div class="stepper">
    <button data-action="round-minus" aria-label="Fewer rounds" ${rounds===roundOptions[0]?'disabled':''}>−</button>
    <strong aria-live="polite">${rounds}</strong>
    <button data-action="round-plus" aria-label="More rounds" ${rounds===roundOptions.at(-1)?'disabled':''}>+</button>
  </div></div>`;
}

export function mountAudioToggles(audio) {
  const panel=document.createElement('div');
  panel.className='match-audio';
  panel.hidden=true;
  panel.setAttribute('aria-label','Match audio');
  document.body.append(panel);
  const channels={
    music:{label:'Music',enabled:true,set:audio.setMusic},
    effects:{label:'Sound effects',enabled:true,set:audio.setEffects},
  };
  for (const [name, channel] of Object.entries(channels)) {
    const toggle=document.createElement('button');
    const update=()=>{
      toggle.textContent=channel.label+(channel.enabled?' on':' off');
      toggle.setAttribute('aria-pressed',String(channel.enabled));
    };
    toggle.addEventListener('click',()=>{
      audio.unlock();
      set(name,!channel.enabled);
    });
    channel.update=update;
    panel.append(toggle);
    update();
  }
  function set(name,enabled) {
    const channel=channels[name];
    channel.enabled=enabled;
    channel.set(enabled);
    channel.update();
  }
  return {show:visible=>{panel.hidden=!visible;},set,enabled:name=>channels[name].enabled};
}
