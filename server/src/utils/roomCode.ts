// ============================================================
// Room Code Generator
// ============================================================

export function generateRoomCode(existingCodes: Set<string>): string {
  let code: string;
  do {
    code = '';
    for (let i = 0; i < 8; i++) {
      code += Math.floor(Math.random() * 10).toString();
    }
  } while (existingCodes.has(code));
  return code;
}
