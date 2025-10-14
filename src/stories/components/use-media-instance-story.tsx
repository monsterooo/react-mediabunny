import { useState } from "react";
import { useMediaInstance } from "../../hooks/use-media-instance";

export function UseMediaInstanceStory() {
  const mediaInstance = useMediaInstance();
  const [url, setUrl] = useState(
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/CastVideos/mp4/BigBuckBunny.mp4"
  );

  return (
    <div>
      <div style={{ display: "flex", gap: "10px" }}>
        <textarea
          cols={40}
          rows={4}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button onClick={() => mediaInstance.loadFromUrl(url)}>
          {mediaInstance.isLoading ? "Loading..." : "Load from URL"}
        </button>
        <button
          onClick={() => {
            const fileInput = document.getElementById(
              "file"
            ) as HTMLInputElement;
            fileInput.click();
          }}
        >
          {mediaInstance.isLoading ? "Loading..." : "Load from File"}
        </button>
        <input
          type="file"
          id="file"
          style={{ display: "none" }}
          onChange={(e) => {
            mediaInstance.loadFile(e.target.files?.[0] as File);
          }}
        />
      </div>
      <ul>
        <li>Id: {mediaInstance.id}</li>
        <li>Duration(s): {mediaInstance.duration}</li>
        <li>Format: {mediaInstance.format?.mimeType}</li>
      </ul>
      {mediaInstance.error && (
        <div style={{ color: "red" }}>{mediaInstance.error.message}</div>
      )}
    </div>
  );
}
