import { useContext } from "react";
import { MediaPlayerStore } from "../stores/player-store";
import { MediaPlayerContext } from "../context";

export function useMediaPlayer(): MediaPlayerStore {
  const store = useContext(MediaPlayerContext);
  if (!store) {
    throw new Error("useMediaPlayer must be used within MediaPlayerProvider");
  }
  return store;
}
