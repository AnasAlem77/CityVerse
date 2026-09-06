"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import MediaFallback from "@/components/MediaFallback/MediaFallback";

export type GalleryImage = {
  id: string;
  url?: string;
  imageUrl?: string;
  source?: string | null;
  sourceUrl?: string | null;
  license?: string | null;
  author?: string | null;
  attribution?: string | null;
};

export default function PlaceGallery({ images, placeName }: { images: GalleryImage[]; placeName: string }) {
  const usableImages = useMemo(
    () => images.filter((image) => Boolean(image.url ?? image.imageUrl)),
    [images],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [brokenIds, setBrokenIds] = useState<string[]>([]);
  const visibleImages = usableImages.filter((image) => !brokenIds.includes(image.id));
  const activeImage = visibleImages[Math.min(activeIndex, Math.max(visibleImages.length - 1, 0))];
  const activeUrl = activeImage?.url ?? activeImage?.imageUrl;
  const hasMultiple = visibleImages.length > 1;

  function markBroken(id: string) {
    setBrokenIds((current) => (current.includes(id) ? current : [...current, id]));
    setActiveIndex(0);
  }

  function move(offset: number) {
    setActiveIndex((current) => (current + offset + visibleImages.length) % visibleImages.length);
  }

  if (!activeImage || !activeUrl) return <MediaFallback label={`${placeName} image unavailable`} />;

  return (
    <div className="relative h-full w-full">
      <img
        src={activeUrl}
        alt={`${placeName} photo`}
        className="h-full w-full object-cover"
        onError={() => markBroken(activeImage.id)}
      />

      {hasMultiple && (
        <>
          <button type="button" aria-label="Previous image" onClick={() => move(-1)} className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80">
            <ChevronLeft size={20} />
          </button>
          <button type="button" aria-label="Next image" onClick={() => move(1)} className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80">
            <ChevronRight size={20} />
          </button>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/55 px-3 py-2 backdrop-blur">
            {visibleImages.map((image, index) => (
              <button key={image.id} type="button" aria-label={`Show image ${index + 1}`} aria-current={index === activeIndex} onClick={() => setActiveIndex(index)} className={`h-2 w-2 rounded-full ${index === activeIndex ? "bg-white" : "bg-white/45"}`} />
            ))}
          </div>
        </>
      )}

      {(activeImage.source || activeImage.author || activeImage.license || activeImage.attribution || activeImage.sourceUrl) && (
        <div className="absolute bottom-4 right-4 max-w-[75%] rounded-xl bg-black/60 px-3 py-2 text-right text-xs leading-5 text-white backdrop-blur">
          <span>{activeImage.attribution || activeImage.author || activeImage.source}</span>
          {activeImage.license && <span> · {activeImage.license}</span>}
          {activeImage.sourceUrl && (
            <a href={activeImage.sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 underline underline-offset-2">
              Source <ExternalLink size={11} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
