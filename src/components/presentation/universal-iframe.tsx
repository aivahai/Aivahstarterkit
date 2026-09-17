const YOUTUBE_PATTERN =
  /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export default function UniversalIframe({ url }: { url: string }) {
  if (!url) return null;

  const match = url.match(YOUTUBE_PATTERN);
  const src = match ? `https://www.youtube.com/embed/${match[1]}?autoplay=1` : url;

  return (
    <iframe
      src={src}
      width={1600}
      height={900}
      allow="autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
      style={{ border: "none", backgroundColor: "black" }}
    />
  );
}
