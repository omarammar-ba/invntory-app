import { Tile, Reservation, UnitType, Category, LogEntry, StaffMember } from '@/types';

export type { Tile, Reservation, UnitType, Category, LogEntry, StaffMember };

export interface InventoryStats {
  totalItems: number;
  totalMeters: number;
  totalBoxes: number;
  totalPallets: number;
  reservedMeters: number;
  availableMeters: number;
}
