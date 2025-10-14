import type {
  Input,
  InputVideoTrack,
  InputAudioTrack,
  InputFormat,
  MetadataTags,
} from "mediabunny";

export interface MediaInstance {
  id: string;
  input: Input | null;
  format: InputFormat | null;
  duration: number;
  videoTracks: InputVideoTrack[];
  audioTracks: InputAudioTrack[];
  primaryVideoTrack: InputVideoTrack | null;
  primaryAudioTrack: InputAudioTrack | null;
  metadataTags: MetadataTags | null;
  isLoading: boolean;
  error: Error | null;
}
