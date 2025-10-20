import React, { type ReactNode, useRef } from "react";
import { observer } from "mobx-react-lite";
import { MediaPlayerStore } from "./stores/player-store";
import { MediaPlayerContext } from "./context";

interface MediaPlayerProviderProps {
  children: ReactNode;
  onStoreCreate?: (store: MediaPlayerStore) => void;
}

export const MediaPlayerProvider: React.FC<MediaPlayerProviderProps> = observer(
  ({ children, onStoreCreate }) => {
    const storeRef = useRef<MediaPlayerStore | null>(null);

    if (!storeRef.current) {
      storeRef.current = new MediaPlayerStore();
      onStoreCreate?.(storeRef.current);
    }

    return (
      <MediaPlayerContext.Provider value={storeRef.current}>
        {children}
      </MediaPlayerContext.Provider>
    );
  }
);
