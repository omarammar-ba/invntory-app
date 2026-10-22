import React, { useState } from 'react';
import type { Category } from '@/types';
import { CategorySymbol } from './CategorySymbol';

/** Keep actual item photos; missing or failed photos use a neutral department symbol. */
export default function CategoryPreview({ category, image }: { category: Category; image?: string }) {
  const [failedImage, setFailedImage] = useState<string>();
  const usableImage = image && image !== failedImage;
  return <span className={`category-sample${usableImage ? ' has-image' : ''}`} aria-hidden="true">
    {usableImage ? <img src={image} alt="" loading="lazy" decoding="async" onError={() => setFailedImage(image)} />
      : <span className="category-neutral"><CategorySymbol category={category} size={46} /></span>}
  </span>;
}
