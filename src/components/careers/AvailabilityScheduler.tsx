import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export type Day = (typeof DAYS)[number];

export interface DayAvailability {
  available: boolean;
  anytime: boolean;
  start: string; // "HH:MM" 24h
  end: string;
}

export type WeeklyAvailability = Record<Day, DayAvailability>;

export const defaultWeeklyAvailability = (): WeeklyAvailability =>
  DAYS.reduce((acc, d) => {
    acc[d] = { available: false, anytime: false, start: "09:00", end: "17:00" };
    return acc;
  }, {} as WeeklyAvailability);

// Generate 30-min slots for 12-hour AM/PM picker
const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const out: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const period = h < 12 ? "AM" : "PM";
      const h12 = h % 12 === 0 ? 12 : h % 12;
      out.push({ value, label: `${h12}:${String(m).padStart(2, "0")} ${period}` });
    }
  }
  return out;
})();

export const formatTime12 = (v: string) => TIME_OPTIONS.find((o) => o.value === v)?.label ?? v;

export const serializeAvailability = (a: WeeklyAvailability) =>
  DAYS.map((d) => {
    const day = a[d];
    if (!day.available) return `${d}: Not Available`;
    if (day.anytime) return `${d}: Available Anytime`;
    return `${d}: ${formatTime12(day.start)} – ${formatTime12(day.end)}`;
  }).join(" | ");

export const validateAvailability = (a: WeeklyAvailability): string | null => {
  const anyDay = DAYS.some((d) => a[d].available);
  if (!anyDay) return "Please select at least one day you are available.";
  for (const d of DAYS) {
    const day = a[d];
    if (day.available && !day.anytime && day.start >= day.end) {
      return `${d}: start time must be before end time.`;
    }
  }
  return null;
};

interface Props {
  value: WeeklyAvailability;
  onChange: (next: WeeklyAvailability) => void;
}

export const AvailabilityScheduler = ({ value, onChange }: Props) => {
  const update = (d: Day, patch: Partial<DayAvailability>) =>
    onChange({ ...value, [d]: { ...value[d], ...patch } });

  return (
    <div className="space-y-3">
      <Label className="text-base font-semibold">Weekly Availability</Label>
      <p className="text-sm text-muted-foreground">
        Select the days and times you can work. Toggle "Available Anytime" for full-day flexibility.
      </p>
      <div className="overflow-hidden rounded-lg border">
        {DAYS.map((d, idx) => {
          const day = value[d];
          return (
            <div
              key={d}
              className={`grid grid-cols-1 gap-3 p-3 sm:grid-cols-[140px_120px_1fr_1fr] sm:items-center ${
                idx !== DAYS.length - 1 ? "border-b" : ""
              } ${day.available ? "bg-card-elevated" : ""}`}
            >
              <label className="flex items-center gap-2 font-medium">
                <Checkbox
                  checked={day.available}
                  onCheckedChange={(c) => update(d, { available: !!c })}
                />
                {d}
              </label>

              <div className="flex items-center gap-2 text-sm">
                <Switch
                  checked={day.anytime}
                  disabled={!day.available}
                  onCheckedChange={(c) => update(d, { anytime: c })}
                />
                <span className={!day.available ? "text-muted-foreground" : ""}>Anytime</span>
              </div>

              <div>
                <Select
                  value={day.start}
                  disabled={!day.available || day.anytime}
                  onValueChange={(v) => update(d, { start: v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Start" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {TIME_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select
                  value={day.end}
                  disabled={!day.available || day.anytime}
                  onValueChange={(v) => update(d, { end: v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="End" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {TIME_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
