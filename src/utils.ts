export const getDomain = (url: string): string => {
  if (!url) return "unknown";
  try {
    return new URL(url).hostname;
  } catch (e) {
    return "unknown";
  }
};

export const getYouTubeId = (url: string): string | null => {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
  return match ? match[1] : null;
};
