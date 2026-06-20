const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  health: document.getElementById("healthValue"),
  ammo: document.getElementById("ammoValue"),
  ap: document.getElementById("apValue"),
  turn: document.getElementById("turnValue"),
  endTurn: document.getElementById("endTurnButton"),
};

const grid = {
  width: 18,
  height: 14,
  tileWidth: 64,
  tileHeight: 32,
  originX: canvas.width / 2,
  originY: 72,
};

const state = {
  turn: "player",
  round: 1,
  selected: null,
  hoverCell: null,
  message: "",
  messageTimer: 0,
  gameOver: false,
  player: {
    x: 3,
    y: 8,
    health: 100,
    ap: 2,
    ammo: 24,
    maxAp: 2,
  },
  zombies: [],
  terrain: [],
  effects: [],
};

const terrainPlan = [
  "..................",
  "..BBBB...RR...BBB.",
  "..B..B...RR...B.B.",
  "........RR........",
  "RRRRRRRRRRRRRRRRRR",
  "...C....RR....C...",
  ".BBB....RR..BBB...",
  ".B.B....RR..B.B...",
  ".........C........",
  "RRRRRRRRRRRRRRRRRR",
  "...BBB..RR....BB..",
  "...B.B..RR....B...",
  "........RR........",
  "..................",
];

function resetGame() {
  state.turn = "player";
  state.round = 1;
  state.selected = "player";
  state.hoverCell = null;
  state.message = "";
  state.messageTimer = 0;
  state.gameOver = false;
  state.player.x = 3;
  state.player.y = 8;
  state.player.health = 100;
  state.player.ap = 2;
  state.player.ammo = 24;
  state.zombies = [
    { id: 1, x: 13, y: 3, health: 55, maxMove: 4 },
    { id: 2, x: 15, y: 8, health: 55, maxMove: 4 },
    { id: 3, x: 10, y: 11, health: 55, maxMove: 4 },
    { id: 4, x: 6, y: 2, health: 55, maxMove: 4 },
  ];
  state.effects = [];
  state.terrain = createTerrain();
  showMessage("Player turn: move, shoot, then end turn");
  updateUi();
}

function createTerrain() {
  const terrain = [];

  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const marker = terrainPlan[y][x];
      if (marker === "B") {
        terrain.push({
          x,
          y,
          type: "building",
          blocks: true,
          cover: "full",
          hp: 999,
        });
      }
      if (marker === "C") {
        terrain.push({
          x,
          y,
          type: "car",
          blocks: true,
          cover: "half",
          hp: 70,
        });
      }
    }
  }

  [
    [5, 5],
    [7, 6],
    [12, 7],
    [4, 10],
    [13, 10],
    [8, 2],
    [2, 12],
  ].forEach(([x, y]) => {
    terrain.push({ x, y, type: "rubble", blocks: false, cover: "half", hp: 45 });
  });

  return terrain;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMap();
  drawHighlights();
  drawTerrain();
  drawActors();
  drawEffects();
  drawMessage();
}

function drawMap() {
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const screen = cellToScreen(x, y);
      const isRoad = terrainPlan[y][x] === "R";
      drawDiamond(screen.x, screen.y, isRoad ? "#2a2d2a" : "#3b3a34", "#1e211f");

      if (isRoad && (x + y) % 3 === 0) {
        ctx.fillStyle = "rgba(232, 216, 156, 0.2)";
        ctx.fillRect(screen.x - 2, screen.y - 2, 4, 4);
      }
    }
  }
}

function drawHighlights() {
  const reachable = getReachableCells();
  reachable.forEach((cell) => {
    const screen = cellToScreen(cell.x, cell.y);
    drawDiamond(screen.x, screen.y, "rgba(217, 164, 65, 0.2)", "rgba(217, 164, 65, 0.65)");
  });

  state.zombies.forEach((zombie) => {
    if (!hasLineOfSight(state.player, zombie)) return;
    const chance = getHitChance(zombie);
    if (chance <= 0) return;
    const screen = cellToScreen(zombie.x, zombie.y);
    drawDiamond(screen.x, screen.y, "rgba(209, 81, 63, 0.22)", "rgba(209, 81, 63, 0.75)");
  });

  if (state.hoverCell) {
    const screen = cellToScreen(state.hoverCell.x, state.hoverCell.y);
    drawDiamond(screen.x, screen.y, "rgba(255, 255, 255, 0.12)", "rgba(255, 255, 255, 0.65)");
  }
}

function drawTerrain() {
  const terrain = [...state.terrain].sort((a, b) => a.x + a.y - (b.x + b.y));
  terrain.forEach((item) => {
    const screen = cellToScreen(item.x, item.y);

    if (item.type === "building") {
      drawBlock(screen.x, screen.y, 46, "#4a4741", "#2d2c29");
      ctx.fillStyle = "#171716";
      ctx.fillRect(screen.x - 18, screen.y - 54, 20, 18);
      ctx.fillRect(screen.x + 4, screen.y - 34, 18, 12);
      ctx.strokeStyle = "#787064";
      ctx.lineWidth = 2;
      line(screen.x - 24, screen.y - 45, screen.x + 18, screen.y - 18);
    }

    if (item.type === "car") {
      drawBlock(screen.x, screen.y, 18, "#6b3d35", "#33201d");
      ctx.fillStyle = "#222";
      ctx.fillRect(screen.x - 17, screen.y - 24, 12, 8);
      ctx.fillRect(screen.x + 6, screen.y - 18, 12, 8);
    }

    if (item.type === "rubble") {
      ctx.fillStyle = "#5b5750";
      ctx.beginPath();
      ctx.moveTo(screen.x - 20, screen.y + 2);
      ctx.lineTo(screen.x - 2, screen.y - 12);
      ctx.lineTo(screen.x + 23, screen.y + 1);
      ctx.lineTo(screen.x + 7, screen.y + 13);
      ctx.closePath();
      ctx.fill();
    }
  });
}

function drawActors() {
  const actors = [state.player, ...state.zombies].sort((a, b) => a.x + a.y - (b.x + b.y));
  actors.forEach((actor) => {
    const screen = cellToScreen(actor.x, actor.y);
    const isPlayer = actor === state.player;

    ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
    ctx.beginPath();
    ctx.ellipse(screen.x, screen.y + 9, 17, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isPlayer ? "#d7c28a" : "#597146";
    circle(screen.x, screen.y - 14, 15);
    ctx.fillStyle = isPlayer ? "#232018" : "#2d3b25";
    circle(screen.x - 5, screen.y - 19, 3);
    circle(screen.x + 5, screen.y - 19, 3);

    drawHealthBar(screen.x, screen.y - 42, isPlayer ? state.player.health : actor.health, isPlayer ? 100 : 55);

    if (!isPlayer && hasLineOfSight(state.player, actor)) {
      const chance = getHitChance(actor);
      ctx.fillStyle = "#f3efe0";
      ctx.font = "700 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${chance}%`, screen.x, screen.y - 52);
    }
  });
}

function drawEffects() {
  state.effects.forEach((effect) => {
    if (effect.type === "shot") {
      ctx.strokeStyle = effect.hit ? "#f6dd8a" : "rgba(246, 221, 138, 0.45)";
      ctx.lineWidth = effect.hit ? 3 : 2;
      line(effect.from.x, effect.from.y, effect.to.x, effect.to.y);
    }
    if (effect.type === "text") {
      ctx.fillStyle = effect.color;
      ctx.font = "700 18px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(effect.text, effect.x, effect.y - (1 - effect.life) * 18);
    }
  });
}

function drawMessage() {
  if (!state.message || state.messageTimer <= 0) return;

  ctx.fillStyle = "rgba(12, 15, 11, 0.78)";
  ctx.fillRect(canvas.width / 2 - 250, 18, 500, 38);
  ctx.fillStyle = "#f3efe0";
  ctx.font = "16px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(state.message, canvas.width / 2, 37);
}

function drawDiamond(x, y, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x, y - grid.tileHeight / 2);
  ctx.lineTo(x + grid.tileWidth / 2, y);
  ctx.lineTo(x, y + grid.tileHeight / 2);
  ctx.lineTo(x - grid.tileWidth / 2, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawBlock(x, y, height, top, side) {
  drawDiamond(x, y - height, top, "#1e211f");

  ctx.fillStyle = side;
  ctx.beginPath();
  ctx.moveTo(x - grid.tileWidth / 2, y - height);
  ctx.lineTo(x, y - height + grid.tileHeight / 2);
  ctx.lineTo(x, y + grid.tileHeight / 2);
  ctx.lineTo(x - grid.tileWidth / 2, y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = shade(side, 18);
  ctx.beginPath();
  ctx.moveTo(x + grid.tileWidth / 2, y - height);
  ctx.lineTo(x, y - height + grid.tileHeight / 2);
  ctx.lineTo(x, y + grid.tileHeight / 2);
  ctx.lineTo(x + grid.tileWidth / 2, y);
  ctx.closePath();
  ctx.fill();
}

function drawHealthBar(x, y, value, max) {
  ctx.fillStyle = "#151514";
  ctx.fillRect(x - 18, y, 36, 5);
  ctx.fillStyle = value > max * 0.45 ? "#67a358" : "#d1513f";
  ctx.fillRect(x - 18, y, 36 * Math.max(0, value / max), 5);
}

function getReachableCells() {
  if (state.turn !== "player" || state.gameOver) return [];
  const maxDistance = state.player.ap >= 2 ? 5 : state.player.ap === 1 ? 3 : 0;
  if (maxDistance === 0) return [];

  const cells = [];
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const distance = manhattan(state.player, { x, y });
      if (distance <= maxDistance && distance > 0 && !isBlocked(x, y)) {
        cells.push({ x, y, cost: distance <= 3 ? 1 : 2 });
      }
    }
  }
  return cells;
}

function movePlayer(cell) {
  if (state.turn !== "player" || state.gameOver) return;
  const target = getReachableCells().find((item) => item.x === cell.x && item.y === cell.y);
  if (!target || state.player.ap < target.cost) {
    showMessage("That tile is out of range");
    return;
  }

  state.player.x = cell.x;
  state.player.y = cell.y;
  state.player.ap -= target.cost;
  showMessage(`Moved: ${target.cost} AP`);
  updateUi();
}

function shootZombie(zombie) {
  if (state.turn !== "player" || state.gameOver) return;
  if (state.player.ap < 1) {
    showMessage("No AP left");
    return;
  }
  if (state.player.ammo < 1) {
    showMessage("Out of ammo");
    return;
  }
  if (!hasLineOfSight(state.player, zombie)) {
    showMessage("No line of sight");
    return;
  }

  const chance = getHitChance(zombie);
  const hit = Math.random() * 100 < chance;
  const from = cellToScreen(state.player.x, state.player.y);
  const to = cellToScreen(zombie.x, zombie.y);

  state.player.ap -= 1;
  state.player.ammo -= 1;
  state.effects.push({ type: "shot", from: { x: from.x, y: from.y - 20 }, to: { x: to.x, y: to.y - 18 }, hit, life: 0.28 });

  if (hit) {
    const damage = 34;
    zombie.health -= damage;
    floatingText(`-${damage}`, to.x, to.y - 45, "#f6dd8a");
    showMessage(`Hit: ${chance}%`);
  } else {
    floatingText("MISS", to.x, to.y - 45, "#d1513f");
    showMessage(`Missed: ${chance}%`);
  }

  state.zombies = state.zombies.filter((item) => item.health > 0);
  if (state.zombies.length === 0) {
    state.gameOver = true;
    showMessage("Area cleared. Press R to restart.");
  }
  updateUi();
}

function getHitChance(zombie) {
  const distance = manhattan(state.player, zombie);
  const coverPenalty = getCoverAgainst(zombie, state.player);
  return clamp(Math.round(88 - distance * 5 - coverPenalty), 15, 95);
}

function getCoverAgainst(target, attacker) {
  const neighbors = [
    { x: target.x + 1, y: target.y },
    { x: target.x - 1, y: target.y },
    { x: target.x, y: target.y + 1 },
    { x: target.x, y: target.y - 1 },
  ];
  const cover = neighbors
    .map((cell) => state.terrain.find((item) => item.x === cell.x && item.y === cell.y && item.cover))
    .filter(Boolean)
    .filter((item) => manhattan(item, attacker) < manhattan(target, attacker));

  if (cover.some((item) => item.cover === "full")) return 35;
  if (cover.some((item) => item.cover === "half")) return 20;
  return 0;
}

function hasLineOfSight(from, to) {
  const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  for (let index = 1; index < steps; index += 1) {
    const x = Math.round(from.x + ((to.x - from.x) * index) / steps);
    const y = Math.round(from.y + ((to.y - from.y) * index) / steps);
    const blocker = state.terrain.find((item) => item.x === x && item.y === y && item.blocks && item.type === "building");
    if (blocker) return false;
  }
  return true;
}

function endPlayerTurn() {
  if (state.turn !== "player" || state.gameOver) return;
  state.turn = "zombie";
  showMessage("Zombie turn");
  updateUi();
  setTimeout(runZombieTurn, 350);
}

function runZombieTurn() {
  if (state.gameOver) return;

  state.zombies.forEach((zombie) => {
    for (let step = 0; step < zombie.maxMove; step += 1) {
      if (manhattan(zombie, state.player) <= 1) break;
      const next = getZombieStep(zombie);
      if (!next) break;
      zombie.x = next.x;
      zombie.y = next.y;
    }

    if (manhattan(zombie, state.player) <= 1) {
      state.player.health -= 16;
      const screen = cellToScreen(state.player.x, state.player.y);
      floatingText("-16", screen.x, screen.y - 45, "#d1513f");
    }
  });

  if (state.player.health <= 0) {
    state.player.health = 0;
    state.gameOver = true;
    showMessage("Squad wiped. Press R to restart.");
  } else {
    state.turn = "player";
    state.round += 1;
    state.player.ap = state.player.maxAp;
    showMessage(`Round ${state.round}: player turn`);
  }

  updateUi();
}

function getZombieStep(zombie) {
  const options = [
    { x: zombie.x + 1, y: zombie.y },
    { x: zombie.x - 1, y: zombie.y },
    { x: zombie.x, y: zombie.y + 1 },
    { x: zombie.x, y: zombie.y - 1 },
  ].filter((cell) => isInside(cell.x, cell.y) && !isBlocked(cell.x, cell.y, zombie));

  options.sort((a, b) => manhattan(a, state.player) - manhattan(b, state.player));
  return options[0] || null;
}

function handleClick(event) {
  if (state.turn !== "player" || state.gameOver) return;

  const cell = screenToCell(event.clientX, event.clientY);
  if (!cell || !isInside(cell.x, cell.y)) return;

  const zombie = state.zombies.find((item) => item.x === cell.x && item.y === cell.y);
  if (zombie) {
    shootZombie(zombie);
    return;
  }

  movePlayer(cell);
}

function updateEffects(delta) {
  state.effects.forEach((effect) => {
    effect.life -= delta;
  });
  state.effects = state.effects.filter((effect) => effect.life > 0);
}

function updateUi() {
  ui.health.textContent = state.player.health;
  ui.ammo.textContent = state.player.ammo;
  ui.ap.textContent = state.player.ap;
  ui.turn.textContent = state.gameOver ? "Done" : state.turn === "player" ? "Player" : "Zombies";
  ui.endTurn.disabled = state.turn !== "player" || state.gameOver;
}

function showMessage(text) {
  state.message = text;
  state.messageTimer = 2.8;
}

function floatingText(text, x, y, color) {
  state.effects.push({ type: "text", text, x, y, color, life: 0.75 });
}

function isBlocked(x, y, movingZombie = null) {
  if (!isInside(x, y)) return true;
  if (state.terrain.some((item) => item.x === x && item.y === y && item.blocks)) return true;
  if (state.player.x === x && state.player.y === y) return true;
  return state.zombies.some((zombie) => zombie !== movingZombie && zombie.x === x && zombie.y === y);
}

function isInside(x, y) {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

function cellToScreen(x, y) {
  return {
    x: grid.originX + (x - y) * (grid.tileWidth / 2),
    y: grid.originY + (x + y) * (grid.tileHeight / 2),
  };
}

function screenToCell(clientX, clientY) {
  const bounds = canvas.getBoundingClientRect();
  const screenX = ((clientX - bounds.left) / bounds.width) * canvas.width;
  const screenY = ((clientY - bounds.top) / bounds.height) * canvas.height;
  const x = (screenX - grid.originX) / (grid.tileWidth / 2);
  const y = (screenY - grid.originY) / (grid.tileHeight / 2);

  return {
    x: Math.round((x + y) / 2),
    y: Math.round((y - x) / 2),
  };
}

function manhattan(first, second) {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function shade(hex, amount) {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = clamp((value >> 16) + amount, 0, 255);
  const g = clamp(((value >> 8) & 255) + amount, 0, 255);
  const b = clamp((value & 255) + amount, 0, 255);
  return `rgb(${r}, ${g}, ${b})`;
}

function circle(x, y, radius) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function line(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function loop(now) {
  const delta = Math.min(0.05, (now - loop.lastTime) / 1000);
  loop.lastTime = now;
  state.messageTimer = Math.max(0, state.messageTimer - delta);
  updateEffects(delta);
  draw();
  requestAnimationFrame(loop);
}

loop.lastTime = performance.now();

canvas.addEventListener("click", handleClick);

canvas.addEventListener("mousemove", (event) => {
  const cell = screenToCell(event.clientX, event.clientY);
  state.hoverCell = cell && isInside(cell.x, cell.y) ? cell : null;
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === " " || key === "enter") endPlayerTurn();
  if (key === "r") resetGame();
});

ui.endTurn.addEventListener("click", endPlayerTurn);

resetGame();
requestAnimationFrame(loop);
