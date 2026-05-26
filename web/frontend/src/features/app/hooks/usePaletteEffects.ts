/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect } from "react";

export default function usePaletteEffects({
  activeToken,
  setPaletteSelectedIndex,
  paletteItems,
  paletteSelectedIndex,
  paletteOpen,
  paletteRef,
  visiblePaletteItems,
}) {
  useEffect(() => {
    setPaletteSelectedIndex(0);
  }, [activeToken?.type, activeToken?.query]);

  useEffect(() => {
    if (paletteSelectedIndex < paletteItems.length) {
      return;
    }
    setPaletteSelectedIndex(0);
  }, [paletteItems.length, paletteSelectedIndex]);

  useEffect(() => {
    if (!paletteOpen || !paletteRef.current) {
      return;
    }
    const container = paletteRef.current;
    const active = container.querySelector(".slash-item.active");
    if (!active) {
      return;
    }
    active.scrollIntoView({ block: "nearest" });
  }, [paletteOpen, paletteSelectedIndex, visiblePaletteItems.length]);
}
