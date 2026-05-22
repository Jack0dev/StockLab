import { useEffect, useState, useRef } from 'react';
import { useTour } from '../context/TourContext';
import './TourOverlay.css';

export default function TourOverlay() {
  const {
    isTourActive, currentStep, currentSteps, totalSteps,
    nextStep, prevStep, skipTour, endTour,
  } = useTour();

  const [targetRect, setTargetRect] = useState(null);
  const tooltipRef = useRef(null);

  const step = currentSteps[currentStep];
  const isLastStep = currentStep === totalSteps - 1;
  const isCentered = !step?.selector;

  // Tìm element & lấy rect
  useEffect(() => {
    if (!isTourActive || !step) return;

    const updateRect = () => {
      if (!step.selector) { setTargetRect(null); return; }
      const el = document.querySelector(step.selector);
      if (!el) { setTargetRect(null); return; }
      const r = el.getBoundingClientRect();
      setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right });
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [isTourActive, currentStep, step]);

  if (!isTourActive || !step) return null;

  const progressPct = ((currentStep + 1) / totalSteps) * 100;

  const getTooltipPlacement = () => {
    if (isCentered || !targetRect) return { style: {}, isFlipped: false };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tooltipWidth = 300;
    const tooltipHeight = tooltipRef.current?.offsetHeight || 220;
    const padding = 12;
    const overlapOffset = 12; // đè lên element một phần
    let top = targetRect.bottom - overlapOffset;
    let left = targetRect.left;
    let isFlipped = false;

    // Flip lên trên nếu tràn xuống dưới viewport
    if (top + tooltipHeight > vh - padding) {
      top = targetRect.top + overlapOffset - tooltipHeight;
      isFlipped = true;
    }
    if (left + tooltipWidth > vw - padding) left = vw - tooltipWidth - padding;
    if (left < padding) left = padding;

    return { style: { position: 'fixed', top, left }, isFlipped };
  };

  const placement = getTooltipPlacement();

  const getArrowLeft = () => {
    if (!targetRect) return 20;
    const arrowX = targetRect.left + targetRect.width / 2 - (placement.style.left || 0);
    return Math.max(12, Math.min(arrowX, 272));
  };

  return (
    <>
      {/* Highlight glow quanh element */}
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

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={`tour-tooltip ${isCentered ? 'tour-tooltip-center' : ''}`}
        style={isCentered
          ? { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }
          : placement.style
        }
      >
        {/* Arrow — top khi tooltip bên dưới element, bottom khi bị flip lên trên */}
        {!isCentered && targetRect && (
          <div
            className={`tour-arrow ${placement.isFlipped ? 'tour-arrow-bottom' : ''}`}
            style={{ left: getArrowLeft() }}
          />
        )}

        {/* Header */}
        <div className="tour-tooltip-header">
          <div className="tour-step-badge">{currentStep + 1} / {totalSteps}</div>
          <button className="tour-close-btn" onClick={skipTour}>×</button>
        </div>

        {/* Progress */}
        <div className="tour-progress-bar">
          <div className="tour-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>

        {/* Nội dung */}
        <div className="tour-tooltip-body">
          <h3 className="tour-step-title">{step.title}</h3>
          <p className="tour-step-desc">
            {step.description.split('\n').map((line, i, arr) => (
              <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
            ))}
          </p>
        </div>

        {/* Footer */}
        <div className="tour-tooltip-footer">
          <button className="tour-skip-btn" onClick={skipTour}>Bỏ qua</button>
          <div className="tour-nav-btns">
            {currentStep > 0 && (
              <button className="tour-prev-btn" onClick={prevStep}>← Quay lại</button>
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
