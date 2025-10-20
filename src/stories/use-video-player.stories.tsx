import type { Meta, StoryObj } from "@storybook/react-vite";
import { BasicPlayer } from "./components/basic-player";

// https://commondatastorage.googleapis.com/gtv-videos-bucket/CastVideos/mp4/BigBuckBunny.mp4
// http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4
// http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4

const meta = {
  title: "hooks/BasicPlayer",
  component: BasicPlayer,
  parameters: {
    layout: "centered",
  },
  args: {
    url: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  },
} satisfies Meta<typeof BasicPlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {},
};
