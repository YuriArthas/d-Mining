// Inverse of the landscape shell's CSS rotation, returned in camera NDC.
export function pointerNdc(clientX: number, clientY: number,
  rect: { left: number; top: number; width: number; height: number }, rotated: boolean) {
  const u = (clientX - rect.left) / rect.width, v = (clientY - rect.top) / rect.height;
  return rotated ? { x: 2 * v - 1, y: 2 * u - 1 } : { x: 2 * u - 1, y: 1 - 2 * v };
}
