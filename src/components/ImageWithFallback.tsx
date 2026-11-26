import { useState, type ImgHTMLAttributes } from 'react'

const FALLBACK_IMAGE = `${import.meta.env.BASE_URL}images/garment-fallback.svg`

type ImageWithFallbackProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | null
}

export default function ImageWithFallback({ src, ...props }: ImageWithFallbackProps) {
  const imageSrc = src || FALLBACK_IMAGE
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const displayedSrc = failedSource === imageSrc ? FALLBACK_IMAGE : imageSrc

  return <img {...props} src={displayedSrc} onError={() => setFailedSource(imageSrc)} />
}
