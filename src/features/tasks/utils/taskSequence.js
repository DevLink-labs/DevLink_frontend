export function compareSequences(left, right) {
  const normalizedLeft = left.replace(/^0+/, "") || "0";
  const normalizedRight = right.replace(/^0+/, "") || "0";
  return normalizedLeft.length - normalizedRight.length || normalizedLeft.localeCompare(normalizedRight);
}
