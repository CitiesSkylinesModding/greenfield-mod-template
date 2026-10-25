import { trigger } from 'cs2/api';
import type { UISound } from 'cs2/ui';

// The game's own groups, not the mod's, which is why they live in their own module rather than in
// `common`.
const AUDIO_GROUP = 'audio';

/**
 * Plays a Vanilla sound.
 */
export function playSound(sound: `${UISound}`, volume = 1): void {
  trigger(AUDIO_GROUP, 'playSound', sound, volume);
}
