import { useEffect } from 'react';

// Web Audio API — không cần file .mp3
// Audio unlock: resume AudioContext khi user click lần đầu
let audioCtx = null;

const getAudioCtx = () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
};

// Unlock khi user interaction lần đầu
if (typeof window !== 'undefined') {
    document.addEventListener('click', () => {
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        } else {
            getAudioCtx().resume();
        }
    }, { once: true });
}

export function useNotificationSound() {
    const playBeep = () => {
        try {
            const ctx = getAudioCtx();
            if (ctx.state === 'suspended') return; // Browser blocked → silent fail
            
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.frequency.value = 880; // A5
            osc.type = 'sine';
            
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05); // fade in
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);    // fade out
            
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
        } catch (error) {
            console.error('Lỗi phát âm thanh thông báo:', error);
        }
    };
    
    return { playBeep };
}
