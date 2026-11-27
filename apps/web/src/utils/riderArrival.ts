/** One rider's arrival state for the pinned stop. */
export interface RiderArrivalInfo {
  userId: string;
  userName: string;
  status: 'arrived' | 'en_route' | 'departed';
  arrivedAt?: string;
  distanceKm?: number | null;
  isStale?: boolean;
  ageLabel?: string;
}
