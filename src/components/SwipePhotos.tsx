import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";

/**
 * Swipeable photo strip for product cards: shoppers flick through every photo
 * without opening the product. Dots show the position; mouse users get arrows on hover.
 */
export function SwipePhotos({ photos, alt, className = "" }: { photos: string[]; alt: string; className?: string }) {
  const slider = useRef<HTMLDivElement>(null);
  const [slide, setSlide] = useState(0);
  const onScroll = () => {
    const el = slider.current;
    if (el && el.clientWidth) setSlide(Math.round(el.scrollLeft / el.clientWidth));
  };
  const goTo = (e: React.MouseEvent, i: number) => {
    e.preventDefault(); e.stopPropagation();
    const el = slider.current;
    if (el) el.scrollTo({ left: Math.max(0, Math.min(photos.length - 1, i)) * el.clientWidth, behavior: "smooth" });
  };
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div ref={slider} onScroll={onScroll} aria-label={`${alt} photos`}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {photos.map((src, i) => (
          <img key={src} src={src} alt={i === 0 ? alt : `${alt} photo ${i + 1}`} loading="lazy" draggable={false} width={768} height={768}
            className="h-full w-full shrink-0 snap-center object-cover" />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-1.5 flex justify-center gap-1">
        {photos.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === slide ? "w-3 bg-foreground/80" : "w-1.5 bg-foreground/30"}`} />)}
      </div>
      {slide > 0 && (
        <button type="button" aria-label="Previous photo" onClick={e => goTo(e, slide - 1)}
          className="absolute left-1.5 top-1/2 hidden h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-card/90 shadow-pop pointer-fine:group-hover:grid">
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {slide < photos.length - 1 && (
        <button type="button" aria-label="Next photo" onClick={e => goTo(e, slide + 1)}
          className="absolute right-1.5 top-1/2 hidden h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-card/90 shadow-pop pointer-fine:group-hover:grid">
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
