import './style.css';
import './onboarding.css';
import { HenleyUI } from './henley-ui.js';
import { HenleyGame } from './henley-game.js';
import { PerformanceGovernor } from './performance.js';

const ui=new HenleyUI();
const game=new HenleyGame(document.querySelector('#scene'),ui);
const performanceGovernor=new PerformanceGovernor(game.view);

window.__HENLEY_PERFORMANCE__={
  status:()=>performanceGovernor.status(),
  forceTier:tier=>performanceGovernor.forceTier(tier),
};

export {game,ui,performanceGovernor};
