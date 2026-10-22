'use client';

import { useEffect } from 'react';
import { useAuth } from '../../lib/auth-context';
import { syncPush } from '../../lib/push';

export function PushSync() {
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (userId) void syncPush(userId);
  }, [userId]);

  return null;
}
