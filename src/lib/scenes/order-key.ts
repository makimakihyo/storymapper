/**
 * fractional indexing の末尾追加用 util。
 * 'a0' -> 'a1', 'a1' -> 'a2', ..., 'a9' -> 'b0', 'z9' -> ???(Week 4 で再設計)
 *
 * 末尾文字を 0-9 でインクリメントし、9 を超えたら前置文字(英字)を a-z でインクリメント。
 * 'z9' を超える場合は Week 3 ターゲット外。Week 4 で fractional-indexing ライブラリ導入時に再設計。
 */
export function incrementOrderKey(key: string): string {
  if (!/^[a-z]+\d$/.test(key)) {
    throw new Error(`Invalid order_key format: ${key}`);
  }
  const prefix = key.slice(0, -1);
  const lastDigit = parseInt(key.slice(-1), 10);

  if (lastDigit < 9) {
    return prefix + (lastDigit + 1);
  }

  // 9 -> 桁上がり: prefix の最後の英字を +1、新しい桁は 0
  const lastChar = prefix.slice(-1);
  if (lastChar === 'z') {
    // Week 3 ターゲット外: 'z9' 超え
    throw new Error(`order_key overflow at ${key}. Week 4 で fractional-indexing 導入で対応`);
  }
  const nextChar = String.fromCharCode(lastChar.charCodeAt(0) + 1);
  return prefix.slice(0, -1) + nextChar + '0';
}
