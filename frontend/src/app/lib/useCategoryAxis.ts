import { useIsMobile } from "../components/ui/use-mobile";

/** Narrowest label column a phone chart keeps, so the bars still get most of the width. */
const MOBILE_AXIS_MAX = 96;

/**
 * Sizing for horizontal bar charts' category (label) axis. Desktop keeps each chart's
 * own width; phones cap it and shrink the tick font so long names don't crowd out the bars.
 */
export function useCategoryAxis() {
  const isMobile = useIsMobile();
  return {
    width: (desktopWidth: number) => (isMobile ? Math.min(desktopWidth, MOBILE_AXIS_MAX) : desktopWidth),
    tick: { fontSize: isMobile ? 10 : 11 },
  };
}
