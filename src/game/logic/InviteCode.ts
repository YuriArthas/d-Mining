const INVITE_ID = /^[a-zA-Z0-9_-]{8,64}$/;
const CODE = /^MINING:1:([a-zA-Z0-9_-]{8,64}):([0-9a-f]{8})$/;

export function validateInviteId(value: unknown): string {
  if (typeof value !== 'string' || !INVITE_ID.test(value)) throw new Error('邀请标识无效');
  return value;
}

/** An error-detection checksum only: this is deliberately not a server signature. */
function checksum(text: string) {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 0x01000193);
  return (value >>> 0).toString(16).padStart(8, '0');
}

export function createInviteCode(inviteId: string) {
  const payload = `MINING:1:${validateInviteId(inviteId)}`;
  return `${payload}:${checksum(payload)}`;
}

/** Accept the code itself or a complete copied share message containing one code. */
export function parseInviteCode(text: string): string | null {
  if (typeof text !== 'string' || text.length > 4096) return null;
  // Include punctuation that could otherwise turn a damaged token into a valid prefix.
  const candidates = text.match(/MINING:[^\s\u3000\u4e00-\u9fff，。！？；、“”‘’（）【】]+/g);
  if (!candidates || candidates.length !== 1) return null;
  const match = CODE.exec(candidates[0]);
  if (!match || createInviteCode(match[1]) !== candidates[0]) return null;
  return match[1];
}
