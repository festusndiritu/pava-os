'use client';

import { useEffect } from 'react';
import { useAuth } from '../../lib/auth-context';
import { syncPush } from '../../lib/push';

// Renders nothing. Keeps this device's push subscription attached to whoever
// is signed in, once per sign-in, for people who switched notifications on.
export function PushSync() {
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (userId) void syncPush(userId);
  }, [userId]);

  return null;
}
