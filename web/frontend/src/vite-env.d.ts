/// <reference types="vite/client" />

declare module "*.css";

interface Window {
  __CODEX_WEB_DEBUG__?: boolean;
  webkitAudioContext?: typeof AudioContext;
}
