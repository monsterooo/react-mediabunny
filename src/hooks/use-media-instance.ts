import { useState, useCallback, useRef } from "react";
import { Input, ALL_FORMATS, BlobSource } from "mediabunny";
import type { MediaInstance } from "../../types/media";

export const useMediaInstance = (id?: string) => {
  const instanceId = useRef(id || `media-${Date.now()}-${Math.random()}`);

  const [state, setState] = useState<MediaInstance>({
    id: instanceId.current,
    input: null,
    format: null,
    duration: 0,
    videoTracks: [],
    audioTracks: [],
    primaryVideoTrack: null,
    primaryAudioTrack: null,
    metadataTags: null,
    isLoading: false,
    error: null,
  });

  const loadFile = useCallback(async (file: File) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const input = new Input({
        source: new BlobSource(file),
        formats: ALL_FORMATS,
      });

      const [
        format,
        duration,
        videoTracks,
        audioTracks,
        primaryVideoTrack,
        primaryAudioTrack,
        metadataTags,
      ] = await Promise.all([
        input.getFormat(),
        input.computeDuration(),
        input.getVideoTracks(),
        input.getAudioTracks(),
        input.getPrimaryVideoTrack(),
        input.getPrimaryAudioTrack(),
        input.getMetadataTags(),
      ]);

      setState({
        id: instanceId.current,
        input,
        format,
        duration,
        videoTracks,
        audioTracks,
        primaryVideoTrack,
        primaryAudioTrack,
        metadataTags,
        isLoading: false,
        error: null,
      });

      return input;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error as Error,
        isLoading: false,
      }));
      throw error;
    }
  }, []);

  const loadFromUrl = useCallback(async (url: string) => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const { UrlSource } = await import("mediabunny");
      const input = new Input({
        source: new UrlSource(url),
        formats: ALL_FORMATS,
      });

      const [
        format,
        duration,
        videoTracks,
        audioTracks,
        primaryVideoTrack,
        primaryAudioTrack,
        metadataTags,
      ] = await Promise.all([
        input.getFormat(),
        input.computeDuration(),
        input.getVideoTracks(),
        input.getAudioTracks(),
        input.getPrimaryVideoTrack(),
        input.getPrimaryAudioTrack(),
        input.getMetadataTags(),
      ]);

      setState({
        id: instanceId.current,
        input,
        format,
        duration,
        videoTracks,
        audioTracks,
        primaryVideoTrack,
        primaryAudioTrack,
        metadataTags,
        isLoading: false,
        error: null,
      });

      return input;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error as Error,
        isLoading: false,
      }));
      throw error;
    }
  }, []);

  const unload = useCallback(() => {
    setState({
      id: instanceId.current,
      input: null,
      format: null,
      duration: 0,
      videoTracks: [],
      audioTracks: [],
      primaryVideoTrack: null,
      primaryAudioTrack: null,
      metadataTags: null,
      isLoading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    id: instanceId.current,
    loadFile,
    loadFromUrl,
    unload,
  };
};
