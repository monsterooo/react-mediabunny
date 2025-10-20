import { createContext } from "react";
import type { MediaPlayerStore } from "./stores/player-store";

export const MediaPlayerContext = createContext<MediaPlayerStore | null>(null);
