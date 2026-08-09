import { Lock, Ban, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { slotLabel, type SlotRow } from "@/lib/slots";

export function SlotPicker({
  slots,
  selectedId,
  onSelect,
  emptyMessage = "The provider hasn't opened any slots for this date.",
}: {
  slots: SlotRow[];
  selectedId: string | null;
  onSelect: (slot: SlotRow) => void;
  emptyMessage?: string;
}) {
  if (slots.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {slots.map((s) => {
        const disabled = s.status !== "available";
        const selected = selectedId === s.id;
        return (
          <button
            key={s.id}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onSelect(s)}
            className={cn(
              "flex flex-col items-start gap-1 rounded-xl border p-3 text-left text-sm font-medium transition-colors",
              disabled && "cursor-not-allowed border-border/50 bg-muted/40 text-muted-foreground",
              !disabled && selected && "border-primary bg-primary/10 ring-2 ring-primary/40",
              !disabled && !selected && "border-border hover:border-primary/60",
            )}
          >
            <span className={cn(disabled && "line-through")}>{slotLabel(s)}</span>
            <span className="flex items-center gap-1 text-[11px] font-normal">
              {s.status === "booked" && (
                <>
                  <Lock className="size-3" /> Slot already booked
                </>
              )}
              {s.status === "unavailable" && (
                <>
                  <Ban className="size-3" /> Not available
                </>
              )}
              {s.status === "available" && selected && (
                <>
                  <Check className="size-3" /> Selected
                </>
              )}
              {s.status === "available" && !selected && (
                <span className="text-muted-foreground">Available</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function DateStrip({
  dates,
  value,
  onChange,
  countFor,
}: {
  dates: string[];
  value: string;
  onChange: (d: string) => void;
  countFor?: (d: string) => number;
}) {
  return (
    <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2">
      {dates.map((d) => {
        const day = new Date(`${d}T00:00:00`);
        const selected = value === d;
        const count = countFor?.(d);
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            className={cn(
              "min-w-16 shrink-0 snap-start rounded-xl border p-2 text-center transition-colors",
              selected ? "border-primary bg-primary/10" : "border-border hover:border-primary/60",
            )}
          >
            <span className="block text-[11px] uppercase text-muted-foreground">
              {day.toLocaleDateString("en-IN", { weekday: "short" })}
            </span>
            <span className="block text-base font-bold">{day.getDate()}</span>
            {typeof count === "number" && (
              <span className="block text-[10px] text-muted-foreground">{count} open</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
