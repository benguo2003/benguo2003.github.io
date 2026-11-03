// Categorical slots in fixed, CVD-validated order. Colors follow the language,
// never its position in a filtered view, so toggles don't repaint survivors.
// Only the top languages by bytes get a slot; the rest fold into "Other" everywhere.
const SLOTS = 7;
const OTHER_COLOR = "var(--series-other)";

export function buildLanguageColors(languagesByBytes) {
  const map = {};
  languagesByBytes.slice(0, SLOTS).forEach((lang, i) => {
    map[lang.name] = `var(--series-${i + 1})`;
  });
  return {
    colorOf: (name) => map[name] || OTHER_COLOR,
    slotted: new Set(Object.keys(map)),
  };
}
