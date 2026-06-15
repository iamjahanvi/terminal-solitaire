import React, { useContext, useRef, useState, useEffect, createContext } from 'react';
import { createPortal } from 'react-dom';

export const TOPBAR_H = 0; // no global menu bar — windows use the full screen

// Games portal their own controls (Hint / New / difficulty …) into the window's
// title bar through this context, so the chrome stays a single mac-style bar
// while the controls keep their state inside the game component.
const ControlsSlot = createContext(null);

export const WindowControls = ({ children }) => {
  const slot = useContext(ControlsSlot);
  return slot ? createPortal(children, slot) : null;
};

const Light = ({ color, ring, onClick, title }) => (
  <button
    type="button"
    aria-label={title}
    title={title}
    onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}
    onPointerDown={(e) => e.stopPropagation()}
    className="w-3 h-3 rounded-full border cursor-pointer traffic-light p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
    style={{ background: color, borderColor: ring }}
  />
);

// A draggable, focusable mac-style window. `fullscreen` (green) or mobile makes
// it fill the screen below the menu bar; otherwise it floats at win.x/win.y.
export default function Window({
  win, title, width, height, isMobile, focused,
  onFocus, onClose, onMinimize, onToggleFullscreen, onMoveCommit, children, footer,
}) {
  const ref = useRef(null);
  const drag = useRef(null);
  const [slotEl, setSlotEl] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);

  // While the browser is being resized the window re-centers; skip the geometry
  // transition then so it snaps instead of sliding to keep up.
  useEffect(() => {
    let t;
    const onResize = () => { setResizing(true); clearTimeout(t); t = setTimeout(() => setResizing(false), 160); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); clearTimeout(t); };
  }, []);

  const fullscreen = isMobile || win.fullscreen;

  const startDrag = (e) => {
    if (fullscreen || e.button > 0) return;
    onFocus();
    setDragging(true); // disable the geometry transition while dragging
    const rect = ref.current.getBoundingClientRect();
    drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, x: null, y: null };
    const onMove = (ev) => {
      const x = Math.max(0, Math.min(window.innerWidth - 60, ev.clientX - drag.current.dx));
      const y = Math.max(TOPBAR_H, Math.min(window.innerHeight - 24, ev.clientY - drag.current.dy));
      drag.current.x = x; drag.current.y = y;
      if (ref.current) { ref.current.style.left = `${x}px`; ref.current.style.top = `${y}px`; }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (drag.current && drag.current.x != null) onMoveCommit(drag.current.x, drag.current.y);
      drag.current = null;
      setDragging(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const frameStyle = fullscreen
    ? {
        left: 0, top: isMobile ? 0 : TOPBAR_H,
        width: '100%', height: isMobile ? '100dvh' : `calc(100% - ${TOPBAR_H}px)`,
        borderRadius: 0, boxShadow: 'none',
      }
    : {
        left: win.x, top: win.y, width, height,
        borderRadius: 12, boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
      };

  return (
    <div
      ref={ref}
      onPointerDown={onFocus}
      className={`fixed flex flex-col terminal-bg overflow-hidden border border-[#2d2d2d] win-open ${focused ? '' : 'opacity-95'}`}
      style={{
        ...frameStyle, zIndex: win.z, display: win.minimized ? 'none' : 'flex',
        transition: dragging || resizing ? 'none' : 'left 0.25s ease, top 0.25s ease, width 0.25s ease, height 0.25s ease, border-radius 0.25s ease',
      }}
    >
      {isMobile ? (
        <div
          className="bg-[#2d2d2d] flex items-center gap-3 px-3 pb-2 flex-shrink-0 border-b border-black"
          style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
        >
          <button onClick={onClose} className="text-gray-300 active:text-white text-sm flex-shrink-0">‹ Home</button>
          <div ref={setSlotEl} className="ml-auto flex items-center gap-3 text-xs text-gray-400 uppercase tracking-wide" />
        </div>
      ) : (
        <div
          onPointerDown={startDrag}
          onDoubleClick={onToggleFullscreen}
          className="bg-[#2d2d2d] h-8 flex items-center px-4 relative flex-shrink-0 border-b border-black select-none"
        >
          <div className={`flex gap-2 z-10 ${focused ? '' : 'opacity-60'}`}>
            <Light color="#ff5f56" ring="#e0443e" onClick={onClose} title="Close" />
            <Light color="#ffbd2e" ring="#dea123" onClick={onMinimize} title="Minimize" />
            <Light color="#27c93f" ring="#1aab29" onClick={onToggleFullscreen} title="Full screen" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className={`text-sm font-semibold tracking-wider ${focused ? 'text-gray-300' : 'text-gray-500'}`}>{title}</span>
          </div>
          <div
            ref={setSlotEl}
            onPointerDown={(e) => e.stopPropagation()}
            className="ml-auto z-10 flex items-center gap-4 text-xs text-gray-500"
          />
        </div>
      )}

      <div className="flex-1 relative min-h-0">
        <ControlsSlot.Provider value={slotEl}>{children}</ControlsSlot.Provider>
        {footer}
      </div>
    </div>
  );
}
