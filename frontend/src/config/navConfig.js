import {
  LayoutDashboard, Flame, Folder, Calendar, CalendarDays, Users, Cake, Award,
  Car, Wrench, FileText, BookOpen, Shield, Mail
} from 'lucide-react';

export const navItems = [
  { to: '/',              icon: LayoutDashboard, label: 'Dashboard',          end: true, permArea: 'dashboard'      },
  { to: '/incidents',     icon: Flame,           label: 'Einsätze',                      permArea: 'incidents'      },
  { to: '/einsatzplaene', icon: Folder,          label: 'Einsatzpläne',                  permArea: 'einsatzplaene', folderColor: '#008B45' },
  { to: '/exercises',     icon: Calendar,        label: 'Übungen',                       permArea: 'exercises'      },
  { to: '/org-events',    icon: CalendarDays,    label: 'Ereignisse',                    permArea: 'org_events'     },
  { to: '/members',       icon: Users,           label: 'Kamerad:innen',                 permArea: 'members'        },
  { to: '/calendar',      icon: CalendarDays,    label: 'Kalender Allgemein', end: true, permArea: 'calendar'       },
  { to: '/birthdays',     icon: Cake,            label: 'Geburtstage',                   permArea: 'birthdays'      },
  { to: '/honors',        icon: Award,           label: 'Ehrungen',                      permArea: 'honors'         },
];

export const docsAllgemein = [
  { to: '/vehicles',         icon: Car,      label: 'Fahrtenbuch',         permArea: 'vehicles'         },
  { to: '/equipment',        icon: Wrench,   label: 'Gerätebuch',          permArea: 'equipment'        },
  { to: '/documents-public', icon: FileText, label: 'Dokumente Allgemein', permArea: 'documents_public' },
];

export const docsKommando = [
  { to: '/calendar-command',               icon: CalendarDays, label: 'Kalender Kommando',             permArea: 'calendar_command'      },
  { to: '/kommando-termine',               icon: Shield,       label: 'Kommandotermine',               permArea: 'kommando_termine'      },
  { to: '/documents',                      icon: FileText,     label: 'Dokumente Kommando',            permArea: 'documents_command'     },
  { to: '/protocols',                      icon: BookOpen,     label: 'Protokolle',                    permArea: 'protocols'             },
  { to: '/reports',                        icon: FileText,     label: 'Berichte',                      permArea: 'reports'               },
  { to: '/jahresbericht',                  icon: BookOpen,     label: 'Jahresbericht',                 permArea: 'jahresbericht'         },
  { to: '/berichte/kameradschaftsfuehrer', icon: FileText,     label: 'Berichte Kameradschaftsführer', permArea: 'berichte_kameradschaft'},
  { to: '/berichte/kassier',               icon: FileText,     label: 'Berichte Kassier',              permArea: 'berichte_kassier'      },
  { to: '/schriftverkehr',                 icon: Mail,         label: 'Schriftverkehr',                permArea: 'schriftverkehr'        },
];
