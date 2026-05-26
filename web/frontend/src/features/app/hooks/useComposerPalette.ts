import { useMemo } from "react";

export default function useComposerPalette({
  input,
  slashCommands,
  projectSuggestions,
  skillSuggestions,
  paletteSelectedIndex,
  paletteLimit,
}) {
  const activeToken = useMemo(() => {
    if (input.startsWith("/")) {
      const commandToken = input.slice(1);
      if (!commandToken || /\s/.test(commandToken)) {
        return null;
      }
      return {
        type: "slash",
        query: commandToken.toLowerCase(),
        start: 0,
        end: input.length,
      };
    }
    const lastToken = input.split(/\s+/).pop() || "";
    const match = lastToken.match(/^([@$])([^\s]*)$/);
    if (!match) {
      return null;
    }
    const marker = match[1];
    const typed = match[2] || "";
    const end = input.length;
    const start = end - lastToken.length;
    return {
      type: marker === "@" ? "project" : "skill",
      query: typed.toLowerCase(),
      start,
      end,
    };
  }, [input]);

  const paletteItems = useMemo(() => {
    if (!activeToken) {
      return [];
    }
    const query = activeToken.query;
    if (activeToken.type === "slash") {
      if (!query) {
        return slashCommands;
      }
      return slashCommands.filter((cmd) => cmd.toLowerCase().includes(`/${query}`));
    }
    if (activeToken.type === "project") {
      return projectSuggestions;
    }
    if (!query) {
      return skillSuggestions;
    }
    return skillSuggestions.filter((name) => name.toLowerCase().includes(query));
  }, [activeToken, projectSuggestions, skillSuggestions, slashCommands]);

  const paletteOpen = paletteItems.length > 0;
  const paletteWindowStart = useMemo(
    () => Math.floor(paletteSelectedIndex / paletteLimit) * paletteLimit,
    [paletteSelectedIndex, paletteLimit]
  );
  const visiblePaletteItems = useMemo(
    () => paletteItems.slice(paletteWindowStart, paletteWindowStart + paletteLimit),
    [paletteItems, paletteWindowStart, paletteLimit]
  );

  return {
    activeToken,
    paletteItems,
    paletteOpen,
    paletteWindowStart,
    visiblePaletteItems,
  };
}
