import type { StellarChannelLogos } from '../types/stellarTunerLog';

type SquareLogoKey = 'color_dark_square' | 'list_view_square' | 'white_square';

const LIGHT_ORDER: SquareLogoKey[] = ['list_view_square', 'white_square', 'color_dark_square'];
const DARK_ORDER: SquareLogoKey[] = ['color_dark_square', 'list_view_square', 'white_square'];

/**
 * `color_dark_square` is a transparent StellarTunerLog logo variant meant to
 * sit over dark/colorful art - on a plain light panel it renders as blank
 * pixels. `list_view_square`/`white_square` are opaque, self-contained white
 * tiles built for exactly that plain-panel case, so prefer them in light mode.
 */
export function pickChannelLogoUrl(logos: StellarChannelLogos | undefined, colorScheme: 'light' | 'dark'): string | undefined {
  const order = colorScheme === 'light' ? LIGHT_ORDER : DARK_ORDER;
  for (const key of order) {
    const url = logos?.[key]?.url;
    if (url) return url;
  }
  return undefined;
}
