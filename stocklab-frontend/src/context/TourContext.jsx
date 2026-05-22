import { createContext, useContext, useState, useCallback } from 'react';

const TourContext = createContext(null);

const getSeenTours = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem('stocklab_seen_tours') || '[]'));
  } catch { return new Set(); }
};

export function TourProvider({ children }) {
  const [isTourActive, setIsTourActive]   = useState(false);
  const [currentTourId, setCurrentTourId] = useState(null);
  const [currentSteps, setCurrentSteps]   = useState([]);
  const [currentStep, setCurrentStep]     = useState(0);
  const [seenTours, setSeenTours]         = useState(getSeenTours);

  const markSeen = useCallback((tourId) => {
    setSeenTours(prev => {
      const next = new Set(prev);
      next.add(tourId);
      localStorage.setItem('stocklab_seen_tours', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const isSeenTour = useCallback((id) => seenTours.has(id), [seenTours]);

  const startTour = useCallback((tourId, steps) => {
    if (!steps?.length) return;
    setCurrentTourId(tourId);
    setCurrentSteps(steps);
    setCurrentStep(0);
    setIsTourActive(true);
  }, []);

  const endTour = useCallback(() => {
    setIsTourActive(false);
    if (currentTourId) markSeen(currentTourId);
  }, [currentTourId, markSeen]);

  const skipTour = useCallback(() => {
    setIsTourActive(false);
    if (currentTourId) markSeen(currentTourId);
  }, [currentTourId, markSeen]);

  const nextStep = useCallback(() => {
    setCurrentStep(prev => Math.min(prev + 1, currentSteps.length - 1));
  }, [currentSteps.length]);

  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }, []);

  return (
    <TourContext.Provider value={{
      isTourActive,
      currentStep,
      currentSteps,
      totalSteps: currentSteps.length,
      isSeenTour,
      startTour,
      endTour,
      skipTour,
      nextStep,
      prevStep,
    }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}
