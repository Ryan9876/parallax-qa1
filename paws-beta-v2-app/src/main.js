import './style.css';
import { ProfileStore } from './profile.js';
import { GameUI } from './ui.js';
import { PawsGame } from './game.js';

const profile=new ProfileStore();
const ui=new GameUI(profile);
new PawsGame(document.querySelector('#scene'),ui,profile);
