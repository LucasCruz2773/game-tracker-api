import { UnprocessableEntityException } from '@nestjs/common';
import { LibraryStatus } from '../generated/prisma/client.js';

export interface LibraryProgress {
  status: LibraryStatus;
  startedAt: Date | null;
  completedAt: Date | null;
}

/** `undefined` keeps the current value; `null` explicitly clears a date. */
export interface LibraryProgressChanges {
  status?: LibraryStatus;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

/**
 * Computes the status and dates of a library entry after a change:
 * - moving to PLAYING fills `startedAt` with today when it is empty;
 * - moving to COMPLETED fills `completedAt` with today when it is empty;
 * - any status other than COMPLETED has no `completedAt`;
 * - `completedAt` can't be earlier than `startedAt`.
 * Dates sent explicitly by the client always win over the defaults.
 */
export function resolveLibraryProgress(
  current: LibraryProgress | null,
  changes: LibraryProgressChanges,
  today: Date,
): LibraryProgress {
  const status = changes.status ?? current?.status ?? LibraryStatus.BACKLOG;
  const statusChanged = status !== current?.status;
  let startedAt =
    changes.startedAt !== undefined
      ? changes.startedAt
      : (current?.startedAt ?? null);
  let completedAt =
    changes.completedAt !== undefined
      ? changes.completedAt
      : (current?.completedAt ?? null);

  if (status !== LibraryStatus.COMPLETED) {
    if (changes.completedAt) {
      throw new UnprocessableEntityException(
        'completedAt can only be set when the status is COMPLETED',
      );
    }
    completedAt = null;
  }

  if (status === LibraryStatus.UNSET) {
    if (changes.startedAt) {
      throw new UnprocessableEntityException(
        'startedAt cannot be set when the status is UNSET',
      );
    }
    startedAt = null;
  }

  if (
    statusChanged &&
    status === LibraryStatus.PLAYING &&
    changes.startedAt === undefined &&
    startedAt === null
  ) {
    startedAt = today;
  }

  if (
    statusChanged &&
    status === LibraryStatus.COMPLETED &&
    changes.completedAt === undefined &&
    completedAt === null
  ) {
    completedAt = today;
  }

  if (startedAt && completedAt && completedAt < startedAt) {
    throw new UnprocessableEntityException(
      'completedAt cannot be earlier than startedAt',
    );
  }

  return { status, startedAt, completedAt };
}
