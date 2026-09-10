"use client";

import Image from "next/image";
import { useState } from "react";

export function BookCover({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-card/80 p-2">
        <span className="text-xs text-muted-foreground text-center leading-tight">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className="object-cover group-hover:scale-105 transition-transform duration-300"
      sizes="(min-width: 1024px) 150px, (min-width: 768px) 22vw, (min-width: 640px) 30vw, 45vw"
      onError={() => setFailed(true)}
    />
  );
}
