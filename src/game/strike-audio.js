const notes = [57,null,60,64,null,67,64,null,55,null,59,62,null,64,62,null,
  53,null,57,60,null,65,60,57,55,null,59,62,null,67,62,null];
const roots = [33,31,29,31];
const beat = .23;
const frequency = note => 440 * 2 ** ((note-69)/12);
const cues = {
  shot: [[470,.09,'triangle',.28,155]],
  hit: [[780,.075,'sine',.31,570]],
  hurt: [[160,.17,'triangle',.28,73]],
  reload: [[220,.07,'square',.12,120],[480,.07,'triangle',.2,710]],
  eliminate: [[430,.075,'triangle',.26],[670,.11,'triangle',.24]],
  plant: [[290,.1,'sine',.28],[580,.19,'triangle',.29]],
  defuse: [[590,.11,'sine',.3],[410,.18,'triangle',.27]],
  bell: [[735,.73,'sine',.27,735,0],[1475,.42,'sine',.17,1475,0],[2138,.22,'sine',.09,2138,0]],
  round: [[370,.12,'triangle',.22],[495,.19,'triangle',.28]],
  buy: [[560,.075,'sine',.25],[750,.1,'sine',.24]],
};

export function createStrikeAudio() {
  let context, music, effects, relayBus, nextPing=0, nextBeat, noteIndex=0, lastBotShot=-Infinity;
  let musicOn=true, effectsOn=true, planted=false;

  function tone(destination, start, pitch, length, type, level, endPitch=pitch) {
    const oscillator=context.createOscillator(), gain=context.createGain();
    oscillator.type=type;
    oscillator.frequency.setValueAtTime(pitch,start);
    oscillator.frequency.exponentialRampToValueAtTime(endPitch,start+length);
    gain.gain.setValueAtTime(.0001,start);
    gain.gain.exponentialRampToValueAtTime(level,start+.009);
    gain.gain.exponentialRampToValueAtTime(.0001,start+length);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(start);
    oscillator.stop(start+length);
  }

  function configure() {
    if (!context) return;
    music.gain.setTargetAtTime(musicOn ? (planted ? .16 : .36) : 0,context.currentTime,.04);
    relayBus.gain.setTargetAtTime(effectsOn ? .85 : 0,context.currentTime,.025);
    effects.gain.setTargetAtTime(effectsOn ? (planted ? .34 : .65) : 0,context.currentTime,.025);
  }

  return {
    unlock() {
      const Audio=window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      if (!context) {
        context=new Audio();
        music=context.createGain();
        effects=context.createGain();
        relayBus=context.createGain();
        relayBus.gain.value=0;
        relayBus.connect(context.destination);
        music.gain.value=0;
        effects.gain.value=0;
        music.connect(context.destination);
        effects.connect(context.destination);
        configure();
      }
      if (context.state==='suspended') context.resume().catch(()=>{});
    },
    setMusic(value) {musicOn=value;configure();},
    setEffects(value) {effectsOn=value;configure();},
    update(relayTime=null,paused=false) {
      const armed=relayTime!==null && relayTime>0;
      if (planted!==armed) {
        planted=armed;
        nextPing=0;
        configure();
      }
      if (context?.state!=='running') return;
      const now=context.currentTime;
      if (planted && effectsOn && !paused && now>=nextPing) {
        tone(relayBus,now+.006,960,.11,'sine',.24,820);
        nextPing=now+(relayTime<5 ? .28 : relayTime<12 ? .53 : 1);
      }
      if (!musicOn) return;
      if (!nextBeat || nextBeat<now) nextBeat=now+.025;
      while (nextBeat<now+.12) {
        const note=notes[noteIndex];
        if (note!==null) tone(music,nextBeat,frequency(note),.28,'triangle',.27);
        if (noteIndex%4===0) tone(music,nextBeat,frequency(roots[Math.floor(noteIndex/8)]),.52,'sine',.36);
        if (noteIndex%2===0) tone(music,nextBeat,92,.12,'sine',.23,39);
        if (noteIndex%2===1) tone(music,nextBeat,1470,.045,'triangle',.028,790);
        noteIndex=(noteIndex+1)%notes.length;
        nextBeat+=beat;
      }
    },
    play(name,{volume=1,bot=false}={}) {
      if (context?.state!=='running' || !effectsOn || volume<=0 || !cues[name]) return;
      let start=context.currentTime+.006;
      if (bot) {
        if (start-lastBotShot<.09) return;
        lastBotShot=start;
      }
      for (const [pitch,length,type,level,end,spacing=length*.85] of cues[name]) {
        tone(effects,start,pitch,length,type,level*volume,end);
        start+=spacing;
      }
    },
  };
}
