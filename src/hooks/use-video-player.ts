import { useState, useRef, useEffect } from "react";
import { CanvasSink, AudioBufferSink } from "mediabunny";
import type {
  InputVideoTrack,
  InputAudioTrack,
  WrappedCanvas,
  WrappedAudioBuffer,
} from "mediabunny";

let asyncId = 0;

export interface VideoPlayerOptions {
  width?: number;
  height?: number;
  fit?: "fill" | "contain" | "cover";
  autoPlay?: boolean;
  poolSize?: number;
}

export const useVideoPlayer = (
  canvas: HTMLCanvasElement | null,
  videoTrack: InputVideoTrack | null,
  audioTrack: InputAudioTrack | null,
  duration: number,
  options?: VideoPlayerOptions
) => {
  const [playing, setPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);

  const videoFrameIterator = useRef<AsyncGenerator<
    WrappedCanvas,
    void,
    unknown
  > | null>(null);
  const audioBufferIterator = useRef<AsyncGenerator<
    WrappedAudioBuffer,
    void,
    unknown
  > | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const gainNode = useRef<GainNode | null>(null);
  const videoSink = useRef<CanvasSink | null>(null);
  const audioSink = useRef<AudioBufferSink | null>(null);
  const nextFrame = useRef<WrappedCanvas | null>(null);
  const playbackTimeAtStart = useRef(0);
  const audioContextStartTime = useRef<number | null>(null);
  const context = useRef<CanvasRenderingContext2D | null>(null);

  const updateVolume = () => {
    const actualVolume = isMuted ? 0 : volume;

    gainNode.current!.gain.value = actualVolume ** 2; // Quadratic for more fine-grained control
  };

  // Returns the current playback time in the media file.
  const getPlaybackTime = () => {
    if (playing) {
      // To ensure perfect audio-video sync, we always use the audio context's clock to determine playback time, even
      // when there is no audio track.
      return (
        audioContext.current!.currentTime -
        audioContextStartTime.current! +
        playbackTimeAtStart.current
      );
    } else {
      return playbackTimeAtStart.current;
    }
  };

  // Creates a new video frame iterator and renders the first video frame.
  const startVideoIterator = async () => {
    if (!videoSink.current) {
      return;
    }

    asyncId++;

    await videoFrameIterator.current?.return(); // Dispose of the current iterator

    // Create a new iterator
    videoFrameIterator.current = videoSink.current.canvases(getPlaybackTime());

    // Get the first two frames
    const firstFrame = (await videoFrameIterator.current.next()).value ?? null;
    const secondFrame = (await videoFrameIterator.current.next()).value ?? null;

    nextFrame.current = secondFrame;

    if (firstFrame && context.current && canvas) {
      // Draw the first frame
      context.current.clearRect(0, 0, canvas.width, canvas.height);
      context.current.drawImage(firstFrame.canvas, 0, 0);
    }
  };

  // Iterates over the video frame iterator until it finds a video frame in the future.
  const updateNextFrame = async () => {
    if (!canvas || !context.current) return;

    const currentAsyncId = asyncId;

    // We have a loop here because we may need to iterate over multiple frames until we reach a frame in the future
    while (true) {
      const newNextFrame =
        (await videoFrameIterator.current!.next()).value ?? null;
      if (!newNextFrame) {
        break;
      }

      if (currentAsyncId !== asyncId) {
        break;
      }

      const playbackTime = getPlaybackTime();
      if (newNextFrame.timestamp <= playbackTime) {
        // Draw it immediately
        context.current.clearRect(0, 0, canvas.width, canvas.height);
        context.current.drawImage(newNextFrame.canvas, 0, 0);
      } else {
        // Save it for later
        nextFrame.current = newNextFrame;
        break;
      }
    }
  };

  const render = (requestFrame = true) => {
    if (!canvas || !context.current) return;

    const playbackTime = getPlaybackTime();
    if (playbackTime >= duration) {
      // Pause playback once the end is reached
      // pause();
      playbackTimeAtStart.current = duration;
    }

    if (nextFrame.current && nextFrame.current.timestamp <= playbackTime) {
      context.current.clearRect(0, 0, canvas.width, canvas.height);
      context.current.drawImage(nextFrame.current!.canvas, 0, 0);
      nextFrame.current = null;

      // Request the next frame
      updateNextFrame();
    }

    if (requestFrame) {
      requestAnimationFrame(() => render());
    }
  };

  const runAudioIterator = async () => {
    if (!audioSink.current) {
      return;
    }

    // To play back audio, we loop over all audio chunks (typically very short) of the file and play them at the correct
    // timestamp. The result is a continuous, uninterrupted audio signal.
    for await (const { buffer, timestamp } of audioBufferIterator.current!) {
      const node = audioContext.current!.createBufferSource();
      node.buffer = buffer;
      node.connect(gainNode.current!);

      const startTimestamp =
        audioContextStartTime.current! +
        timestamp -
        playbackTimeAtStart.current;

      // Two cases: Either, the audio starts in the future or in the past
      if (startTimestamp >= audioContext.current!.currentTime) {
        // If the audio starts in the future, easy, we just schedule it
        node.start(startTimestamp);
      } else {
        // If it starts in the past, then let's only play the audible section that remains from here on out
        node.start(
          audioContext.current!.currentTime,
          audioContext.current!.currentTime - startTimestamp
        );
      }

      // If we're more than a second ahead of the current playback time, let's slow down the loop until time has
      // passed.
      if (timestamp - getPlaybackTime() >= 1) {
        await new Promise<void>((resolve) => {
          const id = setInterval(() => {
            if (timestamp - getPlaybackTime() < 1) {
              clearInterval(id);
              resolve();
            }
          }, 100);
        });
      }
    }
  };

  const init = async () => {
    if (playing) {
      // pause();
    }

    videoFrameIterator.current?.return();
    audioBufferIterator.current?.return();
    asyncId++;

    playbackTimeAtStart.current = 0;
    // totalDuration => duration

    // TODO videoTrack and audioTrack is null
    // TODo videoTrack and audioTrack can decode

    const AudioContext =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.AudioContext || (window as any).webkitAudioContext;
    audioContext.current = new AudioContext({
      sampleRate: audioTrack?.sampleRate,
    });
    gainNode.current = audioContext.current.createGain();
    gainNode.current.connect(audioContext.current.destination);

    updateVolume();

    const videoCanBeTransparent = videoTrack
      ? await videoTrack.canBeTransparent()
      : false;

    // For video, let's use a CanvasSink as it handles rotation and closing video samples for us.
    // Pool size of 2: We'll only ever have the current and the next frame around, so we only need two canvases.
    videoSink.current =
      videoTrack &&
      new CanvasSink(videoTrack, {
        poolSize: 2,
        fit: "contain", // In case the video changes dimensions over time
        alpha: videoCanBeTransparent,
      });
    // For audio, we'll use an AudioBufferSink to directly retrieve AudioBuffers compatible with the Web Audio API
    audioSink.current = audioTrack && new AudioBufferSink(audioTrack);

    if (videoTrack) {
      canvas?.setAttribute("width", videoTrack.displayWidth.toString());
      canvas?.setAttribute("height", videoTrack.displayHeight.toString());
    }

    await startVideoIterator();

    // if (audioContext.current.state === "suspended") {
    //   await play();
    // }
  };

  const play = async () => {
    if (audioContext.current!.state === "suspended") {
      await audioContext.current!.resume();
    }

    if (getPlaybackTime() === duration) {
      // If we're at the end, let's snap back to the start
      playbackTimeAtStart.current = 0;
      await startVideoIterator();
    }

    audioContextStartTime.current = audioContext.current!.currentTime;
    setPlaying(true);

    if (audioSink.current) {
      audioBufferIterator.current?.return();
      audioBufferIterator.current = audioSink.current.buffers(
        getPlaybackTime()
      );
      runAudioIterator();
    }
  };

  useEffect(() => {
    console.log("canvas", canvas);
    console.log("track变更", videoTrack, audioTrack);
    if (!canvas) return;

    context.current = canvas.getContext("2d");

    if (videoTrack || audioTrack) {
      init();
      render();
    }
  }, [videoTrack, audioTrack, canvas]);

  return {
    play,
  };
};

// export const useVideoPlayer = (
//   videoTrack: InputVideoTrack | null,
//   audioTrack: InputAudioTrack | null,
//   duration: number,
//   options?: VideoPlayerOptions
// ) => {
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [currentTime, setCurrentTime] = useState(0);
//   const [volume, setVolume] = useState(0.7);
//   const [isMuted, setIsMuted] = useState(false);

//   // Refs
//   const videoSinkRef = useRef<CanvasSink | null>(null);
//   const audioSinkRef = useRef<AudioBufferSink | null>(null);
//   const audioContextRef = useRef<AudioContext | null>(null);
//   const gainNodeRef = useRef<GainNode | null>(null);

//   // 播放控制
//   const playbackTimeAtStartRef = useRef(0);
//   const audioContextStartTimeRef = useRef<number | null>(null);
//   const asyncIdRef = useRef(0); // 防止异步竞态

//   // 迭代器
//   const videoIteratorRef = useRef<AsyncGenerator<
//     WrappedCanvas,
//     void,
//     unknown
//   > | null>(null);
//   const audioIteratorRef = useRef<AsyncGenerator<
//     WrappedAudioBuffer,
//     void,
//     unknown
//   > | null>(null);
//   const nextFrameRef = useRef<WrappedCanvas | null>(null);
//   const queuedAudioNodesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

//   // Canvas ref (由外部传入)
//   const canvasRef = useRef<HTMLCanvasElement | null>(null);
//   const rafIdRef = useRef<number | null>(null);

//   // 初始化 Sinks 和 AudioContext
//   useEffect(() => {
//     if (videoTrack && !videoSinkRef.current) {
//       videoSinkRef.current = new CanvasSink(videoTrack, {
//         width: options?.width,
//         height: options?.height,
//         fit: options?.fit || "contain",
//         poolSize: options?.poolSize || 2, // 官方推荐使用 pool
//       });
//     }

//     if (audioTrack && !audioSinkRef.current) {
//       audioSinkRef.current = new AudioBufferSink(audioTrack);

//       // 创建 AudioContext，匹配音轨采样率
//       const AudioContextClass =
//         // eslint-disable-next-line @typescript-eslint/no-explicit-any
//         window.AudioContext || (window as any).webkitAudioContext;
//       audioContextRef.current = new AudioContextClass({
//         sampleRate: audioTrack.sampleRate,
//       });
//       gainNodeRef.current = audioContextRef.current.createGain();
//       gainNodeRef.current.connect(audioContextRef.current.destination);
//       updateVolumeInternal();
//     } else if (!audioTrack && !audioContextRef.current) {
//       // 即使没有音频轨道，也创建 AudioContext 用于时钟同步
//       const AudioContextClass =
//         // eslint-disable-next-line @typescript-eslint/no-explicit-any
//         window.AudioContext || (window as any).webkitAudioContext;
//       audioContextRef.current = new AudioContextClass();
//     }

//     return () => {
//       if (rafIdRef.current) {
//         cancelAnimationFrame(rafIdRef.current);
//       }
//       videoIteratorRef.current?.return();
//       audioIteratorRef.current?.return();

//       // 清理音频节点
//       queuedAudioNodesRef.current.forEach((node) => node.stop());
//       queuedAudioNodesRef.current.clear();

//       // audioContextRef.current?.close();
//     };
//   }, [videoTrack, audioTrack, options]);

//   // 获取当前播放时间（使用 AudioContext 时钟确保音视频同步）
//   const getPlaybackTime = useCallback(() => {
//     if (isPlaying && audioContextRef.current) {
//       return (
//         audioContextRef.current.currentTime -
//         audioContextStartTimeRef.current! +
//         playbackTimeAtStartRef.current
//       );
//     }
//     return playbackTimeAtStartRef.current;
//   }, [isPlaying]);

//   // 更新音量
//   const updateVolumeInternal = useCallback(() => {
//     if (!gainNodeRef.current) return;

//     const actualVolume = isMuted ? 0 : volume;
//     gainNodeRef.current.gain.value = actualVolume ** 2; // 二次方使控制更精细
//   }, [volume, isMuted]);

//   useEffect(() => {
//     updateVolumeInternal();
//   }, [volume, isMuted, updateVolumeInternal]);

//   // 启动视频迭代器
//   const startVideoIterator = useCallback(async () => {
//     if (!videoSinkRef.current || !canvasRef.current) return;

//     asyncIdRef.current++;
//     const currentAsyncId = asyncIdRef.current;

//     await videoIteratorRef.current?.return();

//     // 从当前播放时间开始迭代
//     videoIteratorRef.current = videoSinkRef.current.canvases(getPlaybackTime());

//     // 获取前两帧
//     const firstFrame = (await videoIteratorRef.current.next()).value ?? null;
//     const secondFrame = (await videoIteratorRef.current.next()).value ?? null;

//     if (currentAsyncId !== asyncIdRef.current) return;

//     nextFrameRef.current = secondFrame;

//     if (firstFrame) {
//       const ctx = canvasRef.current.getContext("2d");
//       if (ctx) {
//         ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
//         ctx.drawImage(firstFrame.canvas, 0, 0);
//       }
//     }
//   }, [getPlaybackTime]);

//   // 更新下一帧（官方的智能预加载逻辑）
//   const updateNextFrame = useCallback(async () => {
//     const currentAsyncId = asyncIdRef.current;

//     while (true) {
//       const newNextFrame =
//         (await videoIteratorRef.current!.next()).value ?? null;
//       if (!newNextFrame || currentAsyncId !== asyncIdRef.current) break;

//       const playbackTime = getPlaybackTime();
//       if (newNextFrame.timestamp <= playbackTime) {
//         // 立即绘制
//         if (canvasRef.current) {
//           const ctx = canvasRef.current.getContext("2d");
//           if (ctx) {
//             ctx.clearRect(
//               0,
//               0,
//               canvasRef.current.width,
//               canvasRef.current.height
//             );
//             ctx.drawImage(newNextFrame.canvas, 0, 0);
//           }
//         }
//       } else {
//         // 保存为下一帧
//         nextFrameRef.current = newNextFrame;
//         break;
//       }
//     }
//   }, [getPlaybackTime]);

//   // 渲染循环（官方使用 requestAnimationFrame）
//   const renderRef = useRef<() => void>(() => {});

//   // 音频播放循环（官方实现）
//   const runAudioIterator = useCallback(async () => {
//     if (!audioSinkRef.current || !audioContextRef.current) return;

//     for await (const { buffer, timestamp } of audioIteratorRef.current!) {
//       const node = audioContextRef.current.createBufferSource();
//       node.buffer = buffer;
//       node.connect(gainNodeRef.current!);

//       const startTimestamp =
//         audioContextStartTimeRef.current! +
//         timestamp -
//         playbackTimeAtStartRef.current;

//       // 音频在未来或过去的处理
//       if (startTimestamp >= audioContextRef.current.currentTime) {
//         node.start(startTimestamp);
//       } else {
//         node.start(
//           audioContextRef.current.currentTime,
//           audioContextRef.current.currentTime - startTimestamp
//         );
//       }

//       queuedAudioNodesRef.current.add(node);
//       node.onended = () => {
//         queuedAudioNodesRef.current.delete(node);
//       };

//       // 防止提前太多（节流）
//       if (timestamp - getPlaybackTime() >= 1) {
//         await new Promise<void>((resolve) => {
//           const id = setInterval(() => {
//             if (timestamp - getPlaybackTime() < 1) {
//               clearInterval(id);
//               resolve();
//             }
//           }, 100);
//         });
//       }
//     }
//   }, [getPlaybackTime]);

//   // 播放
//   const play = useCallback(async () => {
//     if (!duration) return;

//     // 恢复 AudioContext
//     if (audioContextRef.current?.state === "suspended") {
//       await audioContextRef.current.resume();
//     }

//     // 如果在结尾，重置到开始
//     if (getPlaybackTime() >= duration) {
//       playbackTimeAtStartRef.current = 0;
//       await startVideoIterator();
//     }

//     if (audioContextRef.current) {
//       audioContextStartTimeRef.current = audioContextRef.current.currentTime;
//     }

//     setIsPlaying(true);

//     // 启动音频迭代器
//     if (audioSinkRef.current) {
//       await audioIteratorRef.current?.return();
//       audioIteratorRef.current = audioSinkRef.current.buffers(
//         getPlaybackTime()
//       );
//       void runAudioIterator();
//     }

//     // 启动渲染循环
//     if (renderRef.current) {
//       rafIdRef.current = requestAnimationFrame(renderRef.current);
//     }
//   }, [duration, getPlaybackTime, startVideoIterator, runAudioIterator]);

//   // 暂停
//   const pause = useCallback(() => {
//     playbackTimeAtStartRef.current = getPlaybackTime();
//     setIsPlaying(false);

//     // 停止音频迭代器
//     void audioIteratorRef.current?.return();
//     audioIteratorRef.current = null;

//     // 停止所有已排队的音频节点
//     queuedAudioNodesRef.current.forEach((node) => node.stop());
//     queuedAudioNodesRef.current.clear();

//     // 停止渲染循环
//     if (rafIdRef.current) {
//       cancelAnimationFrame(rafIdRef.current);
//       rafIdRef.current = null;
//     }
//   }, [getPlaybackTime]);

//   // Seek
//   const seek = useCallback(
//     async (time: number) => {
//       const newTime = Math.max(0, Math.min(time, duration));
//       const wasPlaying = isPlaying;

//       if (wasPlaying) {
//         pause();
//       }

//       playbackTimeAtStartRef.current = newTime;
//       setCurrentTime(newTime);

//       await startVideoIterator();

//       if (wasPlaying && newTime < duration) {
//         void play();
//       }
//     },
//     [duration, isPlaying, pause, startVideoIterator, play]
//   );

//   // Toggle
//   const toggle = useCallback(() => {
//     if (isPlaying) {
//       pause();
//     } else {
//       void play();
//     }
//   }, [isPlaying, play, pause]);

//   // 设置 canvas 引用（必须在渲染前调用）
//   const setCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
//     canvasRef.current = canvas;
//   }, []);

//   useEffect(() => {
//     const render = () => {
//       if (!canvasRef.current) return;

//       const playbackTime = getPlaybackTime();

//       // 检查是否到达结尾
//       if (playbackTime >= duration && isPlaying) {
//         pause();
//         playbackTimeAtStartRef.current = duration;
//         return;
//       }

//       // 检查是否需要渲染下一帧
//       if (
//         nextFrameRef.current &&
//         nextFrameRef.current.timestamp <= playbackTime
//       ) {
//         const ctx = canvasRef.current.getContext("2d");
//         if (ctx) {
//           ctx.clearRect(
//             0,
//             0,
//             canvasRef.current.width,
//             canvasRef.current.height
//           );
//           ctx.drawImage(nextFrameRef.current.canvas, 0, 0);
//         }
//         nextFrameRef.current = null;
//         void updateNextFrame();
//       }

//       setCurrentTime(playbackTime);

//       if (isPlaying) {
//         rafIdRef.current = requestAnimationFrame(render);
//       }
//     };

//     renderRef.current = render;
//   }, [getPlaybackTime, duration, isPlaying, updateNextFrame, pause]);

//   return {
//     isPlaying,
//     currentTime,
//     duration,
//     volume,
//     isMuted,
//     play,
//     pause,
//     seek,
//     toggle,
//     setVolume,
//     setIsMuted: (muted: boolean) => setIsMuted(muted),
//     toggleMute: () => setIsMuted((m) => !m),
//     setCanvas, // 必须调用此方法设置 canvas
//   };
// };
