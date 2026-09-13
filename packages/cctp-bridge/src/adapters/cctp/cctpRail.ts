/**
 * Backwards-compatible re-export.
 *
 * The CCTP rail now lives in `src/rails/`, but this path predates it and other modules import
 * from here. Keeping the alias means moving the implementation is not a breaking change.
 */
export * from "../../rails/cctp-settlement-rail.js";
