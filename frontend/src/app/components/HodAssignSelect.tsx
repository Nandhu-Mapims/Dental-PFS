import { ChevronDown } from "lucide-react";
import type { UserRow } from "../lib/api";

type HodAssignSelectProps = {
  value: string;
  onChange: (value: string) => void;
  hodUsers: UserRow[];
  className?: string;
};

export function HodAssignSelect({ value, onChange, hodUsers, className }: HodAssignSelectProps) {
  return (
    <div>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={!hodUsers.length && !value}
          className={`${
            className ||
            "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-primary"
          } cursor-pointer appearance-none pr-10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400`}
        >
          <option value="">No HOD assigned</option>
          {hodUsers.map((u) => (
            <option key={u._id} value={u._id}>
              {u.username}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
      </div>
      {!hodUsers.length ? (
        <p className="mt-1.5 text-xs text-gray-500">
          No HOD accounts yet. Add one under Users with the HOD role, then assign it here.
        </p>
      ) : null}
    </div>
  );
}
