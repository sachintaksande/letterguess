// Common English words (~10k) for Word Chain validation
// Sourced from Google's 10k most common English words
// Loaded as a Set for O(1) lookups

import fs from 'fs';
import path from 'path';

let wordSet: Set<string> | null = null;

export function isValidWord(word: string): boolean {
  if (!wordSet) {
    const filePath = path.join(__dirname, '..', '..', 'words.txt');
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      wordSet = new Set(data.split('\n').map(w => w.trim().toUpperCase()).filter(w => w.length >= 2));
      console.log(`📚 Loaded ${wordSet.size} words for validation`);
    } catch {
      console.warn('⚠️ words.txt not found — skipping dictionary validation');
      return true; // Allow all words if dictionary unavailable
    }
  }
  return wordSet.has(word.toUpperCase());
}
