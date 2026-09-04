import './style.css'
import './target-wheel.css'
import './wheel-180.css'
import './guessing-wheel.css'
import './game-polish.css'
import './final-scores.css'
type GameState = 'welcome' | 'host' | 'join' | 'lobby' | 'playing'
type Player = { name: string; score: number; role: 'Psychic' | 'Guessing' | 'Waiting' }
type Room = { code: string; players: Player[]; category: string; left: string; right: string; clue: string; target: number | null; status?: 'lobby' | 'psychic_setup' | 'guessing' | 'revealed' | 'finished'; guesses?: Record<string, number>; round?: number; totalRounds?: number }

const app = document.querySelector<HTMLDivElement>('#app')!
const state: { screen: GameState; playerName: string; category: string; left: string; right: string; clue: string; code: string; round: number; totalRounds: number; target: number; guess: number; guesses: Record<string, number>; revealed: boolean; scores: number[]; players: Player[]; roomStatus: Room['status'] } = {
  screen: 'welcome', playerName: '', category: '', left: '', right: '', clue: '', code: '', round: 1, totalRounds: 3, target: 90, guess: 90, guesses: {}, revealed: false, scores: [7, 4, 2, 0], players: [], roomStatus: 'lobby',
}
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!)
const scoreForDistance = (distance: number) => distance <= 5 ? 5 : distance <= 15 ? 3 : distance <= 25 ? 1 : 0
const syncRoom = (room: Room) => { state.players = room.players; state.category = room.category; state.left = room.left; state.right = room.right; state.clue = room.clue; state.target = room.target ?? state.target; state.round = (room.round ?? 0) + 1; state.totalRounds = room.totalRounds ?? state.totalRounds; state.roomStatus = room.status ?? 'lobby'; state.guesses = room.guesses ?? {}; const currentGuess = room.guesses?.[state.playerName]; if (typeof currentGuess === 'number') state.guess = currentGuess }
let socket: WebSocket | null = null
let draggingGuess = false
const queuedMessages: Record<string, unknown>[] = []
const handleServerMessage = (event: MessageEvent) => { const message = JSON.parse(event.data as string) as { type: string; room?: Room; message?: string }; if (message.type === 'error') { window.alert(message.message || 'Server error'); return } if (!message.room) return; state.code = message.room.code; state.revealed = message.room.status === 'revealed'; syncRoom(message.room); if (message.type === 'room_created') state.screen = 'lobby'; if (message.type === 'joined_room') state.screen = message.room.status === 'lobby' ? 'lobby' : 'playing'; if (message.type === 'room_state' && message.room.status !== 'lobby') state.screen = 'playing'; if (!draggingGuess) render() }
const serverUrl = import.meta.env.DEV ? 'ws://127.0.0.1:3001' : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
const connectServer = () => { socket = new WebSocket(serverUrl); socket.addEventListener('message', handleServerMessage); socket.addEventListener('open', () => { while (queuedMessages.length) socket?.send(JSON.stringify(queuedMessages.shift())) }); socket.addEventListener('close', () => { socket = null; window.setTimeout(connectServer, 1000) }, { once: true }) }
const sendServer = (message: Record<string, unknown>) => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); else queuedMessages.push(message) }
connectServer()
const wheelPoint = (degree: number, radius = 1) => ({ x: 50 - 50 * radius * Math.cos(degree * Math.PI / 180), y: 100 - 100 * radius * Math.sin(degree * Math.PI / 180) })
const configureTargetWheel = (wheel: HTMLElement, target: number) => { const zones = wheel.querySelector<HTMLElement>('.target-zones'); if (zones) zones.style.transform = 'none'; const boundaries = [target - 25, target - 15, target - 5, target + 5, target + 15, target + 25]; wheel.querySelectorAll<HTMLElement>('.target-sector').forEach((sector, index) => { const start = wheelPoint(boundaries[index]!); const end = wheelPoint(boundaries[index + 1]!); sector.style.clipPath = `polygon(50% 100%, ${start.x}% ${start.y}%, ${end.x}% ${end.y}%)` }); const labelDegrees = [target - 20, target - 10, target, target + 10, target + 20]; wheel.querySelectorAll<HTMLElement>('.target-score').forEach((label, index) => { const degree = labelDegrees[index]!; if (degree < 0 || degree > 180) { label.style.display = 'none'; return } label.style.display = ''; const point = wheelPoint(degree, .72); label.style.left = `${point.x}%`; label.style.top = `${point.y}%`; label.style.right = 'auto' }) }
function render() {
  if (state.screen === 'welcome') renderWelcome()
  if (state.screen === 'host') renderHostName()
  if (state.screen === 'join') renderJoin()
  if (state.screen === 'lobby') renderLobby()
  if (state.screen === 'playing') renderGame()
}

function frame(content: string, active = 'PLAY') {
  app.innerHTML = `<div class="site-shell"><header class="topbar"><a class="brand" href="#" data-action="home"><span class="brand-mark">◒</span> wavelength</a><nav><a class="nav-active" href="#">${active}</a><a href="#">HOW IT WORKS</a></nav></header>${content}<footer><span>WAVELENGTH · 2026</span><span>MAKE A CONNECTION</span><span class="footer-dot"></span></footer></div>`
  app.querySelectorAll<HTMLElement>('[data-action]').forEach((element) => element.addEventListener('click', (event) => { event.preventDefault(); if (element.dataset.action === 'home') { state.screen = 'welcome'; render() } }))
}

function renderWelcome() {
  frame(`<main class="welcome"><section class="welcome-copy"><p class="eyebrow">A SOCIAL GUESSING GAME</p><h1>Find the<br><em>wavelength.</em></h1><p class="intro">Read the room. Place your guess. See how close you really are.</p><div class="welcome-actions"><button class="button button-primary" data-action="new">NEW GAME <span>→</span></button><button class="button button-ghost" data-action="join">JOIN A GAME <span>+</span></button></div><p class="hint">No account needed · Just a room code</p></section><section class="signal-art" aria-label="Abstract wavelength illustration"><div class="ring ring-one"></div><div class="ring ring-two"></div><div class="ring ring-three"></div><div class="signal-line"></div><div class="target-pin"></div><span class="art-label label-left">LOW SIGNAL</span><span class="art-label label-right">HIGH SIGNAL</span><span class="art-caption">THE SPACE<br>BETWEEN US</span></section></main>`, 'PLAY')
  app.querySelector('[data-action="new"]')?.addEventListener('click', () => { state.screen = 'host'; state.code = ''; state.players = []; state.playerName = ''; render() })
  app.querySelector('[data-action="join"]')?.addEventListener('click', () => { state.screen = 'join'; render() })
}

function renderHostName() {
  frame(`<main class="setup-page"><div class="page-heading"><p class="eyebrow">HOST A NEW GAME</p><h1>Choose your name.</h1><p>Your room will be created after you enter your name.</p></div><section class="setup-form join-form"><label>YOUR NAME</label><input id="host-name" placeholder="e.g. Jordan"><button class="button button-primary full" data-action="create-room">CREATE ROOM <span>→</span></button></section></main>`, 'NEW GAME')
  app.querySelector('[data-action="create-room"]')?.addEventListener('click', () => { const name = app.querySelector<HTMLInputElement>('#host-name')?.value.trim() || ''; if (!name) { app.querySelector<HTMLInputElement>('#host-name')?.focus(); return } state.playerName = name; sendServer({ type: 'create_room', name }) })
}

function renderJoin() {
  frame(`<main class="setup-page"><div class="page-heading"><p class="eyebrow">JOIN A GAME</p><h1>Step into the room.</h1><p>Enter your name and the room code. You will wait in the lobby until the host starts.</p></div><section class="setup-form join-form"><label>YOUR NAME</label><input id="join-name" placeholder="e.g. Alex"><label>ROOM CODE</label><input id="join-code" placeholder="e.g. KCLQ" maxlength="4"><button class="button button-primary full" data-action="join-room">JOIN ROOM <span>→</span></button></section></main>`, 'JOIN GAME')
  app.querySelector('[data-action="join-room"]')?.addEventListener('click', () => { const name = app.querySelector<HTMLInputElement>('#join-name')?.value.trim() || ''; const code = app.querySelector<HTMLInputElement>('#join-code')?.value.trim().toUpperCase() || ''; if (!name) { app.querySelector<HTMLInputElement>('#join-name')?.focus(); return } if (code.length !== 4) { app.querySelector<HTMLInputElement>('#join-code')?.focus(); return } state.playerName = name; state.code = code; sendServer({ type: 'join_room', name, code }) })
}

function renderLobby() {
  const playerRows = state.players.map((player) => `<div><span class="player-badge">${escapeHtml(player.name.slice(0, 2).toUpperCase())}</span><span>${escapeHtml(player.name)} <small>READY</small></span><i>IN ROOM</i></div>`).join('')
  const isHost = state.players[0]?.name === state.playerName
  frame(`<main class="setup-page"><div class="page-heading"><p class="eyebrow">${isHost ? 'ROOM CREATED' : 'WAITING ROOM'}</p><h1>${isHost ? 'Your room is ready.' : 'You are in.'}</h1><p>${isHost ? 'Share the code, then start when everyone has joined.' : 'The host will start the round when everyone has joined.'}</p></div><div class="setup-layout"><section class="room-preview lobby-room"><p class="eyebrow">ROOM CODE · ${state.players.length} PLAYER${state.players.length === 1 ? '' : 'S'}</p><div class="room-code">${state.code}</div><p>Share this code with anyone else joining.</p><div class="player-list">${playerRows}</div></section><aside class="room-preview lobby-status"><p class="eyebrow">YOUR STATUS</p><h2>${isHost ? 'Host' : 'Waiting for the host'}</h2><p>${escapeHtml(state.playerName)}, you are in the lobby. Your role will be assigned when the round begins.</p><span class="live-dot"></span> CONNECTED${isHost ? '<button class="button button-primary full lobby-start" data-action="begin">START ROUND <span>→</span></button>' : ''}</aside></div></main>`, 'LOBBY')
  app.querySelector('[data-action="begin"]')?.addEventListener('click', () => { sendServer({ type: 'start_round', code: state.code }) })
}

function renderPsychicSetup() {
  frame(`<main class="setup-page"><div class="page-heading"><p class="eyebrow">YOU ARE THE PSYCHIC</p><h1>Set the signal.</h1><p>Choose the spectrum and write a clue. The target is randomized for you.</p></div><div class="setup-layout"><section class="setup-form"><label>CATEGORY</label><input id="round-category" placeholder="e.g. Weekend Plans"><div class="spectrum-input"><div><label>LEFT SIDE · 0°</label><input id="round-left" placeholder="Couch potato"></div><span class="spectrum-arrow">↔</span><div><label>RIGHT SIDE · 180°</label><input id="round-right" placeholder="Action hero"></div></div><label>YOUR CLUE</label><input id="round-clue" placeholder="A short clue for the Guessers"><div class="random-target"><span>RANDOM TARGET</span><strong>Hidden from everyone until the reveal</strong></div><button class="button button-primary full" data-action="publish">PUBLISH SIGNAL <span>→</span></button></section><aside class="room-preview"><p class="eyebrow">ROOM CODE · ${state.code}</p><div class="room-code">${state.code}</div><p>${state.players.length - 1} Guessing player${state.players.length - 2 === 1 ? '' : 's'} will see your clue.</p><div class="player-list">${state.players.map((player) => `<div><span class="player-badge ${player.role === 'Psychic' ? 'host' : ''}">${escapeHtml(player.name.slice(0, 2).toUpperCase())}</span><span>${escapeHtml(player.name)} <small>${player.role.toUpperCase()}</small></span><i>READY</i></div>`).join('')}</div></aside></div></main>`, 'PSYCHIC')
  app.querySelector('.random-target')?.insertAdjacentHTML('beforebegin', `<div class="target-preview-label"><span>YOUR RANDOMIZED TARGET</span><strong>${state.target}° · READ ONLY</strong></div><div class="target-wheel target-wheel-readonly" aria-label="Randomized target preview"><div class="target-sector sector-one"></div><div class="target-sector sector-three-left"></div><div class="target-sector sector-five"></div><div class="target-sector sector-three-right"></div><div class="target-sector sector-one-right"></div><div class="target-needle" style="transform:rotate(${state.target + 180}deg)"></div><strong class="target-score score-left">1</strong><strong class="target-score score-inner-left">3</strong><strong class="target-score score-middle">5</strong><strong class="target-score score-inner-right">3</strong><strong class="target-score score-right">1</strong></div><div class="target-scale"><span>0°</span><span>90°</span><span>180°</span></div>`)
  const targetWheel = app.querySelector<HTMLElement>('.target-wheel')
  if (targetWheel) { const targetZones = document.createElement('div'); targetZones.className = 'target-zones'; targetWheel.querySelectorAll('.target-sector, .target-score').forEach((element) => targetZones.append(element)); targetWheel.prepend(targetZones); configureTargetWheel(targetWheel, state.target) }
  const randomTarget = app.querySelector<HTMLElement>('.random-target strong')
  if (randomTarget) randomTarget.textContent = 'Visible to you · hidden from Guessers'
  app.querySelector('[data-action="publish"]')?.addEventListener('click', () => { const category = app.querySelector<HTMLInputElement>('#round-category')?.value.trim() || ''; const left = app.querySelector<HTMLInputElement>('#round-left')?.value.trim() || ''; const right = app.querySelector<HTMLInputElement>('#round-right')?.value.trim() || ''; const clue = app.querySelector<HTMLInputElement>('#round-clue')?.value.trim() || ''; if (!category || !left || !right || !clue) { app.querySelector<HTMLInputElement>('#round-category')?.focus(); return } sendServer({ type: 'publish_signal', code: state.code, category, left, right, clue }) })
}

function renderGame() {
  const activePlayer = state.players.find((player) => player.name === state.playerName)
  if (state.roomStatus === 'finished') { renderFinished(); return }
  if (state.revealed) { renderRoundResults(); return }
  if (state.roomStatus === 'psychic_setup' && activePlayer?.role !== 'Psychic') { renderRoundWaiting(); return }
  if (activePlayer?.role === 'Psychic' && !state.category) { renderPsychicSetup(); return }
  const angle = state.guess + 180
  const playerRows = state.players.map((player) => `<div class="score-player ${player.name === state.playerName ? 'active' : ''}"><span class="player-badge ${player.role === 'Psychic' ? 'host' : ''}">${escapeHtml(player.name.slice(0, 2).toUpperCase())}</span><div><strong>${escapeHtml(player.name)}</strong><small>${player.role.toUpperCase()}${player.name === state.playerName ? ' · YOU' : ''}</small></div><b>${player.score}</b></div>`).join('')
  const roundOfTotal = Math.min(state.totalRounds, Math.ceil(state.round / Math.max(1, state.players.length)))
  frame(`<main class="game-page"><div class="game-header"><div><p class="eyebrow">ROUND ${String(state.round).padStart(2, '0')} · ${escapeHtml(state.category.toUpperCase())}</p><h1>${activePlayer?.role === 'Psychic' ? 'Give your group a signal.' : 'Where does it land?'}</h1></div><div class="code-display"><span>ROOM CODE</span><strong>${state.code}</strong><button title="Copy room code" data-action="copy">⧉</button></div></div><div class="game-layout"><section class="wheel-panel"><div class="turn-label"><span class="live-dot"></span> ${activePlayer?.role === 'Psychic' ? 'PSYCHIC · TARGET IS HIDDEN' : `${escapeHtml(state.playerName.toUpperCase())} IS GUESSING`} <span class="turn-time">0° LEFT · 180° RIGHT</span></div><div class="wheel-wrap"><div class="wheel"><div class="band band-1"></div><div class="needle" style="left:50%;width:46%;transform-origin:0 50%;transform:rotate(${angle}deg)"></div><div class="wheel-center">◒</div></div><span class="scale-label left-label">${escapeHtml(state.left)}<br><small>0°</small></span><span class="scale-label right-label">${escapeHtml(state.right)}<br><small>180°</small></span><span class="degree d90">90°</span></div><div class="guess-readout"><span>YOUR GUESS</span><strong>${state.guess}°</strong><input aria-label="Set guess angle from 0 to 180 degrees" type="range" min="0" max="180" value="${state.guess}" ${activePlayer?.role === 'Psychic' ? 'disabled' : ''} id="guess"></div>${activePlayer?.role === 'Psychic' ? '<p class="form-note">Give a clue. The Guessing players will place their needles.</p>' : '<button class="button button-primary reveal-button" data-action="reveal">LOCK IN GUESS <span>→</span></button>'}</section><aside class="score-panel"><div class="score-head"><span>PLAYERS · ${state.players.length}</span><span>SCORE</span></div>${playerRows}<div class="score-round">ROUND ${roundOfTotal} OF ${state.totalRounds}</div><div class="score-legend"><span class="legend-dot"></span> Center = 7 pts <span class="legend-dot pale"></span> Edge = 1 pt</div></aside></div></main>`, 'IN GAME')
  app.querySelector('.wheel-panel')?.insertAdjacentHTML('afterbegin', `<div class="clue-card"><span>THE CLUE</span><strong>${escapeHtml(state.clue)}</strong></div>`)
  app.querySelector('.score-legend')?.remove()
  const gameWheel = app.querySelector<HTMLElement>('.wheel')
  const gameBand = gameWheel?.querySelector('.band-1')
  if (gameWheel && gameBand) { gameBand.remove(); gameWheel.style.background = '#101614'; if (activePlayer?.role === 'Psychic') { gameWheel.insertAdjacentHTML('afterbegin', '<div class="target-sector sector-one"></div><div class="target-sector sector-three-left"></div><div class="target-sector sector-five"></div><div class="target-sector sector-three-right"></div><div class="target-sector sector-one-right"></div>'); configureTargetWheel(gameWheel, state.target) } }
  const guessSlider = app.querySelector<HTMLInputElement>('#guess')
  guessSlider?.addEventListener('pointerdown', (event) => { draggingGuess = true; guessSlider.setPointerCapture(event.pointerId); guessSlider.classList.add('is-dragging') })
  guessSlider?.addEventListener('pointerup', (event) => { draggingGuess = false; if (guessSlider.hasPointerCapture(event.pointerId)) guessSlider.releasePointerCapture(event.pointerId); guessSlider.classList.remove('is-dragging') })
  guessSlider?.addEventListener('pointercancel', () => { draggingGuess = false; guessSlider.classList.remove('is-dragging') })
  guessSlider?.addEventListener('input', (event) => { state.guess = Number((event.target as HTMLInputElement).value); const needle = app.querySelector<HTMLElement>('.needle'); if (needle) needle.style.transform = `rotate(${state.guess + 180}deg)`; const guessReadout = app.querySelector<HTMLElement>('.guess-readout strong'); if (guessReadout) guessReadout.textContent = `${state.guess}°`; sendServer({ type: 'guess', code: state.code, angle: state.guess }) })
  app.querySelector('[data-action="reveal"]')?.addEventListener('click', () => { sendServer({ type: 'reveal', code: state.code }) })
  app.querySelector('[data-action="copy"]')?.addEventListener('click', async () => { await navigator.clipboard?.writeText(state.code); const button = app.querySelector<HTMLButtonElement>('[data-action="copy"]'); if (button) button.textContent = '✓' })
}

const pinPalette = ['#e9783f', '#65a884', '#8db9b1', '#f0b18d', '#e89ba4', '#9cc9b4']

function renderRoundResults() {
  const activePlayer = state.players.find((player) => player.name === state.playerName)
  const guessEntries = Object.entries(state.guesses)
  const pinLegend = guessEntries.map(([name, guessAngle], index) => `<div class="pin-legend-item"><span class="pin-dot" style="background:${pinPalette[index % pinPalette.length]}"></span>${escapeHtml(name)} — ${guessAngle}°</div>`).join('')
  const playerRows = state.players.map((player) => { const guessAngle = state.guesses[player.name]; const guessLine = typeof guessAngle === 'number' ? `<small>${guessAngle}° · +${scoreForDistance(Math.abs(guessAngle - state.target))} pts</small>` : ''; return `<div class="score-player ${player.name === state.playerName ? 'active' : ''}"><span class="player-badge ${player.role === 'Psychic' ? 'host' : ''}">${escapeHtml(player.name.slice(0, 2).toUpperCase())}</span><div><strong>${escapeHtml(player.name)}</strong><small>${player.role.toUpperCase()}${player.name === state.playerName ? ' · YOU' : ''}</small>${guessLine}</div><b>${player.score}</b></div>` }).join('')
  const roundOfTotal = Math.min(state.totalRounds, Math.ceil(state.round / Math.max(1, state.players.length)))
  const myScore = activePlayer && activePlayer.role !== 'Psychic' ? scoreForDistance(Math.abs(state.guess - state.target)) : null
  frame(`<main class="game-page results-page"><div class="game-header"><div><p class="eyebrow">ROUND ${String(state.round).padStart(2, '0')} · ${escapeHtml(state.category.toUpperCase())}</p><h1>Here's how it landed.</h1></div><div class="code-display"><span>ROOM CODE</span><strong>${state.code}</strong><button title="Copy room code" data-action="copy">⧉</button></div></div><div class="game-layout"><section class="wheel-panel"><div class="clue-card"><span>THE CLUE WAS</span><strong>${escapeHtml(state.clue)}</strong></div><div class="pin-legend">${pinLegend}</div><div class="wheel-wrap"><div class="wheel"><div class="wheel-center">${state.target}°</div></div><span class="scale-label left-label">${escapeHtml(state.left)}<br><small>0°</small></span><span class="scale-label right-label">${escapeHtml(state.right)}<br><small>180°</small></span><span class="degree d90">90°</span></div><div class="reveal-result">${myScore === null ? '' : `<span class="result-badge">${myScore} PTS</span>`}<strong>The wavelength was ${state.target}°</strong>${myScore === null ? '' : `<span>${Math.abs(state.guess - state.target)}° away from center</span>`}</div><button class="button button-primary next-round" data-action="next-round">NEXT ROUND <span>→</span></button></section><aside class="score-panel"><div class="score-head"><span>PLAYERS · ${state.players.length}</span><span>SCORE</span></div>${playerRows}<div class="score-round">ROUND ${roundOfTotal} OF ${state.totalRounds}</div></aside></div></main>`, 'RESULTS')
  const gameWheel = app.querySelector<HTMLElement>('.wheel')
  if (gameWheel) {
    gameWheel.style.background = '#101614'
    gameWheel.insertAdjacentHTML('afterbegin', '<div class="target-sector sector-one"></div><div class="target-sector sector-three-left"></div><div class="target-sector sector-five"></div><div class="target-sector sector-three-right"></div><div class="target-sector sector-one-right"></div>')
    configureTargetWheel(gameWheel, state.target)
    gameWheel.insertAdjacentHTML('beforeend', `<div class="needle target-answer-needle" style="transform:rotate(${state.target + 180}deg)"></div>`)
    guessEntries.forEach(([, guessAngle], index) => { const color = pinPalette[index % pinPalette.length]; gameWheel.insertAdjacentHTML('beforeend', `<div class="guess-pin" style="transform:rotate(${guessAngle + 180}deg);background:${color}"><span class="guess-pin-dot" style="background:${color}"></span></div>`) })
  }
  app.querySelector('[data-action="next-round"]')?.addEventListener('click', () => { sendServer({ type: 'next_round', code: state.code }); state.guess = 90 })
  app.querySelector('[data-action="copy"]')?.addEventListener('click', async () => { await navigator.clipboard?.writeText(state.code); const button = app.querySelector<HTMLButtonElement>('[data-action="copy"]'); if (button) button.textContent = '✓' })
}

function renderRoundWaiting() {
  frame(`<main class="setup-page"><div class="page-heading"><p class="eyebrow">ROUND ${String(state.round).padStart(2, '0')} · WAITING</p><h1>The Psychic is setting the clue.</h1><p>Your wheel will appear as soon as the category, sides, and clue are published.</p></div><div class="room-preview lobby-status"><p class="eyebrow">ROOM CODE · ${state.code}</p><div class="room-code">${state.code}</div><span class="live-dot"></span> PSYCHIC CONNECTED</div></main>`, 'IN GAME')
}

function renderFinished() {
  const winner = [...state.players].sort((first, second) => second.score - first.score)[0]
  frame(`<main class="setup-page"><div class="page-heading"><p class="eyebrow">GAME COMPLETE</p><h1>Three rounds each.</h1><p>Final scores are in.</p></div><div class="room-preview lobby-room"><p class="eyebrow">WINNER</p><h2>${winner ? escapeHtml(winner.name) : 'No winner'}</h2><p>${winner?.score ?? 0} points</p><div class="player-list final-scores">${state.players.map((player) => `<div class="final-score-row"><span>${escapeHtml(player.name)}</span><strong>${player.score} PTS</strong></div>`).join('')}</div></div></main>`, 'FINISHED')
}

render()
