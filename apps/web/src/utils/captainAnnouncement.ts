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
  /** 'road' presets are the default weather and road alerts. */
  group?: 'road';
}

export const CAPTAIN_ANNOUNCEMENT_PRESETS: CaptainAnnouncementPreset[] = [
  {
    id: 'fuel_next_town',
    label: 'Fuel at next town',
    title: 'Fuel at next town',
    icon: 'fuel',
    description: 'Petrol bunk approaching in next town. Plan refuel.',
    urgency: 'medium',
    color: '#F59E0B',
  },
  {
    id: 'gravel_ahead',
    label: 'Gravel ahead',
    title: 'Gravel ahead',
    icon: 'warning',
    description: 'Loose gravel or broken road surface. Drop speed.',
    urgency: 'high',
    color: '#EF4444',
  },
  {
    id: 'slow_down',
    label: 'Slow down',
    title: 'Slow down',
    icon: 'stop',
    description: 'Drop cruising speed, congested or hazardous stretch.',
    urgency: 'high',
    color: '#EF4444',
  },
  {
    id: 'regroup_junction',
    label: 'Regroup at junction',
    title: 'Regroup at junction',
    icon: 'alert',
    description: 'Wait and regroup at upcoming fork or highway junction.',
    urgency: 'high',
    color: '#F0C23A',
  },
  {
    id: 'police_check',
    label: 'Police check ahead',
    title: 'Police check ahead',
    icon: 'user',
    description: 'Checkpost ahead. Keep gear on, follow lane order.',
    urgency: 'medium',
    color: '#38BDF8',
  },
  {
    id: 'change_of_plan',
    label: 'Change of plan',
    title: 'Change of plan',
    icon: 'refresh',
    description: 'Route diversion or schedule change. Follow lead.',
    urgency: 'high',
    color: '#F0C23A',
  },
  {
    id: 'road_diversion',
    label: 'Road diversion',
    title: 'Road diversion ahead',
    icon: 'refresh',
    description: 'Road is diverted ahead. Follow the captain and do not use the old route.',
    urgency: 'high',
    color: '#F0C23A',
    group: 'road',
  },
  {
    id: 'fog_ahead',
    label: 'Fog ahead',
    title: 'Fog ahead',
    icon: 'rain',
    description: 'Dense fog ahead. Switch on low beam and hazard lights, keep distance, slow down.',
    urgency: 'high',
    color: '#EF4444',
    group: 'road',
  },
  {
    id: 'heavy_rain',
    label: 'Heavy rain',
    title: 'Heavy rain ahead',
    icon: 'rain',
    description: 'Heavy rain ahead. Wear rain gear, brake early, avoid sudden turns.',
    urgency: 'high',
    color: '#38BDF8',
    group: 'road',
  },
  {
    id: 'road_blocked',
    label: 'Road blocked',
    title: 'Road blocked',
    icon: 'stop',
    description: 'Road is blocked ahead. Stop safely and wait for the captain.',
    urgency: 'high',
    color: '#EF4444',
    group: 'road',
  },
  {
    id: 'waterlogging',
    label: 'Waterlogging or landslide',
    title: 'Waterlogging or landslide',
    icon: 'warning',
    description: 'Water on the road or landslide debris ahead. Slow down and stay in line.',
    urgency: 'high',
    color: '#EF4444',
    group: 'road',
  },
  {
    id: 'traffic_jam',
    label: 'Traffic jam',
    title: 'Traffic jam ahead',
    icon: 'clock',
    description: 'Heavy traffic or roadwork ahead. Expect delay and keep the group together.',
    urgency: 'medium',
    color: '#F59E0B',
    group: 'road',
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

