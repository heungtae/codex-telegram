type CnArg = string | undefined | null | false | Record<string, boolean>;

export function cn(...classes: CnArg[]): string {
  return classes
    .flatMap((cls) => {
      if (!cls) return [];
      if (typeof cls === "object") {
        return Object.entries(cls)
          .filter(([, v]) => v)
          .map(([k]) => k);
      }
      return [cls];
    })
    .join(" ");
}
