/**
 * Shared in-memory state per user.
 * Dipakai antar command (text/document handler, multi-step flow).
 */
module.exports = {
  editingState: new Map(),     // userId -> { type, mode: 'edit'|'append', buffer: [] }
  uploadingState: new Map(),   // userId -> { type }
  promptState: new Map(),      // userId -> { kind, ...extra }
  loginReadyState: new Map(),  // userId -> { resolve, reject, timeoutHandle }
  locks: new Set(),            // domain set untuk anti double-run
};
