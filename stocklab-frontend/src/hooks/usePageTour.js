import { useEffect, useCallback } from 'react';
import { useTour } from '../context/TourContext';
import { PAGE_TOUR_STEPS } from '../tour/pageTourSteps';

/**
 * usePageTour(pageId)
 * - Auto-starts tour for this page if user hasn't seen it yet
 * - Returns { restartTour } for the "?" button
 */
export function usePageTour(pageId) {
  const { startTour, isSeenTour } = useTour();

  useEffect(() => {
    const steps = PAGE_TOUR_STEPS[pageId];
    if (!steps) return;

    if (!isSeenTour(pageId)) {
      const timer = setTimeout(() => startTour(pageId, steps), 700);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  const restartTour = useCallback(() => {
    const steps = PAGE_TOUR_STEPS[pageId];
    if (steps) startTour(pageId, steps);
  }, [pageId, startTour]);

  return { restartTour };
}
