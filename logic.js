// Lógica pura de contagem (sem WhatsApp, sem rede) — fácil de testar.

// Foto = imageMessage (também dentro de mensagem temporária / visualização única / documento com legenda).
export function isPhoto(m) {
  const msg = m?.message;
  if (!msg) return false;
  const inner =
    msg.ephemeralMessage?.message ||
    msg.viewOnceMessage?.message ||
    msg.viewOnceMessageV2?.message ||
    msg.documentWithCaptionMessage?.message ||
    msg;
  return !!inner.imageMessage;
}

// Legenda da foto (ex: "143 / Splice 2 / Ring"). É o ÚNICO texto que o programa guarda — só de mensagens de foto.
export function photoCaption(m) {
  const msg = m?.message;
  if (!msg) return '';
  const inner =
    msg.ephemeralMessage?.message ||
    msg.viewOnceMessage?.message ||
    msg.viewOnceMessageV2?.message ||
    msg.documentWithCaptionMessage?.message ||
    msg;
  return String(inner.imageMessage?.caption || '').trim();
}

// messageTimestamp pode vir como número, string ou objeto Long → milissegundos.
export function toMs(ts) {
  if (ts == null) return Date.now();
  const n = typeof ts === 'object' ? (typeof ts.toNumber === 'function' ? ts.toNumber() : Number(ts.low)) : Number(ts);
  return Number.isFinite(n) && n > 0 ? n * 1000 : Date.now();
}

// "YYYY-MM-DD" no fuso configurado.
export function dayKey(ms, timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

// Registra UMA foto na estrutura de atividade. Devolve true se contou (false = ignorada/duplicada).
// activity = { groups: { [jid]: { name, days: { 'YYYY-MM-DD': { photos, senders, ids, first, last } } } } }
export function recordPhoto(activity, { jid, groupName, messageId, sender, ms, caption }, { timeZone, keepDays = 21, maxIds = 800, maxCaptions = 300 }) {
  if (Date.now() - ms > keepDays * 86400000) return false;
  const g = (activity.groups[jid] ||= { name: groupName || jid, days: {} });
  if (groupName) g.name = groupName;
  const day = (g.days[dayKey(ms, timeZone)] ||= { photos: 0, senders: {}, ids: [], captions: [], first: ms, last: ms });
  day.captions ||= [];
  if (messageId && day.ids.includes(messageId)) return false; // mesma mensagem vinda 2x (histórico + ao vivo)
  if (messageId) { day.ids.push(messageId); if (day.ids.length > maxIds) day.ids.shift(); }
  // Legenda = um "ponto reportado" (o álbum vem com a legenda só numa das fotos). Guarda no máximo 200 caracteres.
  if (caption) {
    day.captions.push({ id: messageId, ms, sender: sender || 'Desconhecido', text: String(caption).slice(0, 200) });
    if (day.captions.length > maxCaptions) day.captions.shift();
  }
  day.photos += 1;
  day.senders[sender || 'Desconhecido'] = (day.senders[sender || 'Desconhecido'] || 0) + 1;
  day.first = Math.min(day.first, ms);
  day.last = Math.max(day.last, ms);
  return true;
}

// Remove dias mais antigos que keepDays.
export function pruneActivity(activity, { timeZone, keepDays = 21 }) {
  const oldest = dayKey(Date.now() - keepDays * 86400000, timeZone);
  Object.values(activity.groups).forEach((g) => {
    Object.keys(g.days).forEach((d) => { if (d < oldest) delete g.days[d]; });
  });
}
