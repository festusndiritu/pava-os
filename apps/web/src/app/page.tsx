'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { homePath } from '../lib/home-path';

// "/" is only a doorway: the installed app starts here, so it forwards straight to where you were (or the
// dashboard), or to sign-in. No "signed in as" screen in between.
export default function Home() {
  const router = useRouter();
  const { user, loading, offlineSession } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? homePath(offlineSession) : '/login');
  }, [loading, user, offlineSession, router]);

  return null;
}
