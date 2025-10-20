import { Controls } from "../../components/controls";
import { VideoPlayer } from "../../components/video-player";
import { MediaPlayerProvider } from "../../provider";

export function BasicPlayer() {
  return (
    <div>
      <MediaPlayerProvider resource="http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4">
        <h1>Basic Player</h1>
        <VideoPlayer resource="http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4" />
        <Controls />
      </MediaPlayerProvider>
    </div>
  );
}
