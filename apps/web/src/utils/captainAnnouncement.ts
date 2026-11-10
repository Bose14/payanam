/**
 * Captain Announcement Presets Engine (Feature K · Communication)
 * 
 * Rules:
 * 1. Captain opens the sheet: Captain-only control on the Ride tab.
 * 2. Captain picks a preset:
 *    - Fuel at next town
 *    - Gravel ahead
 *    - Slow down
 *    - Regroup at junction
 *    - Police check ahead
 *    - Change of plan
 * 3. Optional line added: A short text line, dictated or chosen.
 * 4. Group is alerted: Members get the alert with a distinct vibration pattern.
 */

export interface CaptainAnnouncementPreset {
  id: string;
  label: string;
  title: string;
  icon: string;
  description: string;
  urgency: 'high' | 'medium' | 'info';
  color: string;
}

export const CAPTAIN_ANNOUNCEMENT_PRESETS: CaptainAnnouncementPreset[] = [
  {
    id: 'fuel_next_town',
    label: 'Fuel at next town',
    title: 'Fuel at next town',
    icon: '⛽',
    description: 'Petrol bunk approaching in next town. Plan refuel.',
    urgency: 'medium',
    color: '#F59E0B',
  },
  {
    id: 'gravel_ahead',
    label: 'Gravel ahead',
    title: 'Gravel ahead',
    icon: '⚠️',
    description: 'Loose gravel or broken road surface. Drop speed.',
    urgency: 'high',
    color: '#EF4444',
  },
  {
    id: 'slow_down',
    label: 'Slow down',
    title: 'Slow down',
    icon: '🛑',
    description: 'Drop cruising speed, congested or hazardous stretch.',
    urgency: 'high',
    color: '#EF4444',
  },
  {
    id: 'regroup_junction',
    label: 'Regroup at junction',
    title: 'Regroup at junction',
    icon: '🚨',
    description: 'Wait and regroup at upcoming fork or highway junction.',
    urgency: 'high',
    color: '#F0C23A',
  },
  {
    id: 'police_check',
    label: 'Police check ahead',
    title: 'Police check ahead',
    icon: '👮',
    description: 'Checkpost ahead. Keep gear on, follow lane order.',
    urgency: 'medium',
    color: '#38BDF8',
  },
  {
    id: 'change_of_plan',
    label: 'Change of plan',
    title: 'Change of plan',
    icon: '🔀',
    description: 'Route diversion or schedule change. Follow lead.',
    urgency: 'high',
    color: '#F0C23A',
  },
];

export const OPTIONAL_LINE_SUGGESTIONS = [
  'In 2 km',
  'Keep extreme left',
  'Wait for all riders',
  'Take service road',
  'Slow down now',
  'Pull over on shoulder',
];

/**
 * Distinct vibration pattern for Captain announcements:
 * Two alert pulses followed by a sustained buzz (Requirement 4).
 */
export const CAPTAIN_ALERT_VIBRATION_PATTERN = [150, 80, 150, 80, 350];
export const CAPTAIN_SENT_VIBRATION_PATTERN = [100, 50, 100];

