import { useEffect, useRef } from "react";
import { useMediaInstance } from "../../hooks/use-media-instance";
import { useVideoPlayer } from "../../hooks/use-video-player";

export function UseVideoPlayerStory({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const media = useMediaInstance();
  const player = useVideoPlayer(
    canvasRef.current,
    media.primaryVideoTrack,
    media.primaryAudioTrack,
    media.duration
  );

  useEffect(() => {
    media.loadFromUrl(url);
  }, [url]);

  console.log("media:", media);
  return (
    <div style={{ width: 600, height: 320 }}>
      <canvas
        ref={canvasRef}
        style={{ objectFit: "contain", width: "100%", height: "100%" }}
      />
      <button onClick={() => player.play()}>play</button>
      {url}
    </div>
  );
}

// import { useRef, useEffect } from "react";
// import { useMediaInstance } from "../../hooks/use-media-instance";
// import { useVideoPlayer } from "../../hooks/use-video-player";

// export function UseVideoPlayerStory({ url }: { url: string }) {
//   const canvasRef = useRef<HTMLCanvasElement>(null);

//   // 每个组件有自己的媒体实例
//   const media = useMediaInstance();

//   // 基于该实例的完整播放器（音视频同步）
//   const player = useVideoPlayer(
//     media.primaryVideoTrack,
//     media.primaryAudioTrack,
//     media.duration,
//     { width: 1280, height: 720, fit: "contain", poolSize: 2 }
//   );

//   useEffect(() => {
//     media.loadFromUrl(url);
//   }, [url]);

//   // 设置 canvas 引用
//   useEffect(() => {
//     if (canvasRef.current) {
//       player.setCanvas(canvasRef.current);
//     }
//   }, [player]);

//   const formatTime = (seconds: number) => {
//     const mins = Math.floor(seconds / 60);
//     const secs = Math.floor(seconds % 60);
//     return `${mins}:${secs.toString().padStart(2, "0")}`;
//   };

//   if (media.isLoading) return <div>Loading...</div>;
//   if (media.error) return <div>Error: {media.error.message}</div>;

//   return (
//     <div style={{ maxWidth: 600 }}>
//       <canvas
//         ref={canvasRef}
//         width={600}
//         height={320}
//         style={{ width: "100%", height: "auto", background: "#000" }}
//       />

//       <div style={{ padding: 16, background: "#f0f0f0" }}>
//         {/* 进度条 */}
//         <div style={{ marginBottom: 8 }}>
//           <input
//             type="range"
//             min={0}
//             max={media.duration}
//             step={0.1}
//             value={player.currentTime}
//             onChange={(e) => player.seek(Number(e.target.value))}
//             style={{ width: "100%" }}
//           />
//           <div
//             style={{
//               display: "flex",
//               justifyContent: "space-between",
//               fontSize: 12,
//             }}
//           >
//             <span>{formatTime(player.currentTime)}</span>
//             <span>{formatTime(media.duration)}</span>
//           </div>
//         </div>

//         {/* 控制按钮 */}
//         <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
//           <button onClick={player.toggle}>
//             {player.isPlaying ? "⏸ Pause" : "▶ Play"}
//           </button>

//           {media.primaryAudioTrack && (
//             <>
//               <button onClick={player.toggleMute}>
//                 {player.isMuted ? "🔇" : "🔊"}
//               </button>
//               <input
//                 type="range"
//                 min={0}
//                 max={1}
//                 step={0.01}
//                 value={player.volume}
//                 onChange={(e) => player.setVolume(Number(e.target.value))}
//                 style={{ width: 100 }}
//               />
//             </>
//           )}
//         </div>

//         {/* 媒体信息 */}
//         <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
//           {media.metadataTags?.title && (
//             <div>Title: {media.metadataTags.title}</div>
//           )}
//           {media.primaryVideoTrack && (
//             <div>
//               Video: {media.primaryVideoTrack.displayWidth}x
//               {media.primaryVideoTrack.displayHeight}
//               {media.primaryVideoTrack.codec &&
//                 ` (${media.primaryVideoTrack.codec})`}
//             </div>
//           )}
//           {media.primaryAudioTrack && (
//             <div>
//               Audio: {media.primaryAudioTrack.numberOfChannels}ch,{" "}
//               {media.primaryAudioTrack.sampleRate}Hz
//               {media.primaryAudioTrack.codec &&
//                 ` (${media.primaryAudioTrack.codec})`}
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }

// // 使用示例
// // export const App = () => {
// //   const [file, setFile] = useState<File | null>(null);

// //   return (
// //     <div>
// //       <input
// //         type="file"
// //         accept="video/*,audio/*"
// //         onChange={(e) => setFile(e.target.files?.[0] || null)}
// //       />
// //       {file && <SingleVideoPlayer file={file} />}
// //     </div>
// //   );
// // };
