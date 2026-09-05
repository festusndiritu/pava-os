'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { ApiError } from '../../lib/api';
import { Avatar } from '../../components/Avatar';
import { BrandMark } from '../../components/BrandMark';
import { ThemeToggle } from '../../components/ThemeToggle';
import { BrandPanel } from '../../components/login/BrandPanel';
import { StaffGrid } from '../../components/login/StaffGrid';
import { PinPad } from '../../components/login/PinPad';
import { AdminLoginForm } from '../../components/login/AdminLoginForm';

interface StaffOption {
  id: string;
  name: string;
  avatar: string | null;
}

type Mode = 'staff-grid' | 'staff-pin' | 'admin';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, loginWithPin } = useAuth();
  const [mode, setMode] = useState<Mode>('staff-grid');
  const [selectedStaff, setSelectedStaff] = useState<StaffOption | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSubmitting, setPinSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [loading, user, router]);

  async function handlePinComplete(pin: string) {
    if (!selectedStaff) return;
    setPinSubmitting(true);
    setPinError(null);
    try {
      await loginWithPin(selectedStaff.id, pin);
      router.replace('/dashboard');
    } catch (err) {
      setPinError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setPinSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-2" style={{ backgroundColor: 'var(--color-bg)' }}>
      <BrandPanel />

      <div className="relative flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>

        {/* Brand identity for mobile, where BrandPanel is hidden */}
        <div className="mb-8 flex flex-col items-center text-center lg:hidden">
          <BrandMark size={36} />
          <h1 className="mt-3 text-base font-semibold tracking-tight" style={{ color: 'var(--color-ink-900)' }}>
            Pava Steel Hardware
          </h1>
        </div>

        <div className="w-full max-w-sm">
          <p className="mb-6 text-center text-sm" style={{ color: 'var(--color-ink-600)' }}>
            {mode === 'admin' ? 'Administrator sign-in' : 'Select your account to continue'}
          </p>

          {mode === 'staff-grid' && (
            <StaffGrid
              onSelect={(s) => {
                setSelectedStaff(s);
                setMode('staff-pin');
                setPinError(null);
              }}
            />
          )}

          {mode === 'staff-pin' && selectedStaff && (
            <div className="flex flex-col items-center gap-4">
              <Avatar name={selectedStaff.name} avatar={selectedStaff.avatar} size={56} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-ink-900)' }}>
                {selectedStaff.name}
              </p>
              <PinPad
                onComplete={handlePinComplete}
                error={pinError}
                disabled={pinSubmitting}
                onErrorClear={() => setPinError(null)}
              />
              <button
                type="button"
                onClick={() => {
                  setMode('staff-grid');
                  setSelectedStaff(null);
                  setPinError(null);
                }}
                className="flex items-center gap-1.5 text-sm font-medium"
                style={{ color: 'var(--color-accent)' }}
              >
                <ChevronLeft size={15} strokeWidth={2} />
                Not you?
              </button>
            </div>
          )}

          {mode === 'admin' && <AdminLoginForm onSuccess={() => router.replace('/dashboard')} />}

          {mode !== 'staff-pin' && (
            <div className="mt-8 border-t pt-4 text-center" style={{ borderColor: 'var(--color-border)' }}>
              <button
                type="button"
                onClick={() => setMode(mode === 'admin' ? 'staff-grid' : 'admin')}
                className="inline-flex items-center gap-1.5 text-sm"
                style={{ color: 'var(--color-ink-600)' }}
              >
                {mode === 'admin' ? (
                  <>
                    <ArrowLeft size={14} strokeWidth={2} />
                    Back to staff sign-in
                  </>
                ) : (
                  <>
                    <ShieldCheck size={14} strokeWidth={2} />
                    Sign in as administrator
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}