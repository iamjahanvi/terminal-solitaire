import React, { useState, useEffect } from 'react';

const pad = (n) => String(n).padStart(2, '0');

export const greeting = (d = new Date()) => {
  const h = d.getHours();
  return h < 5 ? 'up late' : h < 12 ? 'good morning' : h < 17 ? 'good afternoon' : h < 22 ? 'good evening' : 'good night';
};

// A huge clock "cut out" of the wallpaper: the digits are the wallpaper itself
// (background-clip: text over a full-viewport copy, so it lines up exactly with
// body::before), brightened past the 55% dimming. A second, invisible copy of the
// time keeps the date line below it in the same flow.
export default function SkyClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const date = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).toLowerCase();
  return (
    <>
      <div className="sky-clock sky-cut" aria-hidden="true"><div className="sky-time">{time}</div></div>
      <div className="sky-clock" role="timer" aria-label={`${time}, ${date}`}>
        <div className="sky-time" style={{ visibility: 'hidden' }}>{time}</div>
        <div className="sky-date">{date} · {greeting(now)}</div>
      </div>
    </>
  );
}
