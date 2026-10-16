// Scanner de WhatsApp — SOMENTE LEITURA.
// Conecta no seu WhatsApp (como o WhatsApp Web), conta quantas FOTOS chegam por grupo por dia e grava
// no Supabase (tabela app_state) os NÚMEROS e a LEGENDA das fotos. Não baixa as fotos, não guarda outras mensagens de texto e NUNCA envia mensagem.
import http from 'node:http';
import fs from 'node:fs';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } from '@whiskeysockets/baileys';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import pino from 'pino';
import { isPhoto, photoCaption, toMs, recordPhoto, pruneActivity } from './logic.js';

const { SUPABASE_URL, SUPABASE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Faltam as variáveis SUPABASE_URL e SUPABASE_KEY.'); process.exit(1); }
const TIME_ZONE = process.env.TIMEZONE || 'America/Sao_Paulo';
const AUTH_DIR = process.env.AUTH_DIR || './auth';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const save = async (key, value) => {
  const { error } = await sb.from('app_state').upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) console.error(`[supabase] erro ao salvar ${key}:`, error.message);
};
const load = async (key) => {
  const { data, error } = await sb.from('app_state').select('value').eq('key', key).maybeSingle();
  if (error) { console.error(`[supabase] erro ao ler ${key}:`, error.message); return null; }
  return data?.value ?? null;
};

let activity = { updatedAt: null, groups: {} };
let monitored = new Set();   // grupos escolhidos no site (nada é contado fora dessa lista)
let groupNames = {};         // jid -> nome do grupo
let dirty = false;
let sock = null;

const setStatus = (state, extra = {}) => save('whatsapp_status', { state, updatedAt: new Date().toISOString(), ...extra });

function handleMessages(messages) {
  for (const m of messages || []) {
    const jid = m.key?.remoteJid;
    if (!jid || !jid.endsWith('@g.us') || !monitored.has(jid) || !isPhoto(m)) continue;
    const sender = m.pushName || (m.key.participant || '').split('@')[0] || (m.key.fromMe ? 'Eu' : 'Desconhecido');
    const counted = recordPhoto(activity, { jid, groupName: groupNames[jid], messageId: m.key.id, sender, ms: toMs(m.messageTimestamp), caption: photoCaption(m) }, { timeZone: TIME_ZONE });
    if (counted) dirty = true;
  }
}

async function refreshGroups() {
  try {
    const all = await sock.groupFetchAllParticipating();
    groupNames = {};
    Object.values(all).forEach((g) => { groupNames[g.id] = g.subject; });
    const groups = Object.entries(groupNames).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    await save('whatsapp_groups', { updatedAt: new Date().toISOString(), groups });
  } catch (e) { console.error('[whatsapp] erro ao listar grupos:', e.message); }
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();
  await setStatus('starting');
  sock = makeWASocket({
    version, auth: state, logger: pino({ level: 'silent' }),
    browser: Browsers.macOS('Desktop'), syncFullHistory: false, markOnlineOnConnect: false,
  });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('messages.upsert', ({ messages }) => handleMessages(messages));
  sock.ev.on('messaging-history.set', ({ messages }) => handleMessages(messages));
  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) await setStatus('qr', { qr: await QRCode.toDataURL(qr, { margin: 1, width: 280 }) });
    if (connection === 'open') {
      console.log('[whatsapp] conectado');
      await setStatus('open', { name: sock.user?.name || '' });
      await refreshGroups();
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        console.log('[whatsapp] sessão encerrada pelo celular — gerando novo QR');
        await setStatus('logged_out');
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      } else {
        await setStatus('closed');
      }
      setTimeout(() => start().catch((e) => console.error('[whatsapp] erro ao reconectar:', e)), 3000);
    }
  });
}

// Grava a atividade a cada 8s (só se mudou) | lê a lista de grupos escolhidos a cada 30s | atualiza nomes a cada 10 min
setInterval(async () => {
  if (!dirty) return;
  dirty = false;
  pruneActivity(activity, { timeZone: TIME_ZONE });
  activity.updatedAt = new Date().toISOString();
  await save('whatsapp_activity', activity);
}, 8000);
const loadConfig = async () => { const c = await load('whatsapp_config'); monitored = new Set(c?.monitored || []); };
setInterval(loadConfig, 30000);
setInterval(() => { if (sock?.user) refreshGroups(); }, 10 * 60 * 1000);

// Servidor mínimo só pra hospedagens que exigem uma porta aberta (Render etc.)
http.createServer((_, res) => { res.end('whatsapp-scanner ok'); }).listen(process.env.PORT || 3000);
process.on('unhandledRejection', (e) => console.error('[erro]', e));

activity = (await load('whatsapp_activity')) || activity;
activity.groups ||= {};
await loadConfig();
await start();
