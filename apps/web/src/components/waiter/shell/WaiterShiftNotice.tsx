import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

import { Banner } from '@/components/kit';
import { TouchNotice } from '@/components/pos-shell/TouchShell';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { startShift } from '@/lib/waiter/me-api';
import { normalizeShift } from '@/lib/waiter/me-model';
import { useActiveShift } from '@/lib/waiter/useActiveShift';

/**
 * U1 part a: a shift that is not open is one line under the header with one
 * button. Nothing shows while the shift is open or still loading.
 */
export function WaiterShiftNotice() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, branchId, clearSession, user } = useAuth();
  const { data, error, isError, isLoading, refetch } = useActiveShift();
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (error instanceof ApiError && error.isAuthError) clearSession();
  }, [clearSession, error]);

  const start = useMutation({
    mutationFn: () => startShift(accessToken as string, branchId as string),
    onMutate: () => setFailed(null),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ['waiter', 'active-shift', branchId] }),
    onError: (e) => setFailed(e instanceof ApiError ? e.message : 'The shift did not start.'),
  });

  // Me shows the shift itself; the line would only point back at the screen you are on.
  if (isLoading || router.pathname === '/waiter/me') return null;
  if (isError) {
    return (
      <TouchNotice>
        <Banner
          tone="red"
          title="Your shift could not be read."
          action={{ label: 'Try again', onClick: () => void refetch() }}
        />
      </TouchNotice>
    );
  }
  if (!data) {
    return (
      <TouchNotice>
        <Banner
          tone="amber"
          title="Your shift has not started."
          detail={failed ?? 'Tables open for orders once it starts.'}
          action={{
            label: start.isPending ? 'Starting…' : 'Start shift',
            onClick: () => (start.isPending ? undefined : start.mutate()),
          }}
        />
      </TouchNotice>
    );
  }
  const shift = normalizeShift(data, user?.permissions || []);
  if (shift.statusLabel === 'Shift issue') {
    return (
      <TouchNotice>
        <Banner
          tone="amber"
          title="Your shift needs a review."
          action={{ label: 'Open Me', onClick: () => void router.push('/waiter/me') }}
        />
      </TouchNotice>
    );
  }
  return null;
}
