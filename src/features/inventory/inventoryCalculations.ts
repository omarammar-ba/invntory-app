import { Tile } from '@/types';

/**
 * Calculates total reserved amount for a single item
 */
export const calculateReservedQuantity = (tile: Tile): number => {
  if (!tile.reservations || !Array.isArray(tile.reservations)) return 0;
  return tile.reservations.reduce((sum, res) => sum + (Number(res.meters) || 0), 0);
};

/**
 * Calculates remaining available quantity for a single item
 */
export const calculateAvailableQuantity = (tile: Tile): number => {
  const total = Number(tile.meters) || 0;
  const reserved = calculateReservedQuantity(tile);
  return Math.max(0, total - reserved);
};

/**
 * Calculates aggregate stats for a list of items
 */
export const calculateInventoryStats = (tiles: Tile[]) => {
  let totalMeters = 0;
  let totalBoxes = 0;
  let totalPallets = 0;
  let totalReserved = 0;

  tiles.forEach(tile => {
    const meters = Number(tile.meters) || 0;
    const boxes = Number(tile.boxes) || 0;
    const pallets = Number(tile.pallets) || 0;
    const reserved = calculateReservedQuantity(tile);

    totalMeters += meters;
    totalBoxes += boxes;
    totalPallets += pallets;
    totalReserved += reserved;
  });

  return {
    totalItems: tiles.length,
    totalMeters,
    totalBoxes,
    totalPallets,
    reservedMeters: totalReserved,
    availableMeters: Math.max(0, totalMeters - totalReserved)
  };
};
