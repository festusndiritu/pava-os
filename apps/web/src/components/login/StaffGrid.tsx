'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Avatar } from '../Avatar';

interface StaffOption {
  id: string;
  name: string;
  avatar: string | null;
}

export function StaffGrid({
  onSelect,
}: {
  onSelect: (staff: StaffOption) => void;
}) {
  const [staff, setStaff] = useState<StaffOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<StaffOption[]>('/auth/staff', { auth: false })
      .then(setStaff)
      .catch(() =>
        setError(
          'Could not reach the server. Check your connection and try again.',
        ),
      );
  }, []);

  if (error) {
    return (
      <div className="py-10 text-center">
        <p
          className="text-sm"
          style={{ color: 'var(--color-status-bad)' }}
        >
          {error}
        </p>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-5">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="flex w-20 animate-pulse flex-col items-center gap-2"
          >
            <div
              className="h-16 w-16 rounded-full"
              style={{ backgroundColor: 'var(--color-border)' }}
            />

            <div
              className="h-3 w-14 rounded"
              style={{ backgroundColor: 'var(--color-border)' }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (staff.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <p
          className="font-medium"
          style={{ color: 'var(--color-ink-900)' }}
        >
          No active staff accounts yet
        </p>

        <p
          className="mt-1 text-sm"
          style={{ color: 'var(--color-ink-600)' }}
        >
          Ask an administrator to create one under Users &amp; Access.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-5">
      {staff.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(s)}
          className="group flex w-20 flex-col items-center gap-2 rounded-lg px-1 py-3 transition-all hover:bg-[var(--color-bg)] focus:outline-none focus:ring-2 active:scale-[0.97]"
          style={{
            ['--tw-ring-color' as string]: 'var(--color-accent-soft)',
          }}
        >
          <div className="transition-transform duration-200 group-hover:-translate-y-0.5">
            <Avatar
              name={s.name}
              avatar={s.avatar}
              size={64}
            />
          </div>

          <span
            className="text-center text-sm font-medium leading-tight"
            style={{ color: 'var(--color-ink-900)' }}
          >
            {s.name}
          </span>
        </button>
      ))}
    </div>
  );
}