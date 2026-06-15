import React, { useEffect, useRef } from 'react';

// Small right-click menu anchored at (x, y). Closes on outside click / Escape.
export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[100050] min-w-40 rounded-md py-1 text-[13px] text-gray-100 shadow-xl font-sans"
      style={{ left: x, top: y, background: 'rgba(36,36,36,0.96)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)' }}
    >
      {items.map((it, i) => (
        it.separator ? (
          <div key={i} className="my-1 border-t border-white/10" />
        ) : (
          <button
            key={i}
            disabled={it.disabled}
            onClick={() => { onClose(); it.onClick && it.onClick(); }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#3478f6] hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-100 cursor-pointer"
          >
            {it.label}
          </button>
        )
      ))}
    </div>
  );
}
