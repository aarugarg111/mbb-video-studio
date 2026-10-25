/* What a shop has on its shelves, which depends on what the shop sells.
 *
 * There used to be one shelf: a kirana store's. A cosmetics shop's Items page
 * listed the facewash the script asked for and then ARHAR DAL GOLD 1KG, BESAN
 * 1KG and CHANA DAL - Aryan caught it. A recipe's own items are only ever two
 * or three, and the rest of the page is filler standing in for a real
 * catalogue, so the filler has to be the same trade or the page is a different
 * shop below the third row.
 *
 * None of these are a real shop's stock list. The brands are the ones any
 * counter in the country carries; the rates are plausible and invented.
 */

/* Each shelf is long enough to scroll past the bottom of a phone, which is
 * the point of being able to scroll it at all. */
export const SHELVES = {
  kirana: [
    { name: 'AMUL RUSK FAMILY PACK', rate: 180, purchase: 120, stock: 99 },
    { name: 'ANJEER PREMIUM 500GM', rate: 1200, purchase: 950, stock: 99 },
    { name: 'ARHAR DAL GOLD 1KG', rate: 180, purchase: 140, stock: 95 },
    { name: 'BESAN 1KG', rate: 110, purchase: 94, stock: 91 },
    { name: 'BOURNVITA 500GM', rate: 245, purchase: 212, stock: 36 },
    { name: 'BRITANNIA MARIE GOLD', rate: 40, purchase: 33, stock: 120 },
    { name: 'CHANA DAL 1KG', rate: 95, purchase: 78, stock: 64 },
    { name: 'COLGATE STRONG TEETH 200G', rate: 115, purchase: 96, stock: 48 },
    { name: 'FORTUNE SUNFLOWER OIL 1L', rate: 165, purchase: 142, stock: 72 },
    { name: 'TATA SALT 1KG', rate: 28, purchase: 24, stock: 140 }
  ],

  cosmetics: [
    { name: 'BELLA VITA PERFUME SET', rate: 650, purchase: 250, stock: 199 },
    { name: 'COMPACT POWDER', rate: 240, purchase: 165, stock: 44 },
    { name: 'FACE CREAM 50GM', rate: 210, purchase: 148, stock: 60 },
    { name: 'HAIR SERUM 100ML', rate: 395, purchase: 280, stock: 32 },
    { name: 'KAJAL STICK', rate: 95, purchase: 58, stock: 120 },
    { name: 'LIPSTICK MATTE', rate: 280, purchase: 190, stock: 75 },
    { name: 'NAIL PAINT REMOVER', rate: 85, purchase: 52, stock: 88 },
    { name: 'SHAMPOO 340ML', rate: 310, purchase: 236, stock: 54 },
    { name: 'SUNSCREEN SPF 50', rate: 480, purchase: 345, stock: 28 },
    { name: 'TALC POWDER 300GM', rate: 165, purchase: 118, stock: 66 }
  ],

  pharmacy: [
    { name: 'AMOXICILLIN 500MG STRIP', rate: 92, purchase: 68, stock: 140 },
    { name: 'ANTACID SYRUP 200ML', rate: 148, purchase: 109, stock: 52 },
    { name: 'BANDAGE ROLL 10CM', rate: 45, purchase: 28, stock: 96 },
    { name: 'COUGH SYRUP 100ML', rate: 118, purchase: 86, stock: 64 },
    { name: 'DIGITAL THERMOMETER', rate: 320, purchase: 215, stock: 24 },
    { name: 'GLUCOSE POWDER 500GM', rate: 165, purchase: 128, stock: 70 },
    { name: 'ORS SACHET', rate: 22, purchase: 14, stock: 240 },
    { name: 'PARACETAMOL 650MG STRIP', rate: 32, purchase: 21, stock: 180 },
    { name: 'SANITIZER 500ML', rate: 190, purchase: 132, stock: 48 },
    { name: 'VITAMIN C TABLETS', rate: 210, purchase: 155, stock: 58 }
  ],

  hardware: [
    { name: 'ACRYLIC PUTTY 20KG', rate: 1180, purchase: 940, stock: 26 },
    { name: 'ALUMINIUM LADDER 6FT', rate: 3450, purchase: 2700, stock: 8 },
    { name: 'CEMENT BAG 50KG', rate: 420, purchase: 362, stock: 220 },
    { name: 'DRILL BIT SET', rate: 760, purchase: 540, stock: 30 },
    { name: 'ENAMEL PAINT 4L', rate: 1290, purchase: 1010, stock: 34 },
    { name: 'MS ANGLE 25MM', rate: 310, purchase: 248, stock: 150 },
    { name: 'PVC PIPE 1 INCH', rate: 265, purchase: 198, stock: 110 },
    { name: 'SCREW BOX 2 INCH', rate: 180, purchase: 124, stock: 96 },
    { name: 'TMT BAR 12MM', rate: 680, purchase: 580, stock: 320 },
    { name: 'WALL TILES 2X2', rate: 95, purchase: 68, stock: 480 }
  ],

  stationery: [
    { name: 'A4 PAPER REAM 500', rate: 340, purchase: 282, stock: 60 },
    { name: 'BALLPOINT PEN BOX', rate: 120, purchase: 78, stock: 140 },
    { name: 'CHART PAPER PACK', rate: 90, purchase: 58, stock: 85 },
    { name: 'FILE FOLDER PACK', rate: 185, purchase: 128, stock: 72 },
    { name: 'GEOMETRY BOX', rate: 165, purchase: 112, stock: 54 },
    { name: 'GLUE STICK', rate: 35, purchase: 21, stock: 190 },
    { name: 'NOTEBOOK 200 PAGE', rate: 65, purchase: 44, stock: 300 },
    { name: 'PENCIL BOX 10', rate: 55, purchase: 36, stock: 160 },
    { name: 'STAPLER MEDIUM', rate: 145, purchase: 96, stock: 48 },
    { name: 'WHITEBOARD MARKER', rate: 48, purchase: 30, stock: 120 }
  ],

  garments: [
    { name: 'COTTON KURTA', rate: 850, purchase: 540, stock: 44 },
    { name: 'DENIM JEANS', rate: 1450, purchase: 920, stock: 36 },
    { name: 'DUPATTA CHIFFON', rate: 420, purchase: 265, stock: 78 },
    { name: 'FORMAL SHIRT', rate: 1100, purchase: 720, stock: 52 },
    { name: 'LADIES LEGGINGS', rate: 390, purchase: 235, stock: 96 },
    { name: 'SAREE COTTON', rate: 1250, purchase: 810, stock: 40 },
    { name: 'SCHOOL UNIFORM SET', rate: 980, purchase: 640, stock: 64 },
    { name: 'SOCKS PACK OF 3', rate: 240, purchase: 148, stock: 120 },
    { name: 'TOWEL LARGE', rate: 520, purchase: 340, stock: 58 },
    { name: 'TSHIRT ROUND NECK', rate: 560, purchase: 345, stock: 88 }
  ],

  /* A stall or a small eatery, where the "stock" is what is on the board.
   * The momos stall needed this: its shelf was a kirana store's. */
  food: [
    { name: 'CHOWMEIN PLATE', rate: 70, purchase: 31, stock: 99 },
    { name: 'COLD DRINK 250ML', rate: 25, purchase: 18, stock: 140 },
    { name: 'FRIED MOMOS PLATE', rate: 80, purchase: 36, stock: 99 },
    { name: 'MASALA CHAI', rate: 15, purchase: 6, stock: 199 },
    { name: 'PANEER ROLL', rate: 90, purchase: 44, stock: 99 },
    { name: 'SAMOSA PIECE', rate: 15, purchase: 7, stock: 160 },
    { name: 'SPRING ROLL PLATE', rate: 75, purchase: 34, stock: 99 },
    { name: 'TANDOORI MOMOS PLATE', rate: 110, purchase: 52, stock: 99 },
    { name: 'VEG BURGER', rate: 60, purchase: 28, stock: 99 },
    { name: 'WATER BOTTLE 1L', rate: 20, purchase: 13, stock: 120 }
  ],

  electronics: [
    { name: 'CEILING FAN 1200MM', rate: 2450, purchase: 1890, stock: 22 },
    { name: 'EARPHONES WIRED', rate: 450, purchase: 280, stock: 70 },
    { name: 'EXTENSION BOARD 4 SOCKET', rate: 560, purchase: 385, stock: 46 },
    { name: 'LED BULB 9W', rate: 110, purchase: 72, stock: 240 },
    { name: 'MIXER GRINDER 750W', rate: 3890, purchase: 3050, stock: 14 },
    { name: 'MOBILE CHARGER 20W', rate: 740, purchase: 510, stock: 56 },
    { name: 'POWER BANK 10000MAH', rate: 1290, purchase: 915, stock: 28 },
    { name: 'TUBE LIGHT 20W', rate: 240, purchase: 168, stock: 90 },
    { name: 'USB CABLE TYPE C', rate: 190, purchase: 112, stock: 150 },
    { name: 'WIRE BUNDLE 90M', rate: 1850, purchase: 1480, stock: 32 }
  ]
};

export const TRADES = Object.keys(SHELVES);
const DEFAULT_TRADE = 'kirana';

/* What each trade's stock sounds like, for working out a shop's trade from
 * the items the script named. Matched against whole words in an item's name,
 * so "DAL" does not fire on "SANDALWOOD". */
const SIGNS = {
  cosmetics: ['facewash', 'face', 'cream', 'lipstick', 'kajal', 'nail', 'paint',
    'polish', 'shampoo', 'serum', 'perfume', 'powder', 'talc', 'sunscreen',
    'lotion', 'conditioner', 'mascara', 'foundation', 'liner', 'beauty',
    'cosmetic', 'cosmetics', 'makeup', 'hair'],
  pharmacy: ['tablet', 'tablets', 'strip', 'syrup', 'capsule', 'capsules',
    'ointment', 'injection', 'medicine', 'pharma', 'pharmacy', 'chemist',
    'paracetamol', 'amoxicillin', 'ors', 'bandage', 'sanitizer', 'thermometer',
    'vitamin', 'antacid', 'mg'],
  hardware: ['cement', 'tmt', 'bar', 'rod', 'pipe', 'tile', 'tiles', 'paint',
    'putty', 'screw', 'nail', 'hammer', 'drill', 'ladder', 'angle', 'sheet',
    'hardware', 'construction', 'builder', 'sariya', 'brick', 'sand'],
  stationery: ['paper', 'pen', 'pencil', 'notebook', 'register', 'file',
    'folder', 'marker', 'stapler', 'eraser', 'glue', 'chart', 'stationery',
    'stationary', 'book', 'books'],
  garments: ['shirt', 'tshirt', 'kurta', 'saree', 'jeans', 'trouser', 'dupatta',
    'leggings', 'uniform', 'socks', 'towel', 'cloth', 'clothes', 'garment',
    'garments', 'fabric', 'readymade'],
  electronics: ['bulb', 'led', 'fan', 'wire', 'cable', 'charger', 'battery',
    'mobile', 'earphones', 'speaker', 'switch', 'socket', 'board', 'grinder',
    'electronics', 'electrical', 'electric', 'watt'],
  food: ['momos', 'momo', 'samosa', 'chowmein', 'roll', 'plate', 'thali',
    'biryani', 'burger', 'pizza', 'sandwich', 'dosa', 'idli', 'paratha',
    'restaurant', 'cafe', 'dhaba', 'stall', 'canteen', 'bhojnalaya'],
  kirana: ['dal', 'atta', 'rice', 'chawal', 'besan', 'salt', 'namak', 'sugar',
    'cheeni', 'oil', 'tel', 'masala', 'biscuit', 'rusk', 'tea', 'chai',
    'kirana', 'grocery', 'provision', 'namkeen', 'snacks', 'flour']
};

/* A word some trades share tells you nothing about which one it is: "paint"
 * is a nail paint and a wall paint, "nail" is a manicure and a carpenter's
 * box. Counted for every trade that claims it, so the deciding evidence has
 * to come from somewhere else. */
function scoreOf(words) {
  const score = {};
  for (const [trade, signs] of Object.entries(SIGNS)) {
    score[trade] = signs.reduce((n, sign) => n + (words.has(sign) ? 1 : 0), 0);
  }
  return score;
}

function wordsOf(data) {
  const text = [
    ...(Array.isArray(data?.items) ? data.items.map(i => i?.name) : []),
    data?.business?.name
  ].filter(Boolean).join(' ').toLowerCase();
  return new Set(text.split(/[^a-z]+/).filter(Boolean));
}

/* Which trade this shop is in.
 *
 * What the recipe says, if it says. Otherwise what its own items sound like,
 * and only when they sound clearly like one trade: a single shared word is
 * not enough to restock a shop on, and guessing wrong is the bug this exists
 * to fix, pointed the other way. */
export function tradeOf(data) {
  const stated = String(data?.business?.trade ?? '').trim().toLowerCase();
  if (TRADES.includes(stated)) return stated;

  const score = scoreOf(wordsOf(data));
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  const [best, top] = ranked[0];
  const runnerUp = ranked[1]?.[1] ?? 0;
  return top >= 2 && top > runnerUp ? best : DEFAULT_TRADE;
}

/* The shelf this shop stocks, minus anything the recipe already lists itself -
 * an item cannot be on the page twice. */
export function shelfFor(data) {
  const own = Array.isArray(data?.items) ? data.items : [];
  const named = new Set(own.map(o => String(o?.name ?? '').trim().toLowerCase()));
  return SHELVES[tradeOf(data)].filter(f => !named.has(f.name.toLowerCase()));
}
