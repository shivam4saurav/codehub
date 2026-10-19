import {
  BellRing,
  CalendarClock,
  House,
  LayoutDashboard,
  ListFilter,
  Settings,
  Target,
} from 'lucide-react';

/**
 * The single source of truth for "where is each feature?".
 *
 * The sidebar, the mobile menu and the Cmd+K palette all read from here, so a
 * feature is always called the same thing. Practice next comes first because
 * it is the point of the app; everything else supports it.
 * `requiresAuth` items are still shown to guests (with a lock), so people can
 * see the feature exists. `hint` is used by search and as the link tooltip.
 */
export const NAV_SECTIONS = [
  {
    id: 'start',
    label: null,
    items: [{ to: '/', end: true, label: 'Home', hint: 'Start here', icon: House }],
  },
  {
    id: 'practice',
    label: 'Practice',
    items: [
      {
        to: '/practice',
        label: 'Practice next',
        hint: 'Problems picked for your weakest topics',
        icon: Target,
      },
      {
        to: '/problems',
        label: 'Problems',
        hint: 'Browse by topic, rating and difficulty',
        icon: ListFilter,
      },
    ],
  },
  {
    id: 'progress',
    label: 'Progress',
    items: [
      {
        to: '/profile',
        label: 'My dashboard',
        hint: 'Ratings, activity and topic strengths',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: 'contests',
    label: 'Contests',
    items: [
      {
        to: '/contests',
        label: 'Contest calendar',
        hint: 'Upcoming contests on all platforms',
        icon: CalendarClock,
      },
      {
        to: '/reminders',
        label: 'My reminders',
        hint: 'Contest alerts you have set',
        icon: BellRing,
        requiresAuth: true,
      },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    items: [
      {
        to: '/settings',
        label: 'Settings',
        hint: 'Usernames, sharing and password',
        icon: Settings,
        requiresAuth: true,
      },
    ],
  },
];

export const NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);

export default NAV_SECTIONS;
