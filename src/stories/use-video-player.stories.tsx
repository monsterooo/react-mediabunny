import type { Meta, StoryObj } from "@storybook/react-vite";

import { UseVideoPlayerStory } from "./components/use-video-player-story";

// https://commondatastorage.googleapis.com/gtv-videos-bucket/CastVideos/mp4/BigBuckBunny.mp4
// http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4
// http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4

const meta = {
  title: "hooks/useVideoPlayer",
  component: UseVideoPlayerStory,
  parameters: {
    layout: "centered",
  },
  args: {
    url: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  },
} satisfies Meta<typeof UseVideoPlayerStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {},
};
