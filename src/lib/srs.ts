/** Lịch ôn kiểu Anki (đơn giản hóa): Again / Hard / Good / Easy */

export type SrsRating = 1 | 2 | 3 | 4;

export type ReviewState = {
  ease: number;
  intervalDays: number;
  repetitions: number;
  learningStep: number;
  dueAt: Date;
};

export type ReviewPreview = {
  again: string;
  hard: string;
  good: string;
  easy: string;
};

const LEARNING_MINUTES_DEFAULT = [1, 10];

function getLearningMinutes(steps?: number[]): number[] {
  return steps && steps.length > 0 ? steps : LEARNING_MINUTES_DEFAULT;
}

function addMinutes(d: Date, m: number) {
  return new Date(d.getTime() + m * 60_000);
}

function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 86_400_000);
}

function formatInterval(from: Date, to: Date): string {
  const ms = to.getTime() - from.getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins} phút`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} giờ`;
  const days = Math.round(hours / 24);
  return `${days} ngày`;
}

export function previewIntervals(state: ReviewState, now = new Date(), learningSteps?: number[]): ReviewPreview {
  return {
    again: formatInterval(now, schedule(state, 1, now, learningSteps).dueAt),
    hard: formatInterval(now, schedule(state, 2, now, learningSteps).dueAt),
    good: formatInterval(now, schedule(state, 3, now, learningSteps).dueAt),
    easy: formatInterval(now, schedule(state, 4, now, learningSteps).dueAt),
  };
}

export function schedule(
  state: ReviewState,
  rating: SrsRating,
  now = new Date(),
  learningSteps?: number[],
): ReviewState {
  const LEARNING_MINUTES = getLearningMinutes(learningSteps);
  if (rating === 1) {
    return {
      ease: Math.max(1.3, state.ease - 0.2),
      intervalDays: 0,
      repetitions: 0,
      learningStep: 0,
      dueAt: addMinutes(now, LEARNING_MINUTES[0]),
    };
  }

  const inLearning = state.intervalDays === 0;

  if (inLearning) {
    if (rating === 2) {
      const step = Math.min(state.learningStep, LEARNING_MINUTES.length - 1);
      return {
        ...state,
        ease: Math.max(1.3, state.ease - 0.15),
        dueAt: addMinutes(now, Math.round(LEARNING_MINUTES[step] * 1.5)),
      };
    }
    if (rating === 3) {
      const nextStep = state.learningStep + 1;
      if (nextStep < LEARNING_MINUTES.length) {
        return {
          ...state,
          learningStep: nextStep,
          dueAt: addMinutes(now, LEARNING_MINUTES[nextStep]),
        };
      }
      return {
        ease: state.ease,
        intervalDays: 1,
        repetitions: 1,
        learningStep: 0,
        dueAt: addDays(now, 1),
      };
    }
    // Easy — graduate nhanh
    return {
      ease: state.ease + 0.15,
      intervalDays: 4,
      repetitions: 1,
      learningStep: 0,
      dueAt: addDays(now, 4),
    };
  }

  // Đã tốt nghiệp (graduated)
  let { ease, intervalDays, repetitions } = state;

  if (rating === 2) {
    ease = Math.max(1.3, ease - 0.15);
    intervalDays = Math.max(1, Math.round(intervalDays * 1.2));
  } else if (rating === 3) {
    intervalDays = Math.max(1, Math.round(intervalDays * ease));
    repetitions += 1;
  } else {
    ease += 0.15;
    intervalDays = Math.max(1, Math.round(intervalDays * ease * 1.3));
    repetitions += 1;
  }

  return {
    ease,
    intervalDays,
    repetitions,
    learningStep: 0,
    dueAt: addDays(now, intervalDays),
  };
}

export function defaultReviewState(now = new Date()): ReviewState {
  return {
    ease: 2.5,
    intervalDays: 0,
    repetitions: 0,
    learningStep: 0,
    dueAt: now,
  };
}

export function isDue(dueAt: Date, now = new Date()) {
  return dueAt.getTime() <= now.getTime();
}
