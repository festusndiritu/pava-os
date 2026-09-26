import type { Product } from './products-api';
import { thicknessLabel } from './shape-config';
import { fmtNumber } from './format';

const WIDTH = 1748;
const HEIGHT = 2480;

const PAD = 90;

const HEADER_H = 350;

const TABLE_TOP_GAP = 32;

const FOOTER_H = 275;

const FOOTER_GAP = 28;

const INK = '#171717';
const DARK = '#242424';

const MUTED = '#606060';
const MUTED_LIGHT = '#8B8B8B';

const BORDER = '#A9A9A9';
const BORDER_LIGHT = '#D3D3D3';

const TABLE_HEADER = '#E3E3E3';

const ORANGE = '#D88922';
const ORANGE_LIGHT = '#F1E4D0';

const WHITE = '#FFFFFF';
const PAPER = '#FCFCFC';

const WATERMARK = '#E5E5E5';

const FONT =
  'Arial, Helvetica, sans-serif';

const DEFAULT_EMAIL =
  'pavasteelhardware@gmail.com';

const DEFAULT_PHONE =
  '0793 631 626';

const DEFAULT_EXTRA_PHONE =
  '0716 824 797';

const DEFAULT_ADDRESS =
  'Kamakis, Next to Galana Energies, Opp. 1.7 Lounge';

export interface PosterCategory {
  name: string;

  items: {
    id: string;
    label: string;
    price: number;
  }[];
}

export interface PosterInput {
  businessName: string;
  headline: string;

  phone: string | null;

  extraPhone?: string | null;

  address?: string;

  email?: string;

  note?: string;

  categories: PosterCategory[];
}

export function posterCategoriesFromProducts(
  grouped: [string, Product[]][],
): PosterCategory[] {
  return grouped.map(([name, items]) => ({
    name,

    items: items.map((p) => ({
      id: p.id,

      label: [
        p.displayName ?? p.name,

        [
          p.nominalSize,
          thicknessLabel(
            p.shape,
            p.thicknessMm,
          ),
        ]
          .filter(Boolean)
          .join(' '),
      ]
        .filter(Boolean)
        .join(' — '),

      price: p.basePrice,
    })),
  }));
}

function getAllItems(
  input: PosterInput,
) {
  return input.categories.flatMap(
    (category) => category.items,
  );
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return [];
  }

  const lines: string[] = [];

  let current = '';

  for (const word of words) {
    const candidate = current
      ? `${current} ${word}`
      : word;

    if (
      ctx.measureText(candidate).width <=
      maxWidth
    ) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function truncateToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (
    ctx.measureText(text).width <=
    maxWidth
  ) {
    return text;
  }

  let lo = 0;
  let hi = text.length;

  while (lo < hi) {
    const mid = Math.ceil(
      (lo + hi) / 2,
    );

    const candidate =
      `${text.slice(0, mid)}…`;

    if (
      ctx.measureText(candidate).width <=
      maxWidth
    ) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  return `${text.slice(0, lo)}…`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(
    radius,
    width / 2,
    height / 2,
  );

  ctx.beginPath();

  ctx.moveTo(
    x + r,
    y,
  );

  ctx.arcTo(
    x + width,
    y,
    x + width,
    y + height,
    r,
  );

  ctx.arcTo(
    x + width,
    y + height,
    x,
    y + height,
    r,
  );

  ctx.arcTo(
    x,
    y + height,
    x,
    y,
    r,
  );

  ctx.arcTo(
    x,
    y,
    x + width,
    y,
    r,
  );

  ctx.closePath();
}

let logoPromise:
  Promise<HTMLImageElement | null> | null = null;

function loadLogo(): Promise<HTMLImageElement | null> {
  if (!logoPromise) {
    logoPromise = new Promise(
      (resolve) => {
        const img = new Image();

        img.onload = () => {
          resolve(img);
        };

        img.onerror = () => {
          console.warn(
            'Pava logo could not be loaded. ' +
              'Make sure public/pava-logo.png exists.',
          );

          resolve(null);
        };

        img.src = '/pava-logo.png';
      },
    );
  }

  return logoPromise;
}

function drawHeaderDecoration(
  ctx: CanvasRenderingContext2D,
) {

  ctx.fillStyle = ORANGE;

  ctx.beginPath();

  ctx.moveTo(
    WIDTH - 270,
    0,
  );

  ctx.lineTo(
    WIDTH,
    0,
  );

  ctx.lineTo(
    WIDTH,
    115,
  );

  ctx.closePath();

  ctx.fill();

  ctx.fillStyle = DARK;

  ctx.beginPath();

  ctx.moveTo(
    WIDTH - 560,
    0,
  );

  ctx.lineTo(
    WIDTH - 270,
    0,
  );

  ctx.lineTo(
    WIDTH,
    115,
  );

  ctx.lineTo(
    WIDTH - 105,
    75,
  );

  ctx.closePath();

  ctx.fill();

  ctx.fillStyle = ORANGE;

  ctx.fillRect(
    PAD,
    HEADER_H - 12,
    105,
    6,
  );
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
) {
  ctx.save();

  ctx.globalAlpha = 0.5;

  ctx.strokeStyle = WATERMARK;
  ctx.lineWidth = 30;

  ctx.beginPath();

  ctx.arc(
    WIDTH + 15,
    1000,
    220,
    0,
    Math.PI * 2,
  );

  ctx.stroke();

  ctx.globalAlpha = 0.38;

  ctx.fillStyle = ORANGE_LIGHT;

  ctx.beginPath();

  ctx.moveTo(
    WIDTH - 10,
    900,
  );

  ctx.lineTo(
    WIDTH + 30,
    840,
  );

  ctx.lineTo(
    WIDTH + 30,
    1200,
  );

  ctx.lineTo(
    WIDTH - 10,
    1260,
  );

  ctx.closePath();

  ctx.fill();

  ctx.globalAlpha = 0.3;

  ctx.fillStyle = WATERMARK;

  ctx.beginPath();

  ctx.moveTo(
    WIDTH - 160,
    HEIGHT - 750,
  );

  ctx.lineTo(
    WIDTH + 30,
    HEIGHT - 950,
  );

  ctx.lineTo(
    WIDTH + 30,
    HEIGHT - 580,
  );

  ctx.lineTo(
    WIDTH - 160,
    HEIGHT - 380,
  );

  ctx.closePath();

  ctx.fill();

  ctx.globalAlpha = 0.18;

  ctx.strokeStyle = ORANGE;
  ctx.lineWidth = 18;

  ctx.beginPath();

  ctx.arc(
    -80,
    1550,
    130,
    0,
    Math.PI * 2,
  );

  ctx.stroke();

  ctx.restore();
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  input: PosterInput,
  logo: HTMLImageElement | null,
) {

  ctx.fillStyle = WHITE;

  ctx.fillRect(
    0,
    0,
    WIDTH,
    HEADER_H,
  );

  drawHeaderDecoration(ctx);

  const logoX = PAD;
  const logoY = 65;

  const logoW = 125;
  const logoH = 125;

  if (logo) {

    ctx.fillStyle = WHITE;

    ctx.fillRect(
      logoX,
      logoY,
      logoW,
      logoH,
    );

    const scale = Math.min(
      logoW / logo.width,
      logoH / logo.height,
    );

    const drawW =
      logo.width * scale;

    const drawH =
      logo.height * scale;

    const drawX =
      logoX +
      (logoW - drawW) / 2;

    const drawY =
      logoY +
      (logoH - drawH) / 2;

    ctx.drawImage(
      logo,
      drawX,
      drawY,
      drawW,
      drawH,
    );
  }

  const businessX =
    logoX + logoW + 28;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = INK;

  ctx.font =
    `900 46px ${FONT}`;

  const businessName =
    truncateToWidth(
      ctx,
      input.businessName.toUpperCase(),
      630,
    );

  ctx.fillText(
    businessName,
    businessX,
    103,
  );

  if (input.headline) {
    ctx.fillStyle = MUTED;

    ctx.font =
      `700 30px ${FONT}`;

    ctx.fillText(
      truncateToWidth(
        ctx,
        input.headline.toUpperCase(),
        630,
      ),
      businessX,
      140,
    );
  }

  const contactX = 1110;

  const primaryPhone =
    input.phone ??
    DEFAULT_PHONE;

  const extraPhone =
    input.extraPhone ??
    DEFAULT_EXTRA_PHONE;

  ctx.fillStyle = INK;

  ctx.font =
    `700 34px ${FONT}`;

  ctx.fillText(
    `${primaryPhone} / ${extraPhone}`,
    contactX,
    78,
  );

  const address =
    input.address ??
    DEFAULT_ADDRESS;

  ctx.fillStyle = MUTED;

  ctx.font =
    `500 26px ${FONT}`;

  const addressLines =
    wrapText(
      ctx,
      address,
      490,
    );

  addressLines
    .slice(0, 2)
    .forEach(
      (line, index) => {
        ctx.fillText(
          line,
          contactX,
          116 +
            index * 29,
        );
      },
    );

  const email =
    input.email ??
    DEFAULT_EMAIL;

  ctx.fillStyle = INK;

  ctx.font =
    `600 24px ${FONT}`;

  ctx.fillText(
    email,
    contactX,
    182,
  );

  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 2;

  ctx.beginPath();

  ctx.moveTo(
    PAD,
    HEADER_H - 1,
  );

  ctx.lineTo(
    WIDTH - PAD,
    HEADER_H - 1,
  );

  ctx.stroke();
}

interface TableDensity {
  rowHeight: number;
  fontSize: number;
  numberSize: number;
  priceSize: number;
  headerSize: number;
}

function getTableDensity(
  itemCount: number,
  availableHeight: number,
): TableDensity {
  const tableHeaderHeight = 70;

  const rowsAvailable =
    Math.max(
      1,
      availableHeight -
        tableHeaderHeight,
    );

  const calculatedRowHeight =
    Math.floor(
      rowsAvailable /
        Math.max(itemCount, 1),
    );

  if (
    itemCount <= 16 &&
    calculatedRowHeight >= 72
  ) {
    return {
      rowHeight: 82,
      fontSize: 29,
      numberSize: 25,
      priceSize: 27,
      headerSize: 24,
    };
  }

  if (
    itemCount <= 22 &&
    calculatedRowHeight >= 60
  ) {
    return {
      rowHeight: 68,
      fontSize: 25,
      numberSize: 22,
      priceSize: 24,
      headerSize: 22,
    };
  }

  if (
    itemCount <= 30 &&
    calculatedRowHeight >= 48
  ) {
    return {
      rowHeight: 55,
      fontSize: 21,
      numberSize: 19,
      priceSize: 20,
      headerSize: 19,
    };
  }

  return {
    rowHeight: Math.max(
      40,
      Math.min(
        50,
        calculatedRowHeight,
      ),
    ),
    fontSize: 18,
    numberSize: 17,
    priceSize: 18,
    headerSize: 18,
  };
}

function drawTable(
  ctx: CanvasRenderingContext2D,
  input: PosterInput,
  tableY: number,
): {
  height: number;
  rowHeight: number;
} {
  const items =
    getAllItems(input);

  const tableX = PAD;

  const tableW =
    WIDTH - PAD * 2;

  const footerY =
    HEIGHT - FOOTER_H;

  const availableHeight =
    footerY -
    tableY -
    FOOTER_GAP;

  const numberW = 125;

  const priceW = 310;

  const descriptionW =
    tableW -
    numberW -
    priceW;

  const density =
    getTableDensity(
      items.length,
      availableHeight,
    );

  const tableHeaderH = 70;

  const rowH =
    density.rowHeight;

  const tableH =
    tableHeaderH +
    items.length * rowH;

  ctx.fillStyle = WHITE;

  roundRect(
    ctx,
    tableX,
    tableY,
    tableW,
    tableH,
    14,
  );

  ctx.fill();

  ctx.save();

  roundRect(
    ctx,
    tableX,
    tableY,
    tableW,
    tableH,
    14,
  );

  ctx.clip();

  ctx.fillStyle =
    TABLE_HEADER;

  ctx.fillRect(
    tableX,
    tableY,
    tableW,
    tableHeaderH,
  );

  ctx.restore();

  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1.5;

  roundRect(
    ctx,
    tableX,
    tableY,
    tableW,
    tableH,
    14,
  );

  ctx.stroke();

  const numberEnd =
    tableX + numberW;

  const descriptionEnd =
    numberEnd + descriptionW;

  ctx.beginPath();

  ctx.moveTo(
    numberEnd,
    tableY,
  );

  ctx.lineTo(
    numberEnd,
    tableY + tableH,
  );

  ctx.moveTo(
    descriptionEnd,
    tableY,
  );

  ctx.lineTo(
    descriptionEnd,
    tableY + tableH,
  );

  ctx.stroke();

  ctx.beginPath();

  ctx.moveTo(
    tableX,
    tableY + tableHeaderH,
  );

  ctx.lineTo(
    tableX + tableW,
    tableY + tableHeaderH,
  );

  ctx.stroke();

  ctx.fillStyle = INK;

  ctx.font =
    `800 ${density.headerSize}px ${FONT}`;

  ctx.textBaseline = 'middle';

  ctx.textAlign = 'center';

  ctx.fillText(
    'No.',
    tableX +
      numberW / 2,
    tableY +
      tableHeaderH / 2,
  );

  ctx.textAlign = 'left';

  ctx.fillText(
    'Item / Description',
    numberEnd + 28,
    tableY +
      tableHeaderH / 2,
  );

  ctx.textAlign = 'center';

  ctx.fillText(
    'Price',
    descriptionEnd +
      priceW / 2,
    tableY +
      tableHeaderH / 2,
  );

  items.forEach(
    (item, index) => {
      const rowY =
        tableY +
        tableHeaderH +
        index * rowH;

      if (index > 0) {
        ctx.strokeStyle =
          BORDER_LIGHT;

        ctx.lineWidth = 1;

        ctx.beginPath();

        ctx.moveTo(
          tableX,
          rowY,
        );

        ctx.lineTo(
          tableX + tableW,
          rowY,
        );

        ctx.stroke();
      }

      ctx.fillStyle = INK;

      ctx.font =
        `500 ${density.numberSize}px ${FONT}`;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.fillText(
        `${index + 1}.`,
        tableX +
          numberW / 2,
        rowY +
          rowH / 2,
      );

      ctx.fillStyle = INK;

      ctx.font =
        `600 ${density.fontSize}px ${FONT}`;

      ctx.textAlign = 'left';

      const label =
        truncateToWidth(
          ctx,
          item.label,
          descriptionW - 52,
        );

      ctx.fillText(
        label,
        numberEnd + 26,
        rowY +
          rowH / 2,
      );

      ctx.fillStyle = INK;

      ctx.font =
        `700 ${density.priceSize}px ${FONT}`;

      ctx.textAlign = 'center';

      ctx.fillText(
        `KSh ${fmtNumber(item.price)}`,
        descriptionEnd +
          priceW / 2,
        rowY +
          rowH / 2,
      );
    },
  );

  ctx.textAlign = 'left';

  return {
    height: tableH,
    rowHeight: rowH,
  };
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  input: PosterInput,
  footerY: number,
) {

  ctx.fillStyle = WHITE;

  ctx.fillRect(
    0,
    footerY,
    WIDTH,
    FOOTER_H,
  );

  ctx.fillStyle = ORANGE;

  ctx.fillRect(
    PAD,
    footerY,
    110,
    6,
  );

  const note =
    input.note ??
    'All sizes & gauges of tubes (SHS), RHS, furniture pipes, black pipes, MS plates, flat bars, angle bars, Zed & T-bars, cutting and grinding discs, welding rods and other related items available.';

  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = INK;

  ctx.font =
    `800 25px ${FONT}`;

  ctx.textAlign = 'left';

  ctx.fillText(
    'NOTE:',
    PAD,
    footerY + 42,
  );

  ctx.fillStyle = MUTED;

  ctx.font =
    `400 23px ${FONT}`;

  const noteX =
    PAD + 62;

  const noteWidth =
    WIDTH -
    PAD * 2 -
    62;

  const noteLines =
    wrapText(
      ctx,
      note,
      noteWidth,
    );

  noteLines
    .slice(0, 3)
    .forEach(
      (line, index) => {
        ctx.fillText(
          line,
          noteX,
          footerY +
            42 +
            index * 30,
        );
      },
    );

  const contactY =
    footerY + 135;

  ctx.strokeStyle =
    BORDER_LIGHT;

  ctx.lineWidth = 1;

  ctx.beginPath();

  ctx.moveTo(
    PAD,
    contactY - 24,
  );

  ctx.lineTo(
    WIDTH - PAD,
    contactY - 24,
  );

  ctx.stroke();

  ctx.beginPath();

  ctx.moveTo(
    570,
    contactY - 8,
  );

  ctx.lineTo(
    570,
    footerY +
      FOOTER_H -
      25,
  );

  ctx.moveTo(
    1160,
    contactY - 8,
  );

  ctx.lineTo(
    1160,
    footerY +
      FOOTER_H -
      25,
  );

  ctx.stroke();

  drawFooterContact(
    ctx,
    {
      x: PAD,
      y: contactY,
      label: 'ADDRESS',
      value:
        input.address ??
        DEFAULT_ADDRESS,
      width: 440,
      icon: '●',
    },
  );

  const phone =
    input.phone ??
    DEFAULT_PHONE;

  const extraPhone =
    input.extraPhone ??
    DEFAULT_EXTRA_PHONE;

  drawFooterContact(
    ctx,
    {
      x: 630,
      y: contactY,
      label: 'CONTACT',
      value:
        `${phone} / ${extraPhone}`,
      width: 470,
      icon: '☎',
    },
  );

  drawFooterContact(
    ctx,
    {
      x: 1220,
      y: contactY,
      label: 'EMAIL',
      value:
        input.email ??
        DEFAULT_EMAIL,
      width: 400,
      icon: '✉',
    },
  );

  ctx.fillStyle = ORANGE;

  ctx.beginPath();

  ctx.moveTo(
    WIDTH - 160,
    HEIGHT,
  );

  ctx.lineTo(
    WIDTH,
    HEIGHT,
  );

  ctx.lineTo(
    WIDTH,
    HEIGHT - 58,
  );

  ctx.closePath();

  ctx.fill();
}

function drawFooterContact(
  ctx: CanvasRenderingContext2D,
  options: {
    x: number;
    y: number;
    label: string;
    value: string;
    width: number;
    icon: string;
  },
) {
  const {
    x,
    y,
    label,
    value,
    width,
    icon,
  } = options;

  ctx.fillStyle = ORANGE;

  ctx.font =
    `700 25px ${FONT}`;

  ctx.textAlign = 'left';

  ctx.fillText(
    icon,
    x,
    y,
  );

  ctx.fillStyle = INK;

  ctx.font =
    `800 20px ${FONT}`;

  ctx.fillText(
    label,
    x + 32,
    y - 3,
  );

  ctx.fillStyle = MUTED;

  ctx.font =
    `400 20px ${FONT}`;

  const lines =
    wrapText(
      ctx,
      value,
      width - 32,
    );

  lines
    .slice(0, 2)
    .forEach(
      (line, index) => {
        ctx.fillText(
          line,
          x + 32,
          y + 20 +
            index * 25,
        );
      },
    );
}

export function posterHeight(
  _input: PosterInput,
): number {

  return HEIGHT;
}

export async function drawPoster(
  canvas: HTMLCanvasElement,
  input: PosterInput,
): Promise<void> {

  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const ctx =
    canvas.getContext('2d');

  if (!ctx) {
    return;
  }

  ctx.imageSmoothingEnabled = true;

  ctx.imageSmoothingQuality =
    'high';

  ctx.fillStyle = PAPER;

  ctx.fillRect(
    0,
    0,
    WIDTH,
    HEIGHT,
  );

  drawWatermark(ctx);

  const logo =
    await loadLogo();

  drawHeader(
    ctx,
    input,
    logo,
  );

  const tableY =
    HEADER_H +
    TABLE_TOP_GAP;

  const table =
    drawTable(
      ctx,
      input,
      tableY,
    );

  const footerY =
    HEIGHT - FOOTER_H;

  if (
    tableY + table.height >
    footerY - FOOTER_GAP
  ) {
    console.warn(
      'Pava poster: product table is very dense and may require a smaller font.',
    );
  }

  drawFooter(
    ctx,
    input,
    footerY,
  );
}

export function posterToBlob(
  canvas: HTMLCanvasElement,
): Promise<Blob | null> {
  return new Promise(
    (resolve) => {
      canvas.toBlob(
        (blob) => {
          resolve(blob);
        },
        'image/png',
        0.95,
      );
    },
  );
}
