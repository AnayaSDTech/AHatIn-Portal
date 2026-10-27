import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/** Image with a soft fade-in and an elegant gradient fallback if the photo can't load (e.g. offline). */
export function SmartImage({ className, alt, src, ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // A cached image can finish loading before React attaches onLoad, so check once mounted.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete) {
      if (img.naturalWidth > 0) setLoaded(true);
      else if (img.currentSrc) setFailed(true);
    }
  }, [src]);

  // Respect absolute/fixed positioning passed in by the caller; otherwise position relatively.
  const positioned = /\b(absolute|fixed)\b/.test(className ?? '');

  return (
    <div className={cn(!positioned && 'relative', 'overflow-hidden bg-gradient-to-br from-navy-700 via-navy-800 to-navy-950', className)}>
      {!failed && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn('h-full w-full object-cover transition-opacity duration-700', loaded ? 'opacity-100' : 'opacity-0')}
          {...rest}
        />
      )}
    </div>
  );
}
