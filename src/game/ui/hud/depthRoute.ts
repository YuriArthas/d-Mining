/** Equal room-to-room segments keep shallow early milestones readable on a phone.
 * The current pointer interpolates metres within each segment; discovery never moves it. */
export function depthRoutePosition(depth: number, destinations: readonly { depth: number }[]) {
  const stops = [0, ...destinations.map(d => d.depth).sort((a,b) => a-b)];
  if (stops.length === 1 || depth <= 0) return 0;
  for (let i=1; i<stops.length; i++) if (depth <= stops[i]) {
    return ((i-1 + (depth-stops[i-1])/(stops[i]-stops[i-1]))/(stops.length-1))*100;
  }
  return 100;
}
