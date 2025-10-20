import React from "react";
import { observer } from "mobx-react-lite";
import { useMediaPlayer } from "../hooks/use-media-player";

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return "0:00";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export const Controls: React.FC = observer(() => {
  const store = useMediaPlayer();

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    void store.seek(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    store.setVolume(parseFloat(e.target.value));
  };

  console.log("store.getPlaybackTime():", store.getPlaybackTime());

  return (
    <div
      className="controls"
      style={{
        opacity: store.controlsVisible ? 1 : 0,
        pointerEvents: store.controlsVisible ? "auto" : "none",
        transition: "opacity 0.3s",
        padding: "10px",
        background: "rgba(0, 0, 0, 0.7)",
        color: "#fff",
      }}
      onMouseEnter={() => store.showControls()}
      onMouseLeave={() => store.hideControls()}
    >
      {/* 播放按钮 */}
      <button
        onClick={() => store.togglePlay()}
        style={{ marginRight: "10px" }}
      >
        {store.playing ? "⏸ Pause" : "▶ Play"}
      </button>

      {/* 进度条 */}
      <input
        type="range"
        min="0"
        max={store.totalDuration}
        value={store.getPlaybackTime()}
        onChange={handleProgressChange}
        onMouseDown={() => store.startDraggingProgressBar()}
        onMouseUp={() => store.endDraggingProgressBar()}
        style={{ marginRight: "10px", flex: 1 }}
      />

      {/* 时间显示 */}
      <span style={{ marginRight: "10px" }}>
        {formatTime(store.getPlaybackTime())} /{" "}
        {formatTime(store.totalDuration)}
      </span>

      {/* 音量控制 */}
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={store.volume}
        onChange={handleVolumeChange}
        onMouseDown={() => store.startDraggingVolumeBar()}
        onMouseUp={() => store.endDraggingVolumeBar()}
        style={{ width: "100px", marginRight: "10px" }}
      />

      {/* 静音按钮 */}
      <button onClick={() => store.toggleMute()}>
        {store.volumeMuted ? "🔇" : "🔊"}
      </button>
    </div>
  );
});
