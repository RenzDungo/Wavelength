import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'

const rooms = new Map()
const projectRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const contentTypes = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' }
const httpServer = createServer(async (request, response) => {
  if (request.url === '/health') { response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ service: 'wavelength', rooms: rooms.size })); return }
  const requestedPath = decodeURIComponent((request.url || '/').split('?')[0])
  const relativePath = requestedPath === '/' ? '/dist/index.html' : requestedPath.startsWith('/src/') ? requestedPath : `/dist${requestedPath}`
  const filePath = normalize(join(projectRoot, relativePath))
  if (!filePath.startsWith(normalize(projectRoot))) { response.writeHead(403); response.end('Forbidden'); return }
  try { const content = await readFile(filePath); response.writeHead(200, { 'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream' }); response.end(content) } catch { response.writeHead(404); response.end('Not found') }
})
const websocketServer = new WebSocketServer({ server: httpServer })

const codeFor = () => { let code; do code = Math.random().toString(36).slice(2, 6).toUpperCase(); while (rooms.has(code)); return code }
const send = (socket, type, payload) => socket.send(JSON.stringify({ type, ...payload }))
const publicRoom = (room, socket) => { const player = room.players.find((item) => item.name.toLowerCase() === socket.playerName?.toLowerCase()); const canSeeTarget = room.status === 'revealed' || player?.role === 'Psychic'; return { code: room.code, players: room.players, category: room.category, left: room.left, right: room.right, clue: room.clue, target: canSeeTarget ? room.target : null, status: room.status, guesses: room.guesses, round: room.round, totalRounds: room.totalRounds } }
const broadcast = (room) => { room.clients.forEach((socket) => { if (socket.readyState === 1) send(socket, 'room_state', { room: publicRoom(room, socket) }) }) }
const error = (socket, message) => send(socket, 'error', { message })

websocketServer.on('connection', (socket) => {
  socket.on('message', (raw) => {
    let message
    try { message = JSON.parse(raw.toString()) } catch { error(socket, 'Invalid message'); return }
    const name = typeof message.name === 'string' ? message.name.trim().slice(0, 24) : ''
    const code = typeof message.code === 'string' ? message.code.trim().toUpperCase() : ''
    if (message.type === 'create_room') {
      if (!name) return error(socket, 'A player name is required')
      const room = { code: codeFor(), clients: new Set([socket]), players: [{ name, score: 0, role: 'Waiting', roundsPlayed: 0 }], category: '', left: '', right: '', clue: '', target: null, status: 'lobby', guesses: {}, round: 0, totalRounds: 3 }
      socket.roomCode = room.code; socket.playerName = name; rooms.set(room.code, room); send(socket, 'room_created', { room: publicRoom(room, socket) }); broadcast(room); return
    }
    const room = rooms.get(code)
    if (!room) return error(socket, 'Room not found. Check the code and try again.')
    if (message.type === 'join_room') {
      if (!name) return error(socket, 'A player name is required')
      if (!room.players.some((player) => player.name.toLowerCase() === name.toLowerCase())) room.players.push({ name, score: 0, role: 'Waiting', roundsPlayed: 0 })
      room.clients.add(socket); socket.roomCode = code; socket.playerName = name; send(socket, 'joined_room', { room: publicRoom(room, socket) }); broadcast(room); return
    }
    if (socket.roomCode !== code) return error(socket, 'Join this room before sending game actions')
    if (message.type === 'start_round') {
      if (room.players.length < 2) return error(socket, 'At least two players are required')
      const psychicIndex = room.round % room.players.length
      room.players = room.players.map((player, index) => ({ ...player, role: index === psychicIndex ? 'Psychic' : 'Guessing' }))
      room.target = Math.floor(Math.random() * 181); room.status = 'psychic_setup'; room.guesses = {}; broadcast(room); return
    }
    if (message.type === 'publish_signal') {
      const player = room.players.find((item) => item.name.toLowerCase() === socket.playerName.toLowerCase())
      if (!player || player.role !== 'Psychic') return error(socket, 'Only the Psychic can publish the signal')
      if (![message.category, message.left, message.right, message.clue].every((value) => typeof value === 'string' && value.trim())) return error(socket, 'Category, sides, and clue are required')
      room.category = message.category.trim().slice(0, 80); room.left = message.left.trim().slice(0, 40); room.right = message.right.trim().slice(0, 40); room.clue = message.clue.trim().slice(0, 160); room.status = 'guessing'; broadcast(room); return
    }
    if (message.type === 'guess') {
      const player = room.players.find((item) => item.name.toLowerCase() === socket.playerName.toLowerCase())
      if (!player || player.role !== 'Guessing' || room.status !== 'guessing') return error(socket, 'Only Guessing players can submit guesses')
      const angle = Math.max(0, Math.min(180, Number(message.angle)))
      if (!Number.isFinite(angle)) return error(socket, 'Guess must be between 0 and 180 degrees')
      room.guesses[player.name] = angle; broadcast(room); return
    }
    if (message.type === 'reveal') {
      if (room.status !== 'guessing') return error(socket, 'The round is not ready to reveal')
      Object.entries(room.guesses).forEach(([playerName, angle]) => { const player = room.players.find((item) => item.name === playerName); const distance = Math.abs(angle - room.target); const points = distance <= 5 ? 5 : distance <= 15 ? 3 : distance <= 25 ? 1 : 0; if (player) player.score += points })
      room.status = 'revealed'; broadcast(room)
    }
    if (message.type === 'next_round') {
      if (room.status !== 'revealed') return error(socket, 'Reveal the current round first')
      room.round += 1
      if (room.round >= room.players.length * room.totalRounds) { room.status = 'finished'; broadcast(room); return }
      room.category = ''; room.left = ''; room.right = ''; room.clue = ''; room.target = Math.floor(Math.random() * 181); room.guesses = {}
      const psychicIndex = room.round % room.players.length
      room.players = room.players.map((player, index) => ({ ...player, role: index === psychicIndex ? 'Psychic' : 'Guessing', roundsPlayed: player.roundsPlayed + (index === psychicIndex ? 1 : 0) }))
      room.status = 'psychic_setup'; broadcast(room)
    }
  })
  socket.on('close', () => { const room = rooms.get(socket.roomCode); if (room) { room.clients.delete(socket); if (!room.clients.size) rooms.delete(room.code); else broadcast(room) } })
})

const port = Number(process.env.PORT) || 3001
httpServer.on('error', (serverError) => {
  if (serverError.code === 'EADDRINUSE') {
    console.error(`Wavelength server is already running on port ${port}. Use the existing server or stop it before starting another.`)
    process.exitCode = 1
    return
  }
  throw serverError
})
httpServer.listen(port, '0.0.0.0', () => console.log(`Wavelength server listening on http://0.0.0.0:${port}`))
