export function getGuardianSettingLabel(_fieldKey, value) {
  return String(value);
}

export function getNextDropdownIndex(key, currentIndex, optionCount) {
  if (optionCount <= 0) return -1;
  if (key === "ArrowDown") return (currentIndex + 1 + optionCount) % optionCount;
  if (key === "ArrowUp") return (currentIndex - 1 + optionCount) % optionCount;
  if (key === "Home") return 0;
  if (key === "End") return optionCount - 1;
  return currentIndex;
}
