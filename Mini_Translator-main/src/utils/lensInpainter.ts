import { TextSegment } from "../services/geminiService";

interface InpaintOptions {
  featherSize?: number;
}

/**
 * Loads an image from a URL or Base64 data string
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error("Failed to load image: " + e));
    img.src = src;
  });
}

/**
 * Samples the average color of a border area immediately surrounding a bounding box.
 * This is used to reconstruct the backdrop naturally when text is removed.
 */
function sampleAverageBackground(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  borderWidth: number = 4
): string {
  try {
    const imgData = ctx.getImageData(
      Math.max(0, x - borderWidth),
      Math.max(0, y - borderWidth),
      Math.min(ctx.canvas.width, w + borderWidth * 2),
      Math.min(ctx.canvas.height, h + borderWidth * 2)
    );
    const data = imgData.data;

    let rSum = 0, gSum = 0, bSum = 0, count = 0;

    // Sample pixels from the border bounding loop (outer rim of the bounding box)
    for (let py = 0; py < imgData.height; py++) {
      for (let px = 0; px < imgData.width; px++) {
        // Only sample borders (exclude the inner text area)
        const isBorder = 
          py < borderWidth || 
          py >= imgData.height - borderWidth || 
          px < borderWidth || 
          px >= imgData.width - borderWidth;

        if (isBorder) {
          const idx = (py * imgData.width + px) * 4;
          // Guard alpha channel
          if (data[idx + 3] > 10) {
            rSum += data[idx];
            gSum += data[idx + 1];
            bSum += data[idx + 2];
            count++;
          }
        }
      }
    }

    if (count > 0) {
      const r = Math.round(rSum / count);
      const g = Math.round(gSum / count);
      const b = Math.round(bSum / count);
      return `rgb(${r}, ${g}, ${b})`;
    }
  } catch (e) {
    console.warn("Background border sampling failed:", e);
  }
  return "rgba(255, 255, 255, 0.95)";
}

/**
 * Draws wrapped text inside a bounding box and scales down the font size if needed to fit perfectly.
 */
function drawWrappedCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  boxWidth: number,
  boxHeight: number,
  textColor: string,
  fontFamily: string,
  fontWeight: string,
  estimatedFontSize: number
) {
  ctx.save();
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const cleanFont = fontFamily === "monospace" ? "Courier New" : fontFamily === "serif" ? "Georgia" : fontFamily === "cursive" ? "Comic Sans MS" : "Arial";
  const weight = fontWeight === "bold" ? "bold" : "normal";

  // Fit loops: try rendering starting at a custom font size, scaling down until it fits the box
  let fontSize = Math.max(10, Math.min(estimatedFontSize, boxHeight * 0.9));
  let lines: string[] = [];
  let lineHeight = fontSize * 1.25;

  while (fontSize > 6) {
    ctx.font = `${weight} ${fontSize}px ${cleanFont}`;
    const words = text.split(/\s+/);
    lines = [];
    let currentLine = "";

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? currentLine + " " + word : word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > boxWidth * 0.95 && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    lineHeight = fontSize * 1.25;
    const totalHeight = lines.length * lineHeight;

    if (totalHeight <= boxHeight * 0.95) {
      break; // Fits!
    }
    fontSize--; // Reduce font size and try again
  }

  // Draw the text lines centered inside the bounding box
  const totalY = lines.length * lineHeight;
  let startY = -totalY / 2 + lineHeight / 2;

  lines.forEach((line) => {
    // Add text contrast enhancer/outline if high-contrast is useful
    ctx.strokeStyle = textColor === "#FFFFFF" || textColor.toLowerCase() === "white" ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)";
    ctx.lineWidth = Math.max(1.5, fontSize * 0.08);
    ctx.strokeText(line, 0, startY);
    ctx.fillText(line, 0, startY);
    startY += lineHeight;
  });

  ctx.restore();
}

/**
 * Performs local visual layout inpainting and rendering on canvas
 */
export async function renderVisualTranslation(
  imageSrc: string,
  segments: TextSegment[],
  options: InpaintOptions = {}
): Promise<string> {
  const { featherSize = 3 } = options;
  const image = await loadImage(imageSrc);

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Could not acquire 2D context for image composite rendering");
  }

  // 1. Draw original base image
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  // 2. Perform inpainting (text removal + background texture reconstruction)
  segments.forEach((segment) => {
    const { x1, y1, x2, y2 } = segment.boundingBox;

    // Convert scale 0-1000 to actual pixels
    const px = (x1 / 1000) * canvas.width;
    const py = (y1 / 1000) * canvas.height;
    const pw = ((x2 - x1) / 1000) * canvas.width;
    const ph = ((y2 - y1) / 1000) * canvas.height;

    // Sample background or use structural estimate
    let bgColor = segment.backgroundColor || "";
    if (!bgColor || bgColor.toLowerCase() === "transparent" || bgColor === "inherit") {
      bgColor = sampleAverageBackground(ctx, px, py, pw, ph);
    }

    ctx.save();
    
    // Smoothly feather inpaint to integrate nicely without boxy lines
    ctx.shadowColor = bgColor;
    ctx.shadowBlur = featherSize;
    ctx.fillStyle = bgColor;

    // Clean background fill
    ctx.fillRect(px - 1, py - 1, pw + 2, ph + 2);
    ctx.restore();
  });

  // 3. Render modern layout-preserving translated overlays
  segments.forEach((segment) => {
    const { x1, y1, x2, y2 } = segment.boundingBox;

    // Target box conversion in pixels
    const px = (x1 / 1000) * canvas.width;
    const py = (y1 / 1000) * canvas.height;
    const pw = ((x2 - x1) / 1000) * canvas.width;
    const ph = ((y2 - y1) / 1000) * canvas.height;

    const textColor = segment.textColor || "#FFFFFF";
    const fontFamily = segment.fontFamily || "sans-serif";
    const fontWeight = segment.fontWeight || "bold";
    const rotationAngle = segment.rotation || 0;

    // Calculate actual font size estimation based on proportions
    let estimatedSize = 16;
    if (segment.fontSizeEstimation) {
      estimatedSize = (segment.fontSizeEstimation / 1000) * canvas.height;
    } else {
      estimatedSize = ph * 0.75; // Default estimation
    }

    ctx.save();
    
    // Translate origin to middle of the bounding box to handle clean rotations
    ctx.translate(px + pw / 2, py + ph / 2);
    if (rotationAngle !== 0) {
      ctx.rotate((rotationAngle * Math.PI) / 180);
    }

    // Render wrapped text dynamically matching bounds
    drawWrappedCenteredText(
      ctx,
      segment.translation,
      pw,
      ph,
      textColor,
      fontFamily,
      fontWeight,
      estimatedSize
    );

    ctx.restore();
  });

  return canvas.toDataURL("image/png");
}
