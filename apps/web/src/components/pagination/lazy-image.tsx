'use client';

import React, { useState, forwardRef } from 'react';
import { useLazyLoad } from '@/lib/pagination/infinite-scroll';
import { cn } from '@/lib/utils';
import { ImageIcon, AlertCircle } from 'lucide-react';

export interface LazyImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'onLoad' | 'onError'> {
  src: string;
  alt: string;
  placeholder?: React.ReactNode;
  errorFallback?: React.ReactNode;
  rootMargin?: string;
  threshold?: number;
  triggerOnce?: boolean;
  wrapperClassName?: string;
  wrapperStyle?: React.CSSProperties;
  onLoad?: () => void;
  onError?: () => void;
  showLoadingSpinner?: boolean;
}

export const LazyImage = forwardRef<HTMLImageElement, LazyImageProps>(
  ({
    src,
    alt,
    placeholder,
    errorFallback,
    rootMargin = '50px',
    threshold = 0.1,
    triggerOnce = true,
    wrapperClassName,
    wrapperStyle,
    onLoad: onLoadProp,
    onError: onErrorProp,
    showLoadingSpinner = true,
    className,
    style,
    ...props
  }, ref) => {
    const [imageLoaded, setImageLoaded] = useState(false);

    const {
      elementRef,
      isVisible,
      hasLoaded,
      hasError,
      onLoad,
      onError,
      shouldLoad
    } = useLazyLoad({
      rootMargin,
      threshold,
      triggerOnce
    });

    const handleLoad = () => {
      setImageLoaded(true);
      onLoad();
      onLoadProp?.();
    };

    const handleError = () => {
      onError();
      onErrorProp?.();
    };

    const defaultPlaceholder = (
      <div className="flex items-center justify-center bg-muted text-muted-foreground">
        <ImageIcon className="h-8 w-8" />
      </div>
    );

    const defaultErrorFallback = (
      <div className="flex items-center justify-center bg-muted text-muted-foreground">
        <AlertCircle className="h-8 w-8" />
      </div>
    );

    const loadingSpinner = showLoadingSpinner && shouldLoad && !hasLoaded && !hasError && (
      <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );

    return (
      <div
        ref={elementRef}
        className={cn('relative overflow-hidden', wrapperClassName)}
        style={wrapperStyle}
      >
        {/* Placeholder */}
        {!shouldLoad && (placeholder || defaultPlaceholder)}

        {/* Error fallback */}
        {hasError && (errorFallback || defaultErrorFallback)}

        {/* Loading spinner */}
        {loadingSpinner}

        {/* Actual image */}
        {shouldLoad && !hasError && (
          <img
            ref={ref}
            src={src}
            alt={alt}
            onLoad={handleLoad}
            onError={handleError}
            className={cn(
              'transition-opacity duration-300',
              imageLoaded ? 'opacity-100' : 'opacity-0',
              className
            )}
            style={style}
            {...props}
          />
        )}
      </div>
    );
  }
);

LazyImage.displayName = 'LazyImage';

export default LazyImage;