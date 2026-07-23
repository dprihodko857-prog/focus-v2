import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { deflateSync } from "node:zlib";

const outputs = [
  ["public/assets/focus-logo.png", 128],
  ["public/assets/focus-logo-v2.png", 128],
  ["public/assets/brand/focus-app-icon-reference.png", 1024],
  ["public/assets/brand/focus-app-icon-reference-v2.png", 1024],
  ["public/assets/icons/apple-touch-icon.png", 180],
  ["public/assets/icons/apple-touch-icon-v2.png", 180],
  ["public/assets/icons/favicon-32.png", 32],
  ["public/assets/icons/favicon-v2-32.png", 32],
  ["public/assets/icons/icon-1024.png", 1024],
  ["public/assets/icons/icon-v2-1024.png", 1024],
  ["public/assets/icons/icon-192.png", 192],
  ["public/assets/icons/icon-v2-192.png", 192],
  ["public/assets/icons/icon-512.png", 512],
  ["public/assets/icons/icon-v2-512.png", 512],
  ["public/assets/icons/maskable-192.png", 192],
  ["public/assets/icons/maskable-v2-192.png", 192],
  ["public/assets/icons/maskable-512.png", 512],
  ["public/assets/icons/maskable-v2-512.png", 512],
];

const colors = {
  background: hex("#0B1119"),
  surfaceTop: hex("#1B222D"),
  surfaceBottom: hex("#111827"),
  border: hex("#374151", 0.5),
  borderLight: hex("#F8FAFC", 0.12),
  orange: hex("#F97316"),
  orangeLight: hex("#FB923C"),
  graphite: hex("#374151"),
  graphiteLight: hex("#5A6472"),
  shadow: hex("#000000", 0.36),
};

const crcTable = new Uint32Array(256).map((_, index) => {
  let c = index;
  for (let k = 0; k < 8; k += 1) {
    c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

for (const [filePath, size] of outputs) {
  mkdirSync(dirname(filePath), { recursive: true });
  const image = renderFocusLogo(size);
  writeFileSync(filePath, encodePng(size, size, image));
}

function renderFocusLogo(size) {
  const scale = size <= 64 ? 5 : size <= 192 ? 4 : 3;
  const width = size * scale;
  const surface = createSurface(width, width);

  paintBackground(surface);
  drawMark(surface);

  return downsample(surface, size, scale);
}

function paintBackground(surface) {
  const size = surface.width;
  const inset = size * 0.045;
  const tile = {
    x: inset,
    y: inset,
    width: size - inset * 2,
    height: size - inset * 2,
    radius: size * 0.19,
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const base = [...colors.background];
      const d = roundedRectDistance(x + 0.5, y + 0.5, tile);

      if (d <= 0) {
        const v = y / Math.max(1, size - 1);
        const u = x / Math.max(1, size - 1);
        const glow = Math.max(0, 1 - distance(u, v, 0.54, 0.38) / 0.68);
        const color = mix(colors.surfaceTop, colors.surfaceBottom, Math.min(1, v * 0.78 + 0.12));
        const warmed = mix(color, colors.orange, glow * 0.045);
        setPixel(surface, x, y, [...warmed.slice(0, 3), 255]);
      } else {
        setPixel(surface, x, y, base);
      }
    }
  }

  drawRoundedRectStroke(surface, tile, size * 0.006, colors.border);
  drawRoundedRectStroke(surface, {
    ...tile,
    x: tile.x + size * 0.012,
    y: tile.y + size * 0.012,
    width: tile.width - size * 0.024,
    height: tile.height - size * 0.024,
    radius: tile.radius * 0.9,
  }, size * 0.003, colors.borderLight);
}

function drawMark(surface) {
  const size = surface.width;
  const cx = size / 2;
  const cy = size / 2;
  const shadowOffset = size * 0.018;

  const outerRadius = size * 0.325;
  const outerStroke = size * 0.045;
  const tickRadius = size * 0.018;
  const tickGapStart = size * 0.115;
  const tickGapEnd = size * 0.235;

  drawArcSet(surface, cx, cy + shadowOffset, outerRadius, outerStroke, colors.shadow);
  drawCapsule(surface, cx - tickGapEnd, cy + shadowOffset, cx - tickGapStart, cy + shadowOffset, tickRadius, colors.shadow);
  drawCapsule(surface, cx + tickGapStart, cy + shadowOffset, cx + tickGapEnd, cy + shadowOffset, tickRadius, colors.shadow);
  drawCapsule(surface, cx, cy - tickGapEnd + shadowOffset, cx, cy - tickGapStart + shadowOffset, tickRadius, colors.shadow);
  drawCapsule(surface, cx, cy + tickGapStart + shadowOffset, cx, cy + tickGapEnd + shadowOffset, tickRadius, colors.shadow);

  drawArcSet(surface, cx, cy, outerRadius, outerStroke, colors.graphite);
  drawArcSet(surface, cx, cy - size * 0.005, outerRadius, outerStroke * 0.28, colors.graphiteLight);

  drawCapsule(surface, cx - tickGapEnd, cy, cx - tickGapStart, cy, tickRadius, colors.orange);
  drawCapsule(surface, cx + tickGapStart, cy, cx + tickGapEnd, cy, tickRadius, colors.orange);
  drawCapsule(surface, cx, cy - tickGapEnd, cx, cy - tickGapStart, tickRadius, colors.orange);
  drawCapsule(surface, cx, cy + tickGapStart, cx, cy + tickGapEnd, tickRadius, colors.orange);

  const phiRadius = size * 0.19;
  const phiStroke = size * 0.06;
  const stemRadius = size * 0.029;
  drawCircleStroke(surface, cx, cy + shadowOffset, phiRadius, phiStroke, colors.shadow);
  drawCapsule(surface, cx, cy - size * 0.25 + shadowOffset, cx, cy + size * 0.25 + shadowOffset, stemRadius, colors.shadow);

  drawCircleStroke(surface, cx, cy, phiRadius, phiStroke, colors.orange);
  drawCircleStroke(surface, cx, cy - size * 0.008, phiRadius, phiStroke * 0.28, colors.orangeLight);
  drawCapsule(surface, cx, cy - size * 0.25, cx, cy + size * 0.25, stemRadius, colors.orange);
  drawCapsule(surface, cx, cy - size * 0.25, cx, cy - size * 0.02, stemRadius * 0.72, colors.orangeLight);

  drawCircle(surface, cx, cy + shadowOffset * 0.65, size * 0.044, colors.shadow);
  drawCircle(surface, cx, cy, size * 0.042, colors.orange);
  drawCircle(surface, cx - size * 0.012, cy - size * 0.012, size * 0.016, colors.orangeLight);
}

function drawArcSet(surface, cx, cy, radius, stroke, color) {
  drawArcStroke(surface, cx, cy, radius, stroke, 199, 258, color);
  drawArcStroke(surface, cx, cy, radius, stroke, 282, 341, color);
  drawArcStroke(surface, cx, cy, radius, stroke, 19, 78, color);
  drawArcStroke(surface, cx, cy, radius, stroke, 102, 161, color);
}

function createSurface(width, height) {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

function setPixel(surface, x, y, color) {
  const index = (y * surface.width + x) * 4;
  surface.data[index] = color[0];
  surface.data[index + 1] = color[1];
  surface.data[index + 2] = color[2];
  surface.data[index + 3] = color[3];
}

function blendPixel(surface, x, y, color) {
  if (x < 0 || y < 0 || x >= surface.width || y >= surface.height) return;
  const index = (y * surface.width + x) * 4;
  const sourceAlpha = color[3] / 255;
  const targetAlpha = surface.data[index + 3] / 255;
  const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
  if (outputAlpha <= 0) return;

  surface.data[index] = Math.round((color[0] * sourceAlpha + surface.data[index] * targetAlpha * (1 - sourceAlpha)) / outputAlpha);
  surface.data[index + 1] = Math.round((color[1] * sourceAlpha + surface.data[index + 1] * targetAlpha * (1 - sourceAlpha)) / outputAlpha);
  surface.data[index + 2] = Math.round((color[2] * sourceAlpha + surface.data[index + 2] * targetAlpha * (1 - sourceAlpha)) / outputAlpha);
  surface.data[index + 3] = Math.round(outputAlpha * 255);
}

function drawCircle(surface, cx, cy, radius, color) {
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(surface.width - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(surface.height - 1, Math.ceil(cy + radius));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (distance(x + 0.5, y + 0.5, cx, cy) <= radius) {
        blendPixel(surface, x, y, color);
      }
    }
  }
}

function drawCircleStroke(surface, cx, cy, radius, stroke, color) {
  const half = stroke / 2;
  const minX = Math.max(0, Math.floor(cx - radius - half));
  const maxX = Math.min(surface.width - 1, Math.ceil(cx + radius + half));
  const minY = Math.max(0, Math.floor(cy - radius - half));
  const maxY = Math.min(surface.height - 1, Math.ceil(cy + radius + half));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const d = Math.abs(distance(x + 0.5, y + 0.5, cx, cy) - radius);
      if (d <= half) {
        blendPixel(surface, x, y, color);
      }
    }
  }
}

function drawArcStroke(surface, cx, cy, radius, stroke, startDeg, endDeg, color) {
  const half = stroke / 2;
  const minX = Math.max(0, Math.floor(cx - radius - half));
  const maxX = Math.min(surface.width - 1, Math.ceil(cx + radius + half));
  const minY = Math.max(0, Math.floor(cy - radius - half));
  const maxY = Math.min(surface.height - 1, Math.ceil(cy + radius + half));
  const start = degToRad(startDeg);
  const end = degToRad(endDeg);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const d = Math.abs(distance(px, py, cx, cy) - radius);
      const angle = normalizeAngle(Math.atan2(py - cy, px - cx));
      if (d <= half && angleBetween(angle, start, end)) {
        blendPixel(surface, x, y, color);
      }
    }
  }
}

function drawCapsule(surface, x1, y1, x2, y2, radius, color) {
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - radius));
  const maxX = Math.min(surface.width - 1, Math.ceil(Math.max(x1, x2) + radius));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - radius));
  const maxY = Math.min(surface.height - 1, Math.ceil(Math.max(y1, y2) + radius));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (pointSegmentDistance(x + 0.5, y + 0.5, x1, y1, x2, y2) <= radius) {
        blendPixel(surface, x, y, color);
      }
    }
  }
}

function drawRoundedRectStroke(surface, rect, stroke, color) {
  const minX = Math.max(0, Math.floor(rect.x - stroke));
  const maxX = Math.min(surface.width - 1, Math.ceil(rect.x + rect.width + stroke));
  const minY = Math.max(0, Math.floor(rect.y - stroke));
  const maxY = Math.min(surface.height - 1, Math.ceil(rect.y + rect.height + stroke));

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const d = Math.abs(roundedRectDistance(x + 0.5, y + 0.5, rect));
      if (d <= stroke / 2) {
        blendPixel(surface, x, y, color);
      }
    }
  }
}

function roundedRectDistance(px, py, rect) {
  const qx = Math.abs(px - (rect.x + rect.width / 2)) - rect.width / 2 + rect.radius;
  const qy = Math.abs(py - (rect.y + rect.height / 2)) - rect.height / 2 + rect.radius;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rect.radius;
}

function pointSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
  return distance(px, py, x1 + t * dx, y1 + t * dy);
}

function downsample(surface, size, scale) {
  const output = new Uint8ClampedArray(size * size * 4);
  const sampleCount = scale * scale;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const totals = [0, 0, 0, 0];

      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const sourceIndex = ((y * scale + sy) * surface.width + (x * scale + sx)) * 4;
          totals[0] += surface.data[sourceIndex];
          totals[1] += surface.data[sourceIndex + 1];
          totals[2] += surface.data[sourceIndex + 2];
          totals[3] += surface.data[sourceIndex + 3];
        }
      }

      const targetIndex = (y * size + x) * 4;
      output[targetIndex] = Math.round(totals[0] / sampleCount);
      output[targetIndex + 1] = Math.round(totals[1] / sampleCount);
      output[targetIndex + 2] = Math.round(totals[2] / sampleCount);
      output[targetIndex + 3] = Math.round(totals[3] / sampleCount);
    }
  }

  return output;
}

function encodePng(width, height, rgba) {
  const rowLength = width * 4 + 1;
  const raw = Buffer.alloc(rowLength * height);

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * rowLength;
    raw[rowOffset] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, rowOffset + 1);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", Buffer.concat([
      uint32(width),
      uint32(height),
      Buffer.from([8, 6, 0, 0, 0]),
    ])),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  return Buffer.concat([
    uint32(data.length),
    typeBuffer,
    data,
    uint32(crc32(Buffer.concat([typeBuffer, data]))),
  ]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function hex(value, alpha = 1) {
  const normalized = value.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
    Math.round(alpha * 255),
  ];
}

function mix(first, second, amount) {
  return [
    Math.round(first[0] + (second[0] - first[0]) * amount),
    Math.round(first[1] + (second[1] - first[1]) * amount),
    Math.round(first[2] + (second[2] - first[2]) * amount),
    Math.round(first[3] + (second[3] - first[3]) * amount),
  ];
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x1 - x2, y1 - y2);
}

function degToRad(degrees) {
  return normalizeAngle(degrees * Math.PI / 180);
}

function normalizeAngle(angle) {
  const full = Math.PI * 2;
  return ((angle % full) + full) % full;
}

function angleBetween(angle, start, end) {
  return start <= end ? angle >= start && angle <= end : angle >= start || angle <= end;
}
