import type { CSSProperties } from "react";
import { countMarketOptionGroups, type MarketOptionGroup } from "../../lib/locationMarkets";

type MarketGroupedSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  groups: MarketOptionGroup[];
  placeholder: string;
  disabled?: boolean;
  helperText?: string | null;
  ariaLabel?: string;
  style?: CSSProperties;
  selectStyle?: CSSProperties;
};

export default function MarketGroupedSelect({
  label,
  value,
  onChange,
  groups,
  placeholder,
  disabled = false,
  helperText,
  ariaLabel,
  style,
  selectStyle,
}: MarketGroupedSelectProps) {
  const counts = countMarketOptionGroups(groups);
  const selectedOption =
    groups.flatMap((group) => group.options).find((option) => option.value === value) ?? null;
  const selectedStatusLabel = selectedOption
    ? selectedOption.groupKey === "coming_soon"
      ? "Expansion Market"
      : "Live Clinic"
    : null;
  const shellClassName = [
    "market-select-shell",
    selectedOption?.groupKey === "coming_soon" ? "market-select-shell-coming-soon" : "",
    selectedOption?.groupKey === "live" ? "market-select-shell-live" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClassName} style={style}>
      <div className="market-select-header">
        <div className="market-select-title-block">
          <div className="market-select-label">{label}</div>
          {selectedStatusLabel ? (
            <div className="market-select-status-row">
              <span
                className={`market-select-status-badge ${
                  selectedOption?.groupKey === "coming_soon"
                    ? "market-select-status-badge-coming-soon"
                    : "market-select-status-badge-live"
                }`}
              >
                {selectedStatusLabel}
              </span>
              {selectedOption?.meta ? <span className="market-select-status-meta">{selectedOption.meta}</span> : null}
            </div>
          ) : null}
        </div>
        <div className="market-select-chips">
          {counts.live > 0 ? <span className="market-select-chip market-select-chip-live">{counts.live} live</span> : null}
          {counts.comingSoon > 0 ? <span className="market-select-chip market-select-chip-coming-soon">{counts.comingSoon} coming soon</span> : null}
        </div>
      </div>
      <div className="market-select-input-wrap">
        <select
          className="input market-select-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          aria-label={ariaLabel ?? label}
          style={selectStyle}
        >
          <option value="">{placeholder}</option>
          {groups.map((group) => (
            <optgroup key={group.key} label={group.label}>
              {group.options.map((option) => (
                <option key={`${group.key}:${option.value}`} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {selectedOption ? (
          <div className="market-select-corner-mark" aria-hidden="true">
            {selectedOption.groupKey === "coming_soon" ? "Coming Soon" : "Live"}
          </div>
        ) : null}
      </div>
      {helperText ? <div className="market-select-helper">{helperText}</div> : null}
    </div>
  );
}
