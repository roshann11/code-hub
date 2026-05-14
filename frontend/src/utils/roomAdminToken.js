/** sessionStorage key for per-room admin capability token (plain token, treat as secret). */
export function adminTokenStorageKey(roomId) {
  return `coders-hub-admin-${String(roomId || '').trim().toUpperCase()}`;
}
