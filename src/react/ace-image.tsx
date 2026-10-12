import type { ImgHTMLAttributes } from "react";

import { imageAttributes } from "../helpers/images";
import type { AceImageOptions } from "../helpers/images";
import type { AceImageData } from "../types/images";

type AceImageProps = AceImageOptions & {
  image: AceImageData;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "sizes" | "width" | "height" | "alt" | "loading">;

/** An image from the CMS as an `<img>` with a web-sized `src`, `srcset`, its size and its alt text. */
export function AceImage({ image, sizes, lazy, ...rest }: AceImageProps) {
  const attributes = imageAttributes(image, { sizes, lazy });
  return <img {...rest} {...attributes} />;
}
