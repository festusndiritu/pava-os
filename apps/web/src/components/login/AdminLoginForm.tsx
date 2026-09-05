'use client';

import { FormEvent, useState } from 'react';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { ApiError } from '../../lib/api';

const fieldStyle = {
  borderColor: 'var(--color-border)',
  backgroundColor: 'var(--color-surface)',
  color: 'var(--color-ink-900)',
};

export function AdminLoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { loginWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await loginWithPassword(email, password);
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="admin-email"
          className="text-[11px] font-semibold uppercase"
          style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}
        >
          Email
        </label>
        <div className="relative">
          <Mail
            size={16}
            strokeWidth={2}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-ink-600)' }}
          />
          <input
            id="admin-email"
            type="email"
            required
            autoFocus
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            className="w-full rounded-md border py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
            style={fieldStyle}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="admin-password"
          className="text-[11px] font-semibold uppercase"
          style={{ color: 'var(--color-ink-600)', letterSpacing: '0.06em' }}
        >
          Password
        </label>
        <div className="relative">
          <Lock
            size={16}
            strokeWidth={2}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--color-ink-600)' }}
          />
          <input
            id="admin-password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            className="w-full rounded-md border py-2.5 pl-9 pr-10 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
            style={fieldStyle}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
            className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded transition-colors"
            style={{ color: 'var(--color-ink-600)' }}
          >
            {showPassword ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
          </button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md px-3 py-2 text-sm"
          style={{ backgroundColor: 'var(--color-status-badSoft)', color: 'var(--color-status-bad)' }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-1 rounded-md px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-60"
        style={{ backgroundColor: 'var(--color-accent)' }}
        onMouseEnter={(e) => {
          if (!submitting) e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-accent)';
        }}
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}