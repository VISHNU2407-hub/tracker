import type React from 'react';
import type { PageId } from '../../hooks/useArc';
import {
  IconGrid,
  IconCheckCircle,
  IconCalendar,
  IconDumbbell,
  IconChart,
  IconBook,
  IconTarget,
  IconSettings,
  type IconProps,
} from '../../components/icons';

export interface NavEntry {
  id: PageId;
  label: string;
  icon: React.FC<IconProps>;
}

export const NAV_ENTRIES: NavEntry[] = [
  { id: 'dashboard', label: 'Dashboard', icon: IconGrid },
  { id: 'today', label: 'Today', icon: IconCheckCircle },
  { id: 'calendar', label: 'Calendar', icon: IconCalendar },
  { id: 'habits', label: 'Habits', icon: IconDumbbell },
  { id: 'stats', label: 'Stats', icon: IconChart },
  { id: 'reflection', label: 'Reflection', icon: IconBook },
  { id: 'myarc', label: 'My Winter Arc', icon: IconTarget },
  { id: 'settings', label: 'Settings', icon: IconSettings },
];

/** Screen order used for direction-aware transitions (forward slides right). */
export const NAV_ORDER: PageId[] = NAV_ENTRIES.map((e) => e.id);
