// Shared game-loop state (paused or not).
export const state = { paused: false };

export function setPaused(paused) {
  state.paused = paused;
}
