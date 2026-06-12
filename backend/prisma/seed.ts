import { PrismaClient, UserRole, MemberStatus, EventType, AttendanceStatus, IncidentType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starte Seed-Prozess...');

  // Mitglieder anlegen
  const members = await Promise.all([
    prisma.member.upsert({
      where: { memberNumber: '001' },
      update: {},
      create: {
        memberNumber: '001',
        firstName: 'Max',
        lastName: 'Mustermann',
        birthDate: new Date('1975-03-15'),
        street: 'Feuerwehrstraße 1',
        zipCode: '12345',
        city: 'Musterstadt',
        phone: '0123-456789',
        email: 'max.mustermann@feuerwehr.local',
        entryDate: new Date('1995-01-01'),
        rank: 'HBM: Hauptbrandmeister',
        functionTitle: 'Kommandant',
        status: MemberStatus.ACTIVE,
        groupName: 'Gruppe 1',
        driverLicenses: ['B', 'C', 'CE'],
        isBreathingApparatus: true,
        isMachinist: true,
        isDriver: true,
        isRadioOperator: true,
        hasFirstAidTraining: true,
        trainings: ['Grundausbildung', 'Atemschutzgeräteträger', 'Maschinistenlehrgang'],
        clothingSizes: { shirt: 'L', pants: '52', boots: '43' },
        emergencyContactName: 'Maria Mustermann',
        emergencyContactPhone: '0123-456790',
      },
    }),
    prisma.member.upsert({
      where: { memberNumber: '002' },
      update: {},
      create: {
        memberNumber: '002',
        firstName: 'Anna',
        lastName: 'Schmidt',
        birthDate: new Date('1982-07-22'),
        street: 'Hauptstraße 15',
        zipCode: '12345',
        city: 'Musterstadt',
        phone: '0123-111222',
        email: 'anna.schmidt@feuerwehr.local',
        entryDate: new Date('2005-03-15'),
        rank: 'OBM: Oberbrandmeister',
        functionTitle: 'Schriftführerin',
        status: MemberStatus.ACTIVE,
        groupName: 'Gruppe 2',
        driverLicenses: ['B'],
        isBreathingApparatus: true,
        isMachinist: false,
        hasFirstAidTraining: true,
        trainings: ['Grundausbildung', 'Atemschutzgeräteträger'],
        emergencyContactName: 'Klaus Schmidt',
        emergencyContactPhone: '0123-111223',
      },
    }),
    prisma.member.upsert({
      where: { memberNumber: '003' },
      update: {},
      create: {
        memberNumber: '003',
        firstName: 'Peter',
        lastName: 'Wagner',
        birthDate: new Date('1988-11-08'),
        street: 'Bergstraße 7',
        zipCode: '12345',
        city: 'Musterstadt',
        phone: '0123-333444',
        entryDate: new Date('2010-09-01'),
        rank: 'BM: Brandmeister',
        functionTitle: 'Gruppenkommandant',
        status: MemberStatus.ACTIVE,
        groupName: 'Gruppe 1',
        driverLicenses: ['B', 'C'],
        isBreathingApparatus: true,
        isMachinist: true,
        hasFirstAidTraining: false,
        trainings: ['Grundausbildung', 'Maschinistenlehrgang'],
      },
    }),
    prisma.member.upsert({
      where: { memberNumber: '004' },
      update: {},
      create: {
        memberNumber: '004',
        firstName: 'Lisa',
        lastName: 'Müller',
        birthDate: new Date('2006-05-14'),
        street: 'Schulstraße 3',
        zipCode: '12345',
        city: 'Musterstadt',
        phone: '0123-555666',
        entryDate: new Date('2021-01-01'),
        rank: 'FM: Feuerwehrmann',
        functionTitle: 'Jugendwart',
        status: MemberStatus.YOUTH,
        groupName: 'Jugendfeuerwehr',
        driverLicenses: [],
        isBreathingApparatus: false,
        isMachinist: false,
        hasFirstAidTraining: true,
        trainings: ['Jugendausbildung', 'Erste Hilfe Kurs'],
      },
    }),
    prisma.member.upsert({
      where: { memberNumber: '005' },
      update: {},
      create: {
        memberNumber: '005',
        firstName: 'Hans',
        lastName: 'Bauer',
        birthDate: new Date('1955-12-01'),
        street: 'Altstraße 22',
        zipCode: '12345',
        city: 'Musterstadt',
        phone: '0123-777888',
        entryDate: new Date('1975-05-01'),
        exitDate: new Date('2020-12-31'),
        rank: 'OBI: Oberbrandinspektor',
        functionTitle: 'Ehrenkommandant',
        status: MemberStatus.HONORARY,
        groupName: 'Ehrenmitglieder',
        driverLicenses: ['B', 'C'],
        isBreathingApparatus: false,
        isMachinist: false,
        hasFirstAidTraining: true,
        trainings: ['Grundausbildung', 'Führungslehrgang'],
        notes: 'Langjähriges Ehrenmitglied, 45 Jahre aktiver Dienst',
      },
    }),
  ]);

  console.log(`✅ ${members.length} Mitglieder angelegt`);

  // Admin-Benutzer anlegen
  const adminPasswordHash = await bcrypt.hash('admin123', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@feuerwehr.local' },
    update: { memberId: members[0].id },
    create: {
      email: 'admin@feuerwehr.local',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      memberId: members[0].id,
    },
  });
  console.log('✅ Admin-Benutzer angelegt:', adminUser.email);

  // Schriftführerin-Benutzer
  const secretaryPasswordHash = await bcrypt.hash('test123', 12);
  await prisma.user.upsert({
    where: { email: 'anna.schmidt@feuerwehr.local' },
    update: { memberId: members[1].id },
    create: {
      email: 'anna.schmidt@feuerwehr.local',
      passwordHash: secretaryPasswordHash,
      role: UserRole.SECRETARY,
      memberId: members[1].id,
    },
  });

  // Ereignisse anlegen
  const event1 = await prisma.event.upsert({
    where: { id: 'evt-meeting-001' },
    update: {},
    create: {
      id: 'evt-meeting-001',
      type: EventType.MEETING,
      title: 'Monatsdienstbesprechung Januar',
      date: new Date('2024-01-15'),
      startTime: '19:00',
      endTime: '21:00',
      location: 'Feuerwehrhaus Musterstadt',
      description: 'Monatliche Dienstbesprechung mit Tagesordnung',
      responsiblePersonId: members[0].id,
      notes: 'Jahresplanung wird besprochen',
    },
  });

  const event2 = await prisma.event.upsert({
    where: { id: 'evt-exercise-001' },
    update: {},
    create: {
      id: 'evt-exercise-001',
      type: EventType.EXERCISE,
      title: 'Atemschutzübung',
      date: new Date('2024-02-10'),
      startTime: '09:00',
      endTime: '12:00',
      location: 'Übungsgelände',
      description: 'Jährliche Pflichtübung für Atemschutzgeräteträger',
      responsiblePersonId: members[2].id,
    },
  });

  const event3 = await prisma.event.upsert({
    where: { id: 'evt-exercise-002' },
    update: {},
    create: {
      id: 'evt-exercise-002',
      type: EventType.EXERCISE,
      title: 'Löschübung Wohnhausbrand',
      date: new Date('2024-03-20'),
      startTime: '18:00',
      endTime: '20:30',
      location: 'Altes Schulgebäude',
      description: 'Übung: Personenrettung und Löschangriff',
      responsiblePersonId: members[0].id,
    },
  });

  console.log('✅ Ereignisse angelegt');

  // Anwesenheiten
  const activeMembers = members.filter(m => m.status === MemberStatus.ACTIVE);

  for (const member of activeMembers) {
    await prisma.attendance.upsert({
      where: { eventId_memberId: { eventId: event1.id, memberId: member.id } },
      update: {},
      create: {
        eventId: event1.id,
        memberId: member.id,
        status: Math.random() > 0.2 ? AttendanceStatus.PRESENT : AttendanceStatus.EXCUSED,
      },
    });
    await prisma.attendance.upsert({
      where: { eventId_memberId: { eventId: event2.id, memberId: member.id } },
      update: {},
      create: {
        eventId: event2.id,
        memberId: member.id,
        status: Math.random() > 0.3 ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT,
      },
    });
    await prisma.attendance.upsert({
      where: { eventId_memberId: { eventId: event3.id, memberId: member.id } },
      update: {},
      create: {
        eventId: event3.id,
        memberId: member.id,
        status: AttendanceStatus.PRESENT,
      },
    });
  }
  console.log('✅ Anwesenheiten angelegt');

  // Einsätze
  await prisma.incident.upsert({
    where: { incidentNumber: 'E-2024-001' },
    update: {},
    create: {
      incidentNumber: 'E-2024-001',
      type: IncidentType.FIRE,
      alarmTime: new Date('2024-01-22T14:35:00'),
      departureTime: new Date('2024-01-22T14:42:00'),
      endTime: new Date('2024-01-22T16:15:00'),
      location: 'Industriestraße 15, Musterstadt',
      commanderId: members[0].id,
      shortReport: 'Zimmerbrand im 2. OG eines Wohnhauses. Brandbekämpfung mit 2 C-Rohren. 1 Person gerettet.',
      actions: 'Trupps unter PA vorgenommen, Personensuche, Löschangriff, Belüftung',
      specialOccurrences: 'Verletzte Person wurde vom RD versorgt',
    },
  });

  await prisma.incident.upsert({
    where: { incidentNumber: 'E-2024-002' },
    update: {},
    create: {
      incidentNumber: 'E-2024-002',
      type: IncidentType.TECHNICAL,
      alarmTime: new Date('2024-02-05T08:15:00'),
      departureTime: new Date('2024-02-05T08:22:00'),
      endTime: new Date('2024-02-05T10:30:00'),
      location: 'Hauptstraße 42, Musterstadt',
      commanderId: members[0].id,
      shortReport: 'Verkehrsunfall mit eingeklemmter Person. Türöffnung und Patientenbefreiung.',
      actions: 'Fahrzeugsicherung, hydraulisches Rettungsgerät, Patientenbefreiung',
    },
  });

  console.log('✅ Einsätze angelegt');

  // Ehrungen
  await prisma.honor.upsert({
    where: { id: 'honor-001' },
    update: {},
    create: {
      id: 'honor-001',
      memberId: members[0].id,
      title: 'Feuerwehr-Ehrenzeichen in Gold',
      honorDate: new Date('2020-05-01'),
      reason: '25 Jahre aktiver Dienst',
      awardedBy: 'Landesfeuerwehrverband',
      notes: 'Verliehen beim Landesfeuerwehrtag',
    },
  });

  await prisma.honor.upsert({
    where: { id: 'honor-002' },
    update: {},
    create: {
      id: 'honor-002',
      memberId: members[4].id,
      title: 'Feuerwehr-Ehrenzeichen in Platin',
      honorDate: new Date('2015-05-01'),
      reason: '40 Jahre aktiver Dienst',
      awardedBy: 'Landesfeuerwehrverband',
    },
  });

  console.log('✅ Ehrungen angelegt');
  console.log('');
  console.log('🎉 Seed abgeschlossen!');
  console.log('');
  console.log('Login-Daten:');
  console.log('  Admin:       admin@feuerwehr.local / admin123');
  console.log('  Schriftführer: anna.schmidt@feuerwehr.local / test123');
  console.log('');
  console.log('⚠️  WICHTIG: Passwörter nach der Installation ändern!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
