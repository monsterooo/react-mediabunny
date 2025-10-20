import React, { type ReactNode, useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { MediaPlayerStore } from "./stores/player-store";
import { MediaPlayerContext } from "./context";

interface MediaPlayerProviderProps {
  children: ReactNode;
  resource: File | string;
  onStoreCreate?: (store: MediaPlayerStore) => void;
}

export const MediaPlayerProvider: React.FC<MediaPlayerProviderProps> = observer(
  ({ children, resource, onStoreCreate }) => {
    const storeRef = useRef<MediaPlayerStore | null>(null);

    const loadResource = async (resource: File | string) => {
      if (!storeRef.current || !resource) return;
      await storeRef.current.initMediaPlayer(resource);
    };

    if (!storeRef.current) {
      storeRef.current = new MediaPlayerStore();
      onStoreCreate?.(storeRef.current);
    }

    // 初始化媒体
    useEffect(() => {
      if (resource) {
        loadResource(resource);
      }
    }, [resource]);

    return (
      <MediaPlayerContext.Provider value={storeRef.current}>
        {children}
      </MediaPlayerContext.Provider>
    );
  }
);
