import type { CSSProperties } from 'react';

/**
 * Tag colours for a user-chosen category colour. The text is mixed toward ink
 * so bright picks (lime, amber, cyan) stay readable on the paper background.
 */
export function categoryBadgeStyle(color: string): CSSProperties {
  return {
    backgroundColor: `${color}1f`,
    color: `color-mix(in srgb, ${color} 55%, #14161c)`,
    borderColor: `${color}40`,
  };
}
