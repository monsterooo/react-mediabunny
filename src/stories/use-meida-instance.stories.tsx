import type { Meta, StoryObj } from "@storybook/react-vite";

import { UseMediaInstanceStory } from "./components/use-media-instance-story";

const meta = {
  title: "hooks/useMediaInstance",
  component: UseMediaInstanceStory,
  parameters: {
    layout: "centered",
  },
  args: {
    id: "video-1",
  },
} satisfies Meta<typeof UseMediaInstanceStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {},
};
