import { escapeHtml } from './util.js';
import { getSave, ownsSkin, UPGRADE_DEFS } from './save.js';
import { SKINS, getSkin } from './skins.js';
import { MAP_LIST } from './maps.js';
import { PARTY_ARENAS } from './party.js';
import { FLOORS } from './editor.js';
import { sfx } from './audio.js';
import { wantsTouch } from './touch.js';

function onTouch() {
  return wantsTouch();
}

function toastFace(skin) {
  const legendary = skin.power ? ' legendary' : '';
  return `<div class="toast-preview${legendary}" style="background:${skin.crust};color:${skin.crust}"><span style="background:${skin.crumb}"></span></div>`;
}

function powerLine(skin) {
  if (!skin.power) return skin.blurb;
  const how = onTouch() ? skin.power.touch : skin.power.keys;
  return `SPECIAL POWER<br>${skin.cost} COINS<br>${how}<br>${skin.power.detail}`;
}

export function createUI(root, api) {
  let hud = null;

  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-act]');
    if (!button || button.disabled) return;
    button.blur();
    sfx.click();
    api.perform(button.dataset.act, button.dataset.id || '');
  });

  root.addEventListener('input', (event) => {
    if (event.target.id === 'username') api.onUsernameInput(event.target.value);
  });

  root.addEventListener('focusout', (event) => {
    if (event.target.id === 'username') api.onUsernameBlur(event.target.value);
  });

  function show(screen, data = {}) {
    hud = null;
    root.innerHTML = templates[screen] ? templates[screen](data) : '';
    hud = grabHud();
  }

  function grabHud() {
    const name = root.querySelector('#hud-name');
    if (!name && !root.querySelector('#editor-counts') && !root.querySelector('#scorebug') && !root.querySelector('#party-hp')) return null;
    return {
      name,
      level: root.querySelector('#hud-level'),
      time: root.querySelector('#hud-time'),
      score: root.querySelector('#hud-score'),
      hp: root.querySelector('#hud-hp'),
      fill: root.querySelector('#hud-fill'),
      coins: root.querySelector('#hud-coins'),
      powers: root.querySelector('#hud-powers'),
      banner: root.querySelector('#hud-banner'),
      howTo: root.querySelector('#how-to'),
      hint: root.querySelector('#hud-hint'),
      boss: root.querySelector('#hud-boss'),
      bossFill: root.querySelector('#hud-boss-fill'),
      bossText: root.querySelector('#hud-boss-text'),
      cross: root.querySelector('#crosshair'),
      mode: root.querySelector('#mode-tag'),
      vignette: root.querySelector('#vignette'),
      counts: root.querySelector('#editor-counts'),
      scorebug: root.querySelector('#scorebug'),
      partyHp: root.querySelector('#party-hp'),
      partyLeft: root.querySelector('#party-left'),
      partyPower: root.querySelector('#party-power'),
      soccerPower: root.querySelector('#soccer-power'),
    };
  }

  function updateHUD(data) {
    if (!hud || !data) return;
    if (data.kind === 'main' && hud.name) {
      hud.name.textContent = data.username;
      hud.level.textContent = `Level ${data.level}`;
      hud.time.textContent = data.time;
      hud.score.textContent = `Score ${data.score}`;
      hud.hp.textContent = `${data.hp} / ${data.maxHp}`;
      hud.fill.style.width = `${Math.max(0, Math.min(100, (data.hp / data.maxHp) * 100))}%`;
      const label = data.mapName || 'CUSTOM WORLD';
      hud.coins.textContent = `${label} · Coins ${data.coins} · Left ${data.left}`;
      hud.powers.textContent = data.powers || '';
      hud.banner.textContent = data.banner || '';
      hud.banner.classList.toggle('hidden', !data.banner);
      if (hud.howTo) hud.howTo.classList.toggle('hidden', !data.howTo);
      hud.boss.classList.toggle('hidden', !data.boss);
      if (data.boss) {
        hud.bossFill.style.width = `${Math.max(0, (data.bossHp / data.bossMax) * 100)}%`;
        hud.bossText.textContent = `BOSS TOASTER  ${Math.ceil(data.bossHp)} / ${data.bossMax}`;
      }
      hud.cross.classList.toggle('hidden', !data.fps);
      hud.mode.textContent = data.fps ? 'FIRST PERSON' : 'THIRD PERSON';
      const equipped = getSkin(getSave().selectedSkin);
      const block = data.power && equipped.power
        ? ` · ${onTouch() ? equipped.power.hintTouch : equipped.power.hintKeys}`
        : '';
      hud.hint.textContent = onTouch()
        ? (data.fps
          ? `Drag the right side to look · stick to move · BONK attacks · CAM for third person${block}`
          : `Stick to move · BONK to attack · CAM switches camera${block}`)
        : (data.fps
          ? `Click to capture mouse · look around · WASD move · SPACE third person${block}`
          : `WASD / arrows · F bonk · SPACE camera${block}`);
      hud.vignette.classList.toggle('show', data.hp < data.maxHp * 0.35);
    } else if (data.kind === 'soccer' && hud.scorebug) {
      hud.scorebug.textContent = `YOU ${data.you} — ${data.them} ENEMIES`;
      if (hud.banner) {
        hud.banner.textContent = data.banner || '';
        hud.banner.classList.toggle('hidden', !data.banner);
      }
      if (hud.soccerPower) hud.soccerPower.textContent = data.powers || '';
    } else if (data.kind === 'party' && hud.partyHp) {
      hud.partyHp.textContent = `HP: ${data.hp} / ${data.maxHp}`;
      hud.partyLeft.textContent = `AI TOASTS LEFT: ${data.alive}`;
      if (hud.partyPower) hud.partyPower.textContent = data.powers || '';
      if (hud.banner) {
        hud.banner.textContent = data.banner || '';
        hud.banner.classList.toggle('hidden', !data.banner);
      }
    } else if (data.kind === 'editor' && hud.counts) {
      hud.counts.textContent = `Floor ready · Coins ${data.coins} · Enemies ${data.enemies}`;
    }
  }

  return { show, updateHUD };
}

function shell(title, lede, body, extra = '') {
  return `<div class="screen"><section class="sheet interactive">${extra}<div class="back-row"><h2>${title}</h2><button class="game-btn alt" data-act="menu" type="button">MAIN MENU</button></div><p class="lede">${lede}</p>${body}</section></div>`;
}

const templates = {
  menu() {
    const save = getSave();
    return `
      <div class="menu-layout">
        <aside class="menu-panel interactive">
          <h1 class="logo">TOAST TIME</h1>
          <p class="subtitle">3D TOAST MAYHEM</p>
          <p class="playing">Playing as: <b>${escapeHtml(save.username)}</b></p>
          <div class="stats">
            <div><span>Coins</span><strong>${save.coins}</strong></div>
            <div><span>Best</span><strong>${save.bestScore}</strong></div>
            <div><span>Level</span><strong>${save.playerLevel}</strong></div>
          </div>
          <div class="menu-buttons">
            <button class="game-btn" type="button" data-act="play">▶ PLAY</button>
            <button class="game-btn alt" type="button" data-act="maps">🗺️ MAPS</button>
            <button class="game-btn alt" type="button" data-act="changeroom">👕 CHANGEROOM</button>
            <button class="game-btn alt" type="button" data-act="shop">🛒 UPGRADES SHOP</button>
            <button class="game-btn alt" type="button" data-act="minigames">⚽ MINIGAMES</button>
            <button class="game-btn alt" type="button" data-act="editor">🛠️ EDIT WORLD</button>
            <button class="game-btn alt" type="button" data-act="saved-worlds">🌍 SAVED WORLDS</button>
            <button class="game-btn party" type="button" data-act="party">🎉 PARTY</button>
            <button class="game-btn alt" type="button" data-act="settings">⚙️ SETTINGS</button>
          </div>
        </aside>
      </div>`;
  },
  maps() {
    const save = getSave();
    const cards = MAP_LIST.map((map) => `
      <article class="card ${save.selectedMap === map.id ? 'selected' : ''}">
        <div class="swatches">${map.swatch.map((color) => `<i style="background:${color}"></i>`).join('')}</div>
        <h3>${map.name}</h3>
        <p>${map.desc}</p>
        <button class="game-btn wide" type="button" data-act="select-map" data-id="${map.id}">${save.selectedMap === map.id ? 'SELECTED' : 'SELECT'}</button>
      </article>`).join('');
    return shell('MAPS', 'Pick a world. PLAY uses the selected map.', `<div class="grid">${cards}</div>`);
  },
  changeroom(data = {}) {
    const save = getSave();
    const note = data.message ? `<p class="lede">${escapeHtml(data.message)}</p>` : '';
    const cards = SKINS.map((skin) => {
      const locked = Boolean(skin.cost) && !ownsSkin(skin.id, save);
      const selected = save.selectedSkin === skin.id;
      let label = selected ? 'SELECTED' : 'SELECT';
      let act = 'select-skin';
      if (locked) {
        label = `UNLOCK · ${skin.cost} COINS`;
        act = 'buy-legendary';
      }
      return `
        <article class="card ${selected ? 'selected' : ''}">
          ${toastFace(skin)}
          <h3>${skin.name}</h3>
          <p>${powerLine(skin)}</p>
          <button class="game-btn wide" type="button" data-act="${act}" data-id="${skin.id}" ${selected && !locked ? 'disabled' : ''}>${label}</button>
        </article>`;
    }).join('');
    return shell('CHANGEROOM', 'Skins change your real 3D Toast.', `${note}<div class="grid">${cards}</div>`);
  },
  shop(data) {
    const save = getSave();
    const note = data.message ? `<p class="lede">${escapeHtml(data.message)}</p>` : '';
    const cards = UPGRADE_DEFS.map((def) => {
      const level = save.upgrades[def.id] || 0;
      const maxed = level >= def.max;
      const price = maxed ? 'MAX' : `${def.prices[level]} COINS`;
      return `
        <article class="card">
          <h3>${def.name}</h3>
          <p>${def.desc}</p>
          <p><b>Level ${level} / ${def.max}</b> · ${price}</p>
          <button class="game-btn wide" type="button" data-act="buy-upgrade" data-id="${def.id}" ${maxed ? 'disabled' : ''}>${maxed ? 'MAXED' : 'BUY'}</button>
        </article>`;
    }).join('');
    return shell('UPGRADES SHOP', `Coins: ${save.coins}. Upgrades stay with you.`, `${note}<div class="grid">${cards}</div>`);
  },
  minigames() {
    return shell('⚽ MINIGAMES', 'PICK A SIDE GAME AND GET TOASTING!', `
      <div class="grid">
        <article class="card">
          <h3>⚽🍞 TOAST SOCCER</h3>
          <p>Kick, score, grab power-ups and be the first team to 3 goals!</p>
          <button class="game-btn wide" type="button" data-act="soccer-card">▶ PLAY SOCCER</button>
        </article>
        <article class="card">
          <h3>🍞🔥 MORE GAMES COMING SOON</h3>
          <p>More silly Toast side games will land here later.</p>
          <button class="game-btn wide" type="button" disabled>LOCKED</button>
        </article>
      </div>`);
  },
  soccerTutorial() {
    return shell('TOAST SOCCER', 'HOW TO PLAY', `
      <div class="tutorial-list">
        <article><h3>1. MOVE</h3><p>${onTouch() ? 'Drag the stick on the left to run.' : 'Move with the ARROW KEYS.'}</p></article>
        <article><h3>2. KICK</h3><p>${onTouch() ? 'Get close to the ball and press KICK.' : 'Get close to the ball and press 1 to KICK.'}</p></article>
        <article><h3>3. AIM</h3><p>Your kick goes in the direction your Toast is facing.</p></article>
        <article><h3>4. FACE</h3><p>Face left, right, forward, backward, or diagonally to aim.</p></article>
        <article><h3>5. SCORE</h3><p>Score in the enemy goal.</p></article>
        <article><h3>6. WIN</h3><p>FIRST TEAM TO 3 GOALS WINS.</p></article>
        <article><h3>7. POWER-UPS</h3><p>Collect and use Soccer power-ups when they appear on the field.</p></article>
      </div>
      <button class="game-btn good wide sheet-go" type="button" data-act="soccer-start">▶ PLAY SOCCER</button>`);
  },
  tutorial() {
    return shell('HOW TO TOAST', 'A quick bite before the mayhem.', `
      <div class="tutorial-list">
        <article><h3>MOVE</h3><p>${onTouch() ? 'Drag the stick on the left to run around.' : 'Use WASD or the arrow keys to run around.'}</p></article>
        <article><h3>COLLECT COINS</h3><p>Collect every gold coin in the world.</p></article>
        <article><h3>AVOID ENEMY TOASTS</h3><p>Stay away from enemy Toasts and their attacks.</p></article>
        <article><h3>GRAB POWERS</h3><p>${onTouch() ? 'Use power-ups to survive and fight back. Press BONK up close. Orbit balls hit harder.' : 'Use power-ups to survive and fight back. Press F to bonk up close. Orbit balls hit harder.'}</p></article>
        <article><h3>BOSS TOASTER</h3><p>Collect all the coins to summon the Boss Toaster. Grab damage power-ups, like orbit orbs, to beat it.</p></article>
        <article><h3>CAMERA</h3><p>${onTouch() ? 'Press CAM to switch camera mode. In first person, drag the right side of the screen to look.' : 'Press SPACE to switch camera mode. In FPS, click and move the mouse.'}</p></article>
        <article><h3>LEGENDARY POWERS</h3><p>Buy them in the changeroom. ${onTouch() ? 'Legendary: hold BLOCK. Inferno: hold BURN. Frost: hold FROST. Phantom: tap DASH.' : 'Legendary: hold SHIFT to block. Inferno: hold SHIFT to burn. Frost: hold SHIFT to freeze. Phantom: tap SHIFT to dash.'}</p></article>
      </div>
      <button class="game-btn good wide sheet-go" type="button" data-act="got-it">LET'S TOAST!</button>`);
  },
  settings(data) {
    const save = getSave();
    const dialog = data.confirm ? `
      <div class="modal-back">
        <div class="modal">
          <h2>ARE YOU SURE?</h2>
          <p>Are you sure? All progress will be lost.</p>
          <div class="stack">
            <button class="game-btn danger" type="button" data-act="restart-yes">YES, RESTART</button>
            <button class="game-btn good" type="button" data-act="restart-no">NO, KEEP MY PROGRESS</button>
          </div>
        </div>
      </div>` : '';
    return `${shell('SETTINGS', 'Make Toast Time yours.', `
      <label class="field">USERNAME
        <input id="username" maxlength="16" value="${escapeHtml(save.username === 'Toasty' ? save.username : save.username)}" />
        <span class="help">Maximum 16 characters. Empty names become Toasty.</span>
      </label>
      <button class="game-btn danger" type="button" data-act="restart-ask">♻ RESTART PROGRESS</button>
    `)}${dialog}`;
  },
  partyIntro() {
    return shell('🎉 PARTY', 'Welcome to the new feature, party! Where you can battle other toasts!', `
      <button class="game-btn party wide" type="button" data-act="party-arenas">PICK AN ARENA</button>`);
  },
  partyArenas() {
    const cards = PARTY_ARENAS.map((arena) => `
      <article class="card">
        <h3>${arena.name}</h3>
        <p>${arena.desc}</p>
        <button class="game-btn party wide" type="button" data-act="party-start" data-id="${arena.id}">BATTLE</button>
      </article>`).join('');
    return shell('PARTY ARENAS', 'PICK AN ARENA TO BATTLE OTHER TOASTS IN', `<div class="grid">${cards}</div>`);
  },
  editorFloors(data) {
    const cards = FLOORS.map((floor) => `
      <article class="card ${data.floor === floor.id ? 'selected' : ''}">
        <h3>${floor.name}</h3>
        <p>${floor.desc}</p>
        <button class="game-btn wide" type="button" data-act="pick-floor" data-id="${floor.id}">${data.floor === floor.id ? 'SELECTED' : 'CHOOSE FLOOR'}</button>
      </article>`).join('');
    return shell('EDIT WORLD', 'STEP 1: CHOOSE A FLOOR', `
      <div class="grid">${cards}</div>
      <button class="game-btn good wide" type="button" data-act="editor-continue" style="margin-top:14px">CONTINUE</button>`);
  },
  hud() {
    return `
      <div class="hud">
        <div class="hud-top">
          <div class="hud-chip"><strong id="hud-name">Toasty</strong><span id="hud-level">Level 1</span></div>
          <div class="hud-chip" id="hud-time">0:00</div>
          <div class="hud-chip" id="hud-score">Score 0</div>
        </div>
        <div class="mode-tag" id="mode-tag">THIRD PERSON</div>
        <div class="health-box">
          <div class="bar"><div id="hud-fill"></div></div>
          <div id="hud-hp">100 / 100</div>
        </div>
        <div class="coin-line" id="hud-coins"></div>
        <div class="power-line" id="hud-powers"></div>
        <div class="boss-wrap hidden" id="hud-boss">
          <div id="hud-boss-text">BOSS TOASTER</div>
          <div class="boss-bar"><div id="hud-boss-fill"></div></div>
        </div>
        <div class="banner hidden" id="hud-banner"></div>
        <div class="howto hidden" id="how-to">
          <h2>HOW TO PLAY</h2>
          <ul>
            <li>${onTouch() ? 'Drag the stick to move.' : 'WASD or the arrow keys move.'}</li>
            <li>Collect every coin. That calls the Boss Toaster.</li>
            <li>Grab damage power-ups, like the orbit orbs, to hurt and beat the Boss Toaster.</li>
            <li>${onTouch() ? 'Stay clear of enemy toasts. Press BONK, or tap the right side, to hit them.' : 'Stay clear of enemy toasts. Press F to bonk them.'}</li>
            <li>${onTouch() ? 'CAM switches the camera. In first person, drag the right side to look.' : 'SPACE switches the camera. In first person, click and look with the mouse.'}</li>
            <li>${onTouch() ? 'Legendary skins: hold BLOCK, BURN, or FROST. Phantom taps DASH.' : 'Legendary skins: hold SHIFT to block, burn, or freeze. Phantom taps SHIFT to dash.'}</li>
          </ul>
          <button class="game-btn good wide" type="button" data-act="dismiss-howto">GOT IT</button>
        </div>
        <div class="hint" id="hud-hint"></div>
        <div id="crosshair" class="crosshair hidden"></div>
        <div id="vignette" class="vignette"></div>
        <button class="hud-exit" type="button" data-act="menu">MENU</button>
      </div>`;
  },
  soccerHud() {
    return `
      <div class="hud">
        <div class="scorebug" id="scorebug">YOU 0 — 0 ENEMIES</div>
        <div class="banner hidden" id="hud-banner"></div>
        <div class="power-line" id="soccer-power"></div>
        <div class="hint">${onTouch() ? 'Stick to move · KICK the ball · face the way you want it to go' : 'ARROW KEYS move · 1 kick · face the way you want the ball to go'}</div>
        <button class="hud-exit" type="button" data-act="menu">MENU</button>
      </div>`;
  },
  partyHud() {
    return `
      <div class="hud">
        <div class="party-hud">
          <div class="tag">PARTY</div>
          <div id="party-hp" style="font-size:28px;font-weight:800">HP: 3 / 3</div>
          <div id="party-left" style="font-size:20px;font-weight:800">AI TOASTS LEFT: 4</div>
          <div id="party-power"></div>
        </div>
        <div class="banner hidden" id="hud-banner"></div>
        <div class="hint">${onTouch() ? 'Stick to move · BONK to smack · grab the glowing powers' : 'WASD / arrows move · F or click to smack · grab the glowing powers'}</div>
        <button class="hud-exit" type="button" data-act="menu">MENU</button>
      </div>`;
  },
  savedWorlds() {
    const worlds = getSave().savedWorlds || [];
    const cards = worlds.length
      ? worlds.map((world) => {
        const floor = FLOORS.find((item) => item.id === world.floor);
        return `
          <article class="card">
            <h3>${escapeHtml(world.name)}</h3>
            <p>${floor ? floor.name : 'TOASTY GRASS'}<br>${world.coins.length} COINS · ${world.enemies.length} ENEMIES</p>
            <button class="game-btn wide" type="button" data-act="play-saved" data-id="${escapeHtml(world.id)}">PLAY</button>
          </article>`;
      }).join('')
      : '<p class="lede">No saved worlds yet. Edit a world and press SAVE.</p>';
    return shell('SAVED WORLDS', 'Play any world you saved from the editor.', `<div class="grid">${cards}</div>`);
  },
  editor(data = {}) {
    const dialog = data.confirm ? `
      <div class="modal-back">
        <div class="modal">
          <h2>ARE YOU SURE?</h2>
          <p>are you sure? all progress will be lost!</p>
          <div class="stack">
            <button class="game-btn danger" type="button" data-act="exit-editor-yes">YES, EXIT</button>
            <button class="game-btn good" type="button" data-act="exit-editor-no">NO, KEEP EDITING</button>
          </div>
        </div>
      </div>` : '';
    const note = data.message ? `<p class="lede">${escapeHtml(data.message)}</p>` : '';
    return `
      <aside class="tool-panel">
        <h2>EDIT WORLD</h2>
        <p class="lede">${onTouch() ? 'DRAG THE STICK TO MOVE. The grass keeps going. Objects appear in front of your Toast.' : 'WASD / ARROWS MOVE. The grass keeps going. Objects appear in front of your Toast.'}</p>
        <label class="field">WORLD NAME
          <input id="world-name" maxlength="24" value="${escapeHtml(data.name || 'MY WORLD')}" />
        </label>
        ${note}
        <div class="stack">
          <button class="game-btn alt" type="button" data-act="choose-floor">CHOOSE FLOOR</button>
          <button class="game-btn" type="button" data-act="spawn-enemy">SPAWN ENEMY</button>
          <button class="game-btn" type="button" data-act="spawn-coin">SPAWN COIN</button>
          <button class="game-btn alt" type="button" data-act="remove-last">REMOVE LAST</button>
          <button class="game-btn good" type="button" data-act="save-world">SAVE</button>
          <button class="game-btn good" type="button" data-act="save-play">SAVE & PLAY</button>
          <button class="game-btn danger" type="button" data-act="exit-editor">EXIT</button>
        </div>
        <p id="editor-counts">Coins 0 · Enemies 0</p>
      </aside>${dialog}`;
  },
  gameover(data) {
    return resultCard('YOU GOT TOASTED!', 'The crumbs have claimed another hero.', data, 'play-again');
  },
  victory(data) {
    return resultCard('YOU WIN!', 'The Boss Toaster is popped. You are one toasty legend.', data, 'play-again');
  },
  soccerResult(data) {
    const title = data.winner === 'you' ? 'YOU WIN!' : 'YOU LOSE';
    const copy = data.winner === 'you'
      ? `Final score YOU ${data.you} — ${data.them} ENEMIES`
      : `Final score YOU ${data.you} — ${data.them} ENEMIES`;
    return resultCard(title, copy, data, 'soccer-again');
  },
  partyResult(data) {
    if (data.winner === 'you') {
      return resultCard('YOU WIN!', 'You are the last toast standing!', data, 'party-again');
    }
    return resultCard('YOU LOST', 'Another toast is still standing.', data, 'party-again');
  },
};

function resultCard(title, copy, data, again) {
  const score = data && data.score != null ? `<p>Score ${data.score}</p>` : '';
  return `
    <div class="screen">
      <section class="sheet result-card interactive">
        <div class="crumbs">✦ CRUMBS ✦</div>
        <h2>${title}</h2>
        <p class="lede">${copy}</p>
        ${score}
        <div class="stack">
          <button class="game-btn good" type="button" data-act="${again}">PLAY AGAIN</button>
          <button class="game-btn alt" type="button" data-act="menu">RETURN TO MENU</button>
        </div>
      </section>
    </div>`;
}
