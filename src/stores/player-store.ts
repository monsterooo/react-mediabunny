import { makeAutoObservable } from "mobx";
import { enableStaticRendering } from "mobx-react-lite";
import {
  CanvasSink,
  AudioBufferSink,
  Input,
  InputVideoTrack,
  InputAudioTrack,
  type WrappedCanvas,
  type WrappedAudioBuffer,
  ALL_FORMATS,
  BlobSource,
  UrlSource,
} from "mediabunny";

enableStaticRendering(typeof window === "undefined");

interface PlayerErrorState {
  errors: string[];
  warnings: string[];
}

export class MediaPlayerStore {
  // ============ 基础播放器状态 ============
  fileLoaded = false;
  fileName = "";
  totalDuration = 0;

  // ============ 播放状态 ============
  playing = false;
  playbackTimeAtStart = 0;
  audioContextStartTime: number | null = null;

  // ============ 音频上下文 ============
  audioContext: AudioContext | null = null;
  gainNode: GainNode | null = null;

  // ============ 媒体数据 ============
  input: Input | null = null;
  videoTrack: InputVideoTrack | null = null;
  audioTrack: InputAudioTrack | null = null;

  // ============ 媒体 Sink ============
  videoSink: CanvasSink | null = null;
  audioSink: AudioBufferSink | null = null;

  // ============ 迭代器 ============
  videoFrameIterator: AsyncGenerator<WrappedCanvas, void, unknown> | null =
    null;
  audioBufferIterator: AsyncGenerator<
    WrappedAudioBuffer,
    void,
    unknown
  > | null = null;
  nextFrame: WrappedCanvas | null = null;

  // ============ 音频节点管理 ============
  queuedAudioNodes = new Set<AudioBufferSourceNode>();

  // ============ 异步操作 ID ============
  asyncId = 0;

  // ============ 音量控制 ============
  volume = 0.7;
  volumeMuted = false;

  // ============ 视频属性 ============
  videoWidth = 0;
  videoHeight = 0;
  videoCanBeTransparent = false;

  // ============ 音频属性 ============
  audioChannels = 0;
  audioSampleRate = 0;

  // ============ UI 状态 ============
  draggingProgressBar = false;
  draggingVolumeBar = false;
  controlsVisible = true;
  hideControlsTimeout: NodeJS.Timeout | null = null;

  // ============ 错误处理 ============
  errorState: PlayerErrorState = {
    errors: [],
    warnings: [],
  };

  // ============ 请求帧回调 ============
  onRenderFrame?: () => void;

  constructor() {
    makeAutoObservable(this);
    // {
    //   audioContext: false,
    //   gainNode: false,
    //   input: false,
    //   videoSink: false,
    //   audioSink: false,
    //   videoFrameIterator: false,
    //   audioBufferIterator: false,
    //   queuedAudioNodes: false,
    //   hideControlsTimeout: false,
    // }
  }

  // ============ 计算属性 ============
  getPlaybackTime(): number {
    if (
      this.playing &&
      this.audioContext &&
      this.audioContextStartTime !== null
    ) {
      return (
        this.audioContext.currentTime -
        this.audioContextStartTime +
        this.playbackTimeAtStart
      );
    }
    return this.playbackTimeAtStart;
  }

  // ============ 媒体初始化 ============
  async initMediaPlayer(resource: File | string) {
    try {
      await this.cleanup();
      this.reset();

      this.fileName = resource instanceof File ? resource.name : resource;

      // 创建输入源
      const source =
        resource instanceof File
          ? new BlobSource(resource)
          : new UrlSource(resource);

      this.input = new Input({
        source,
        formats: ALL_FORMATS,
      });

      // 计算时长
      this.totalDuration = await this.input.computeDuration();

      // 获取轨道
      let videoTrack = await this.input.getPrimaryVideoTrack();
      let audioTrack = await this.input.getPrimaryAudioTrack();

      // 验证轨道
      const validated = await this.validateTracks(videoTrack, audioTrack);
      videoTrack = validated.videoTrack;
      audioTrack = validated.audioTrack;

      this.videoTrack = videoTrack;
      this.audioTrack = audioTrack;

      // 配置音频上下文
      await this.configureAudioContext(audioTrack?.sampleRate);

      // 设置视频属性
      if (videoTrack) {
        this.videoWidth = videoTrack.displayWidth;
        this.videoHeight = videoTrack.displayHeight;
        this.videoCanBeTransparent = await videoTrack.canBeTransparent();
      }

      // 设置音频属性
      if (audioTrack) {
        this.audioChannels = audioTrack.numberOfChannels;
        this.audioSampleRate = audioTrack.sampleRate;
      }

      // 创建 Sink
      this.videoSink =
        videoTrack &&
        new CanvasSink(videoTrack, {
          poolSize: 2,
          fit: "contain",
          alpha: this.videoCanBeTransparent,
        });

      this.audioSink = audioTrack && new AudioBufferSink(audioTrack);

      this.fileLoaded = true;
      this.clearMessages();
    } catch (error) {
      this.addError(String(error));
      await this.cleanup();
    }
  }

  private async validateTracks(
    videoTrack: InputVideoTrack | null,
    audioTrack: InputAudioTrack | null
  ) {
    let problemMessage = "";

    if (videoTrack) {
      if (videoTrack.codec === null) {
        problemMessage += "Unsupported video codec. ";
        videoTrack = null;
      } else if (!(await videoTrack.canDecode())) {
        problemMessage += "Unable to decode the video track. ";
        videoTrack = null;
      }
    }

    if (audioTrack) {
      if (audioTrack.codec === null) {
        problemMessage += "Unsupported audio codec. ";
        audioTrack = null;
      } else if (!(await audioTrack.canDecode())) {
        problemMessage += "Unable to decode the audio track. ";
        audioTrack = null;
      }
    }

    if (!videoTrack && !audioTrack) {
      if (!problemMessage) {
        problemMessage = "No audio or video track found.";
      }
      throw new Error(problemMessage);
    }

    if (problemMessage) {
      this.addWarning(problemMessage);
    }

    return { videoTrack, audioTrack };
  }

  private async configureAudioContext(sampleRate?: number) {
    const AudioContextClass =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass({ sampleRate });
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
    this.updateVolume();
  }

  // ============ 播放控制 ============
  async play() {
    if (!this.audioContext || !this.fileLoaded) return;

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    // 如果已播放到末尾，从头开始
    if (this.getPlaybackTime() === this.totalDuration) {
      this.playbackTimeAtStart = 0;
      await this.startVideoIterator();
    }

    this.audioContextStartTime = this.audioContext.currentTime;
    this.playing = true;

    // 启动音频迭代
    if (this.audioSink && this.audioTrack) {
      await this.audioBufferIterator?.return?.();
      this.audioBufferIterator = this.audioSink.buffers(this.getPlaybackTime());
      void this.runAudioIterator();
    }
  }

  pause() {
    this.playbackTimeAtStart = this.getPlaybackTime();
    this.playing = false;

    // 停止音频迭代
    void this.audioBufferIterator?.return?.();
    this.audioBufferIterator = null;

    // 停止所有已排队的音频节点
    this.queuedAudioNodes.forEach((node) => {
      try {
        node.stop();
      } catch (e) {
        // 节点可能已停止
        console.log("node.stop error:", e);
      }
    });
    this.queuedAudioNodes.clear();
  }

  togglePlay() {
    if (this.playing) {
      this.pause();
    } else {
      void this.play();
    }
  }

  async seek(time: number) {
    const wasPlaying = this.playing;

    if (wasPlaying) {
      this.pause();
    }

    this.playbackTimeAtStart = Math.max(0, Math.min(time, this.totalDuration));
    await this.startVideoIterator();

    if (wasPlaying && this.playbackTimeAtStart < this.totalDuration) {
      await this.play();
    }
  }

  // ============ 视频渲染 ============
  async startVideoIterator() {
    if (!this.videoSink) return;

    this.asyncId++;
    await this.videoFrameIterator?.return?.();

    this.videoFrameIterator = this.videoSink.canvases(this.getPlaybackTime());

    const firstFrame = (await this.videoFrameIterator.next()).value ?? null;
    const secondFrame = (await this.videoFrameIterator.next()).value ?? null;

    this.nextFrame = secondFrame;

    if (firstFrame) {
      this.onRenderFrame?.();
    }
  }

  async updateNextFrame(
    context: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement
  ) {
    const currentAsyncId = this.asyncId;

    while (true) {
      const newNextFrame =
        (await this.videoFrameIterator?.next?.())?.value ?? null;

      if (!newNextFrame) break;
      if (currentAsyncId !== this.asyncId) break;

      const playbackTime = this.getPlaybackTime();
      if (newNextFrame.timestamp <= playbackTime) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(newNextFrame.canvas, 0, 0);
      } else {
        this.nextFrame = newNextFrame;
        break;
      }
    }
  }

  renderFrame(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    if (!this.fileLoaded) return;

    const playbackTime = this.getPlaybackTime();

    // 检查播放是否结束
    if (playbackTime >= this.totalDuration) {
      this.pause();
      this.playbackTimeAtStart = this.totalDuration;
    }

    // 更新画面
    if (
      this.nextFrame &&
      this.nextFrame.timestamp <= playbackTime &&
      !this.draggingProgressBar
    ) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(this.nextFrame.canvas, 0, 0);
      this.nextFrame = null;
      void this.updateNextFrame(context, canvas);
    }
  }

  private async runAudioIterator() {
    if (!this.audioSink || !this.audioContext || !this.audioBufferIterator)
      return;

    for await (const { buffer, timestamp } of this.audioBufferIterator) {
      if (this.audioContext.state !== "running") break;

      const node = this.audioContext.createBufferSource();
      node.buffer = buffer;
      node.connect(this.gainNode!);

      const startTimestamp =
        this.audioContextStartTime! + timestamp - this.playbackTimeAtStart;

      if (startTimestamp >= this.audioContext.currentTime) {
        node.start(startTimestamp);
      } else {
        node.start(
          this.audioContext.currentTime,
          this.audioContext.currentTime - startTimestamp
        );
      }

      this.queuedAudioNodes.add(node);
      node.onended = () => {
        this.queuedAudioNodes.delete(node);
      };

      // 背压处理
      if (timestamp - this.getPlaybackTime() >= 1) {
        await new Promise<void>((resolve) => {
          const id = setInterval(() => {
            if (timestamp - this.getPlaybackTime() < 1) {
              clearInterval(id);
              resolve();
            }
          }, 100);
        });
      }
    }
  }

  // ============ 音量控制 ============
  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.updateVolume();
  }

  toggleMute() {
    this.volumeMuted = !this.volumeMuted;
    this.updateVolume();
  }

  private updateVolume() {
    const actualVolume = this.volumeMuted ? 0 : this.volume;
    if (this.gainNode) {
      this.gainNode.gain.value = actualVolume ** 2;
    }
  }

  // ============ 控制条 UI ============
  startDraggingProgressBar() {
    this.draggingProgressBar = true;
    this.clearHideControlsTimeout();
  }

  endDraggingProgressBar() {
    this.draggingProgressBar = false;
    this.showControlsTemporarily();
  }

  startDraggingVolumeBar() {
    this.draggingVolumeBar = true;
    this.clearHideControlsTimeout();
  }

  endDraggingVolumeBar() {
    this.draggingVolumeBar = false;
    this.showControlsTemporarily();
  }

  showControls() {
    this.controlsVisible = true;
    this.clearHideControlsTimeout();
  }

  hideControls() {
    this.controlsVisible = false;
  }

  showControlsTemporarily(duration = 2000) {
    this.showControls();
    this.clearHideControlsTimeout();
    this.hideControlsTimeout = setTimeout(() => {
      if (!this.draggingProgressBar && !this.draggingVolumeBar) {
        this.hideControls();
      }
    }, duration);
  }

  private clearHideControlsTimeout() {
    if (this.hideControlsTimeout) {
      clearTimeout(this.hideControlsTimeout);
      this.hideControlsTimeout = null;
    }
  }

  // ============ 错误处理 ============
  addError(error: string) {
    this.errorState.errors.push(error);
  }

  addWarning(warning: string) {
    this.errorState.warnings.push(warning);
  }

  clearMessages() {
    this.errorState.errors = [];
    this.errorState.warnings = [];
  }

  // ============ 生命周期 ============
  async cleanup() {
    this.clearHideControlsTimeout();
    this.pause();
    await this.videoFrameIterator?.return?.();
    await this.audioBufferIterator?.return?.();
    this.asyncId++;
  }

  reset() {
    this.fileLoaded = false;
    this.fileName = "";
    this.totalDuration = 0;
    this.playbackTimeAtStart = 0;
    this.audioContextStartTime = null;
    this.playing = false;
    this.nextFrame = null;
    this.videoTrack = null;
    this.audioTrack = null;
    this.videoWidth = 0;
    this.videoHeight = 0;
    this.videoCanBeTransparent = false;
    this.audioChannels = 0;
    this.audioSampleRate = 0;
    this.clearMessages();
  }

  destroy() {
    void this.cleanup();
    this.audioContext?.close();
    this.audioContext = null;
    this.gainNode = null;
  }
}
