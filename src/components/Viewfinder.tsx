import React from 'react';

/** Signature frame from the Cinema Mobile system — L-corners, not a card. */
export const Viewfinder: React.FC = () => (
  <div className="pointer-events-none absolute inset-0 z-[15]" aria-hidden>
    <span className="viewfinder-corner top-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] left-4 border-l-2 border-t-2 rounded-tl-sm" />
    <span className="viewfinder-corner top-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))] right-4 border-r-2 border-t-2 rounded-tr-sm" />
    <span className="viewfinder-corner bottom-44 left-4 border-l-2 border-b-2 rounded-bl-sm md:bottom-24" />
    <span className="viewfinder-corner bottom-44 right-4 border-r-2 border-b-2 rounded-br-sm md:bottom-24" />
  </div>
);
