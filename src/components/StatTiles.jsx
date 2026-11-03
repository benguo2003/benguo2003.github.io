import { Icon } from "./ui";

export default function StatTiles({ tiles }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t, i) => (
        <div key={t.label} className="card reveal relative overflow-hidden p-4" style={{ "--i": i + 1 }}>
          <div className="flex items-center justify-between">
            <p className="eyebrow">{t.label}</p>
            <Icon name={t.icon} size={14} className="text-muted" />
          </div>
          <p className="mt-3 text-[28px] leading-none font-semibold tracking-tight">
            {t.value}
            {t.unit && <span className="ml-1 text-base font-medium text-muted">{t.unit}</span>}
          </p>
          <p className={`mt-2 truncate text-xs ${t.tone === "good" ? "text-good" : t.tone === "bad" ? "text-bad" : "text-muted"}`}>
            {t.sub}
          </p>
        </div>
      ))}
    </div>
  );
}
