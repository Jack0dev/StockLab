import { useEffect, useState, useRef, useCallback } from 'react';
import { useTour } from '@/infrastructure/context/TourContext';
import './TourOverlay.css';

export default function TourOverlay() {
  const {
    isTourActive, currentStep, currentSteps, totalSteps,
    nextStep, prevStep, skipTour, endTour,
  } = useTour();

  const [targetRect, setTargetRect] = useState(null);
  const tooltipRef = useRef(null);

  const step = currentSteps?.[currentStep];
  const isLastStep = currentStep === totalSteps - 1;
  const isTargetFound = Boolean(targetRect);
  const isCentered = !step?.selector || !isTargetFound;

  // Keyboard navigation (Escape, ArrowLeft, ArrowRight)
  useEffect(() => {
    if (!isTourActive) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') skipTour();
      else if (e.key === 'ArrowRight' && !isLastStep) nextStep();
      else if (e.key === 'ArrowLeft' && currentStep > 0) prevStep();
      else if (e.key === 'Enter' && isLastStep) endTour();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTourActive, currentStep, isLastStep, nextStep, prevStep, skipTour, endTour]);

  // Find target element, auto-scroll and calculate rect
  const updateRect = useCallback(() => {
    if (!step?.selector) {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(step.selector);
    if (!el) {
      setTargetRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setTargetRect({
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
      bottom: r.bottom,
      right: r.right,
    });
  }, [step]);

  useEffect(() => {
    if (!isTourActive || !step) return;

    // Smooth scroll target element into viewport center
    if (step.selector) {
      const el = document.querySelector(step.selector);
      if (el) {
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        } catch {
          // ignore
        }
      }
    }

    // Initial rect calculation
    updateRect();

    // Re-check after scroll animation settles
    const timer = setTimeout(updateRect, 220);

    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [isTourActive, currentStep, step, updateRect]);

  if (!isTourActive || !step) return null;

  const progressPct = ((currentStep + 1) / totalSteps) * 100;

  const getTooltipPlacement = () => {
    if (isCentered || !targetRect) return { style: {}, isFlipped: false };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tooltipWidth = Math.min(340, vw - 32);
    const tooltipHeight = tooltipRef.current?.offsetHeight || 220;
    const padding = 16;
    const margin = 12;

    let top = targetRect.bottom + margin;
    let left = targetRect.left + (targetRect.width - tooltipWidth) / 2;
    let isFlipped = false;

    // Flip up if bottom overflows viewport
    if (top + tooltipHeight > vh - padding) {
      top = targetRect.top - margin - tooltipHeight;
      isFlipped = true;
    }

    // Strict clamping: NEVER allow coordinates outside screen bounds
    top = Math.max(padding, Math.min(top, vh - tooltipHeight - padding));
    left = Math.max(padding, Math.min(left, vw - tooltipWidth - padding));

    return {
      style: {
        position: 'fixed',
        top: `${Math.round(top)}px`,
        left: `${Math.round(left)}px`,
        width: `${tooltipWidth}px`,
        zIndex: 100000,
      },
      isFlipped,
    };
  };

  const placement = getTooltipPlacement();

  const getArrowLeft = () => {
    if (!targetRect || !placement.style.left) return 20;
    const leftVal = parseInt(placement.style.left, 10);
    const arrowX = targetRect.left + targetRect.width / 2 - leftVal;
    return Math.max(16, Math.min(arrowX, 300));
  };

  return (
    <>
      {/* Full-screen Darkened Backdrop with Blur */}
      <div className="tour-backdrop" onClick={skipTour} />

      {/* Target Element Pulsing Highlight Box */}
      {targetRect && !isCentered && (
        <div
          className="tour-highlight"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      )}

      {/* Guide Tooltip / Centered Modal */}
      <div
        ref={tooltipRef}
        className={`tour-tooltip ${isCentered ? 'tour-tooltip-center' : ''}`}
        style={isCentered
          ? {
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 100000,
            }
          : placement.style
        }
      >
        {/* Directional Arrow */}
        {!isCentered && targetRect && (
          <div
            className={`tour-arrow ${placement.isFlipped ? 'tour-arrow-bottom' : ''}`}
            style={{ left: getArrowLeft() }}
          />
        )}

        {/* Header */}
        <div className="tour-tooltip-header">
          <div className="tour-step-badge">BƯỚC {currentStep + 1} / {totalSteps}</div>
          <button className="tour-close-btn" onClick={skipTour} title="Đóng hướng dẫn (Esc)">×</button>
        </div>

        {/* Progress Bar */}
        <div className="tour-progress-bar">
          <div className="tour-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>

        {/* Body Content */}
        <div className="tour-tooltip-body">
          <h3 className="tour-step-title">{step.title}</h3>
          <p className="tour-step-desc">
            {step.description.split('\n').map((line, i, arr) => (
              <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
            ))}
          </p>
        </div>

        {/* Action Footer */}
        <div className="tour-tooltip-footer">
          <button className="tour-skip-btn" onClick={skipTour}>Bỏ qua</button>
          <div className="tour-nav-btns">
            {currentStep > 0 && (
              <button className="tour-prev-btn" onClick={prevStep}>← Trước</button>
            )}
            {isLastStep ? (
              <button className="tour-finish-btn" onClick={endTour}>✓ Đã hiểu!</button>
            ) : (
              <button className="tour-next-btn" onClick={nextStep}>Tiếp theo →</button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
