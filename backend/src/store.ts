import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export type Role = 'teacher' | 'student';
export type User = { id: string; name: string; email: string; passwordHash: string; role: Role; createdAt: string };
export type Room = { id: string; code: string; title: string; teacherId: string; status: 'waiting' | 'live' | 'ended'; createdAt: string; endedAt?: string };
export type Segment = { id: string; roomId: string; text: string; authorId: string; kind: 'speech' | 'sign'; createdAt: string };
type Store = { users: User[]; rooms: Room[]; segments: Segment[] };
const empty = (): Store => ({ users: [], rooms: [], segments: [] });
const file = path.resolve(process.env.DATA_FILE || './data/store.json');
let state: Store;

// A small local-first store keeps the demo easy to run without Docker.
// Replace this adapter with PostgreSQL before deploying multiple servers.
export function initStore() {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  state = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as Store : empty();
  persist();
}
function persist() {
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(state, null, 2));
  fs.renameSync(temp, file);
}
export const db = {
  users: () => state.users,
  rooms: () => state.rooms,
  segments: () => state.segments,
  addUser: (user: User) => { state.users.push(user); persist(); },
  addRoom: (room: Room) => { state.rooms.push(room); persist(); },
  updateRoom: (id: string, updates: Partial<Room>) => { const room = state.rooms.find(r => r.id === id); if (room) { Object.assign(room, updates); persist(); } return room; },
  addSegment: (segment: Segment) => { state.segments.push(segment); persist(); },
};
export const uid = () => crypto.randomUUID();
const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function roomCode() {
  let code = '';
  do { code = Array.from(crypto.randomBytes(6), n => chars[n % chars.length]).join(''); }
  while (state.rooms.some(room => room.code === code));
  return code;
}
