import { Game } from './game/Game';

const game = new Game();
game.init().catch(console.error);
