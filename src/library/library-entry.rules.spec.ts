import { UnprocessableEntityException } from '@nestjs/common';
import { parseIsoDate } from '../common/dates.js';
import { LibraryStatus } from '../generated/prisma/client.js';
import {
  resolveLibraryProgress,
  type LibraryProgress,
} from './library-entry.rules.js';

const today = parseIsoDate('2026-09-29');
const may1 = parseIsoDate('2026-05-01');
const may20 = parseIsoDate('2026-05-20');

function entry(overrides: Partial<LibraryProgress> = {}): LibraryProgress {
  return {
    status: LibraryStatus.BACKLOG,
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

describe('resolveLibraryProgress', () => {
  describe('new entries', () => {
    it('defaults to BACKLOG without dates', () => {
      expect(resolveLibraryProgress(null, {}, today)).toEqual(entry());
    });

    it('starts today when added as PLAYING', () => {
      expect(
        resolveLibraryProgress(null, { status: LibraryStatus.PLAYING }, today),
      ).toEqual(entry({ status: LibraryStatus.PLAYING, startedAt: today }));
    });

    it('completes today when added as COMPLETED, without guessing the start', () => {
      expect(
        resolveLibraryProgress(
          null,
          { status: LibraryStatus.COMPLETED },
          today,
        ),
      ).toEqual(entry({ status: LibraryStatus.COMPLETED, completedAt: today }));
    });

    it('keeps dates sent by the client', () => {
      expect(
        resolveLibraryProgress(
          null,
          {
            status: LibraryStatus.COMPLETED,
            startedAt: may1,
            completedAt: may20,
          },
          today,
        ),
      ).toEqual({
        status: LibraryStatus.COMPLETED,
        startedAt: may1,
        completedAt: may20,
      });
    });
  });

  describe('status changes', () => {
    it('clears progress dates when the status is removed', () => {
      expect(
        resolveLibraryProgress(
          entry({
            status: LibraryStatus.COMPLETED,
            startedAt: may1,
            completedAt: may20,
          }),
          { status: LibraryStatus.UNSET },
          today,
        ),
      ).toEqual({
        status: LibraryStatus.UNSET,
        startedAt: null,
        completedAt: null,
      });
    });

    it('keeps the original start date when resuming a game', () => {
      expect(
        resolveLibraryProgress(
          entry({ status: LibraryStatus.DROPPED, startedAt: may1 }),
          { status: LibraryStatus.PLAYING },
          today,
        ),
      ).toMatchObject({ startedAt: may1 });
    });

    it('clears the completion date when leaving COMPLETED', () => {
      expect(
        resolveLibraryProgress(
          entry({
            status: LibraryStatus.COMPLETED,
            startedAt: may1,
            completedAt: may20,
          }),
          { status: LibraryStatus.PLAYING },
          today,
        ),
      ).toEqual({
        status: LibraryStatus.PLAYING,
        startedAt: may1,
        completedAt: null,
      });
    });

    it('does not reset dates when the status stays the same', () => {
      expect(
        resolveLibraryProgress(
          entry({ status: LibraryStatus.PLAYING, startedAt: null }),
          { status: LibraryStatus.PLAYING },
          today,
        ),
      ).toMatchObject({ startedAt: null });
    });

    it('respects an explicit null instead of filling in today', () => {
      expect(
        resolveLibraryProgress(
          entry(),
          { status: LibraryStatus.PLAYING, startedAt: null },
          today,
        ),
      ).toMatchObject({ startedAt: null });
    });
  });

  describe('invalid combinations', () => {
    it('rejects a start date without a status', () => {
      expect(() =>
        resolveLibraryProgress(
          entry(),
          { status: LibraryStatus.UNSET, startedAt: may1 },
          today,
        ),
      ).toThrow('startedAt cannot be set when the status is UNSET');
    });

    it('rejects a completion date for a game that is not COMPLETED', () => {
      expect(() =>
        resolveLibraryProgress(
          entry({ status: LibraryStatus.PLAYING }),
          { completedAt: may20 },
          today,
        ),
      ).toThrow(UnprocessableEntityException);
    });

    it('rejects a completion date earlier than the start date', () => {
      expect(() =>
        resolveLibraryProgress(
          entry({ status: LibraryStatus.COMPLETED, completedAt: may1 }),
          { startedAt: may20 },
          today,
        ),
      ).toThrow('completedAt cannot be earlier than startedAt');
    });
  });
});
