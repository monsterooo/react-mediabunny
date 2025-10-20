import React, { useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { useMediaPlayer } from "../hooks/use-media-player";

interface VideoPlayerProps {
  resource?: File | string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = observer(
  ({ resource }) => {
    const store = useMediaPlayer();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 初始化媒体
    useEffect(() => {
      if (resource) {
        void store.initMediaPlayer(resource);
      }
    }, [resource, store]);

    // 渲染循环
    useEffect(() => {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) return;

      let frameId: number;

      const render = () => {
        store.renderFrame(context, canvas);
        frameId = requestAnimationFrame(render);
      };

      render();

      // 定时器备份
      const interval = setInterval(() => {
        store.renderFrame(context, canvas);
      }, 500);

      return () => {
        cancelAnimationFrame(frameId);
        clearInterval(interval);
      };
    }, [store]);

    // 设置初始视频迭代器
    useEffect(() => {
      if (store.fileLoaded && !store.videoFrameIterator) {
        void store.startVideoIterator();
      }
    }, [store.fileLoaded, store]);

    // 初始化 canvas 尺寸
    useEffect(() => {
      if (!canvasRef.current) return;
      canvasRef.current.width = store.videoWidth || 800;
      canvasRef.current.height = store.videoHeight || 600;
    }, [store.videoWidth, store.videoHeight]);

    // 鼠标移动控制
    const handleMouseMove = () => {
      store.showControlsTemporarily();
    };

    const handleMouseLeave = () => {
      if (store.videoSink) {
        store.hideControls();
      }
    };

    // 点击播放/暂停
    const handleCanvasClick = () => {
      store.togglePlay();
    };

    return (
      <div
        ref={containerRef}
        className="video-player-container"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{
            width: 600,
            height: 320,
            objectFit: "contain",
            display: store.videoSink ? "block" : "none",
            background: store.videoCanBeTransparent ? "transparent" : "#000",
          }}
        />

        {!store.videoSink && store.fileLoaded && (
          <div
            className="audio-only-player"
            style={{ padding: "20px", background: "#222", color: "#fff" }}
          >
            🎵 Audio Only
          </div>
        )}

        {store.errorState.errors.length > 0 && (
          <div
            className="error-display"
            style={{ color: "red", padding: "10px" }}
          >
            {store.errorState.errors.map((err, i) => (
              <div key={i}>{err}</div>
            ))}
          </div>
        )}
      </div>
    );
  }
);
