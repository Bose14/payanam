import React from 'react';

/**
 * Skips re-rendering its subtree while `frozen` is true. Used to stop the hidden
 * Ride/map tab (Leaflet markers, trails, roster) from re-rendering on every GPS
 * fix and 5 s ticker while the person is on another tab. It stays mounted, so
 * the map keeps its state, and it re-renders with fresh data when shown again.
 */
const Freeze = React.memo(
  ({ children }: { frozen: boolean; children: React.ReactNode }) => <>{children}</>,
  (_prev, next) => next.frozen,
);
Freeze.displayName = 'Freeze';

export default Freeze;
