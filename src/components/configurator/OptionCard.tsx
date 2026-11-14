"use client";

import type { LucideIcon } from "lucide-react";

interface OptionCardProps {
  /** radio group name (one per question) */
  name: string;
  value: string;
  checked: boolean;
  onSelect: (value: string) => void;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
}

/**
 * One configurator choice. A native radio input inside a label, so arrow keys, focus and screen
 * readers behave like a standard radio group.
 */
export function OptionCard({ name, value, checked, onSelect, title, subtitle, Icon }: OptionCardProps) {
  return (
    <label
      className={`group flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 transition-colors has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-amber lg:py-2.5 ${
        checked
          ? "border-phosphor bg-phosphor/10 shadow-[0_0_14px_rgb(77_255_154/0.18)]"
          : "border-line bg-panel hover:border-dim"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      <span
        aria-hidden
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ${
          checked ? "border-phosphor text-phosphor" : "border-line text-dim group-hover:text-fg"
        }`}
      >
        <Icon size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-bold ${checked ? "text-phosphor" : "text-fg"}`}>{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-dim">{subtitle}</span>
      </span>
      <span
        aria-hidden
        className={`h-3 w-3 shrink-0 rounded-full border ${checked ? "border-phosphor bg-phosphor" : "border-dim"}`}
      />
    </label>
  );
}
