/**
 * Feature 1A · Itinerary: Share itinerary within group & propose changes
 * 
 * Specifications:
 * Where it sits: Plan > trip > Itinerary. Members join with an invitation link or code.
 * How it works:
 * 1. Owner builds the trip: Days, stops, times, and notes in the trip builder.
 * 2. Members are invited: Invitation by link or code.
 * 3. Everyone sees the same plan: Stops and notes are shared with all members.
 * 4. Changes are proposed: A member proposes an edit. The owner or captain approves it, depending on the trip setting.
 */

export interface ItineraryProposal {
  id: string;
  tripId: string;
  proposerId: string;
  proposerName: string;
  proposerInitials: string;
  title: string;
  description?: string;
  targetStopPlace?: string;
  proposedTime?: string;
  proposedLat?: number;
  proposedLng?: number;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export const PROPOSAL_PRESET_SUGGESTIONS = [
  'Lunch at 13:30 instead',
  'Extra 15 min chai break',
  'Regroup before ghat section',
  'Fuel stop 10 km earlier',
  'Extend viewpoint stop by 20 min',
  'Take scenic bypass route',
];

const STORAGE_PREFIX = 'payanam_proposals_';

export function getStoredProposals(tripId: string): ItineraryProposal[] {
  if (!tripId) return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${tripId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }

  // Default demo proposal matching Mockup 7
  return [
    {
      id: 'prop_demo_meera',
      tripId,
      proposerId: 'user_meera',
      proposerName: 'Meera',
      proposerInitials: 'MR',
      title: 'Lunch at 13:30 instead',
      description: 'Ghat section traffic delayed our average cruising speed by 15 min.',
      targetStopPlace: 'Lunch, Udupi',
      proposedTime: '13:30',
      status: 'pending',
      createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
  ];
}

export function saveProposals(tripId: string, proposals: ItineraryProposal[]): void {
  if (!tripId) return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${tripId}`, JSON.stringify(proposals));
  } catch {
    // ignore
  }
}

export function addProposal(
  tripId: string,
  proposal: Omit<ItineraryProposal, 'id' | 'createdAt' | 'status'>
): ItineraryProposal {
  const current = getStoredProposals(tripId);
  const newProp: ItineraryProposal = {
    ...proposal,
    id: `prop_${Date.now()}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  const updated = [newProp, ...current];
  saveProposals(tripId, updated);
  return newProp;
}

export function resolveProposal(
  tripId: string,
  proposalId: string,
  newStatus: 'accepted' | 'declined',
  resolverName: string
): ItineraryProposal | null {
  const current = getStoredProposals(tripId);
  let resolved: ItineraryProposal | null = null;
  const updated = current.map((p) => {
    if (p.id === proposalId) {
      resolved = {
        ...p,
        status: newStatus,
        resolvedAt: new Date().toISOString(),
        resolvedBy: resolverName,
      };
      return resolved;
    }
    return p;
  });
  saveProposals(tripId, updated);
  return resolved;
}
