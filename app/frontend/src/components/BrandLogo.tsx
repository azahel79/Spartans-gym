import { useEffect, useRef } from 'react';
import defaultLogo from '../assets/logo-2.png';

interface BrandLogoProps {
  customLogo?: string | null;
  primaryColor: string;
  inkColor: string;
  alt: string;
  className?: string;
}

const hexToRgb = (hex: string) => {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((character) => character + character).join('')
    : normalized;
  const parsed = Number.parseInt(value, 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
};

export function BrandLogo({
  customLogo,
  primaryColor,
  inkColor,
  alt,
  className = '',
}: BrandLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (customLogo) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !context) return;

    const image = new Image();
    image.onload = () => {
      const size = Math.max(image.naturalWidth, image.naturalHeight);
      canvas.width = size;
      canvas.height = size;
      context.clearRect(0, 0, size, size);
      context.drawImage(image, (size - image.naturalWidth) / 2, (size - image.naturalHeight) / 2);

      const pixels = context.getImageData(0, 0, size, size);
      const primary = hexToRgb(primaryColor);
      const ink = hexToRgb(inkColor);

      for (let index = 0; index < pixels.data.length; index += 4) {
        const red = pixels.data[index];
        const green = pixels.data[index + 1];
        const blue = pixels.data[index + 2];
        if (pixels.data[index + 3] < 8) continue;

        const isAccent = red > green * 1.22 && red > blue * 1.18 && red > 45;
        const target = isAccent ? primary : ink;
        const detail = 0.72 + (Math.max(red, green, blue) / 255) * 0.28;
        pixels.data[index] = Math.round(target.r * detail);
        pixels.data[index + 1] = Math.round(target.g * detail);
        pixels.data[index + 2] = Math.round(target.b * detail);
      }

      context.putImageData(pixels, 0, 0);
    };
    image.src = defaultLogo;
  }, [customLogo, inkColor, primaryColor]);

  if (customLogo) return <img src={customLogo} alt={alt} className={className} />;
  return <canvas ref={canvasRef} role="img" aria-label={alt} className={className} />;
}
