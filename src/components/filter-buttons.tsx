"use client";
import { Button } from "@cloudflare/kumo";
export function FilterButtons({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: string;
  items: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="filter-button-group">
      <legend>{label}</legend>
      <div>
        {Object.entries(items).map(([key, text]) => (
          <Button
            type="button"
            key={key}
            variant={key === value ? "secondary" : "outline"}
            aria-pressed={key === value}
            onClick={() => onChange(key)}
          >
            {text}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}
