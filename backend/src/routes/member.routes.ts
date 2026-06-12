import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authenticate, canManageContent, isAdminOrCommander } from '../middleware/auth.middleware';
import { requirePermission } from './permissions.routes';
import { MemberStatus, UserRole } from '@prisma/client';

const RANK_ORDER = ['LBD','LBDSTV','BR','OBR','ABI','HBI','OBI','BI','HV','OV','V','HBM','OBM','BM','HLM','OLM','LM','HFM','OFM','FM','PFM'];

function getRankIndex(rank: string | null | undefined): number {
  if (!rank) return 999;
  const code = rank.split(':')[0].trim().toUpperCase();
  const idx = RANK_ORDER.indexOf(code);
  return idx === -1 ? 998 : idx;
}

function sortByRank<T extends { rank?: string | null }>(arr: T[]): T[] {
  return arr.sort((a, b) => {
    const ri = getRankIndex(a.rank) - getRankIndex(b.rank);
    return ri !== 0 ? ri : 0;
  });
}
const router = Router();
router.use(authenticate);

// GET /api/members
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, status, group, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = {};
    if (status) where.status = status as MemberStatus;
    if (group) where.groupName = group as string;
    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { memberNumber: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // Mitglieder sehen nur eigene Daten — wenn keine memberId verknüpft: leere Liste
    if (req.user!.role === UserRole.MEMBER) {
      if (req.user!.memberId) {
        where.id = req.user!.memberId;
      } else {
        res.json({ members: [], total: 0, page: parseInt(page as string), limit: parseInt(limit as string) });
        return;
      }
    }

    const [members, total] = await Promise.all([
      prisma.member.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: {
          id: true, memberNumber: true, firstName: true, lastName: true,
          gender: true,
          birthDate: true, status: true, rank: true, functionTitle: true,
          groupName: true, phone: true, email: true, entryDate: true,
          isBreathingApparatus: true, isMachinist: true,
          isDriver: true, isRadioOperator: true, isParamedic: true,
          isDiver: true, isFlightHelper: true, isHazmatExpert: true,
          isExplosivesExpert: true, isMRAS: true, isRescueCutter: true,
          isEquipmentManager: true, isYouthLeader: true,
          user: { select: { avatarUrl: true, id: true, role: true, isActive: true } },
        },
      }),
      prisma.member.count({ where }),
    ]);

    res.json({ members: sortByRank(members), total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/members/next-number - Nächste freie Mitgliedsnummer
router.get('/next-number', async (_req: Request, res: Response) => {
  try {
    const members = await prisma.member.findMany({
      select: { memberNumber: true },
    });
    // Alle numerischen Nummern sammeln
    const numbers = members
      .map(m => parseInt(m.memberNumber))
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b);

    // Nächste freie Nummer finden
    let next = 1;
    for (const n of numbers) {
      if (n === next) next++;
      else if (n > next) break;
    }
    // Als 3-stellige Nummer formatieren (001, 002, ...)
    const formatted = String(next).padStart(3, '0');
    res.json({ nextNumber: formatted });
  } catch (err) {
    res.status(500).json({ error: 'Fehler' });
  }
});

// GET /api/members/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Mitglieder dürfen nur eigenes Profil sehen
    if (req.user!.role === UserRole.MEMBER && req.user!.memberId !== id) {
      res.status(403).json({ error: 'Keine Berechtigung' });
      return;
    }

    const member = await prisma.member.findUnique({
      where: { id },
      include: {
        user: { select: { avatarUrl: true, id: true, role: true, isActive: true } },
        honors: { orderBy: { honorDate: 'desc' } },
        attendances: {
          include: { event: { select: { title: true, type: true, date: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!member) { res.status(404).json({ error: 'Mitglied nicht gefunden' }); return; }
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// POST /api/members
router.post('/', requirePermission('members', 'CREATE'), async (req: Request, res: Response) => {
  try {
    const data = req.body;

    // Prüfen ob Mitgliedsnummer bereits vergeben
    const existing = await prisma.member.findUnique({ where: { memberNumber: data.memberNumber } });
    if (existing) { res.status(400).json({ error: 'Mitgliedsnummer bereits vergeben' }); return; }

    const member = await prisma.member.create({
      data: {
        memberNumber: data.memberNumber,
        firstName: data.firstName,
        lastName: data.lastName,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        street: data.street,
        zipCode: data.zipCode,
        city: data.city,
        phone: data.phone,
        email: data.email,
        entryDate: data.entryDate ? new Date(data.entryDate) : null,
        exitDate: data.exitDate ? new Date(data.exitDate) : null,
        deathDate: data.deathDate ? new Date(data.deathDate) : null,
        fireServicePassNumber: data.fireServicePassNumber || null,
        rank: data.rank,
        functionTitle: data.functionTitle,
        status: data.status || MemberStatus.ACTIVE,
        groupName: data.groupName,
        driverLicenses: data.driverLicenses || [],
        isBreathingApparatus: data.isBreathingApparatus || false,
        isMachinist: data.isMachinist || false,
        hasFirstAidTraining: data.hasFirstAidTraining || false,
        isDriver: data.isDriver || false,
        isRadioOperator: data.isRadioOperator || false,
        isParamedic: data.isParamedic || false,
        isDiver: data.isDiver || false,
        isFlightHelper: data.isFlightHelper || false,
        isHazmatExpert: data.isHazmatExpert || false,
        isExplosivesExpert: data.isExplosivesExpert || false,
        isMRAS: data.isMRAS || false,
        isRescueCutter: data.isRescueCutter || false,
        isEquipmentManager: data.isEquipmentManager || false,
        isYouthLeader: data.isYouthLeader || false,
        trainings: data.trainings || [],
        clothingSizes: data.clothingSizes,
        emergencyContactName: data.emergencyContactName,
        emergencyContactPhone: data.emergencyContactPhone,
        notes: data.notes,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE',
        entity: 'Member',
        entityId: member.id,
        details: { memberNumber: member.memberNumber, name: `${member.firstName} ${member.lastName}` },
      },
    });

    res.status(201).json(member);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// PUT /api/members/:id
router.put('/:id', requirePermission('members', 'EDIT'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const existing = await prisma.member.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Mitglied nicht gefunden' }); return; }

    const member = await prisma.member.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        memberNumber: data.memberNumber,
        gender: data.gender,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        street: data.street,
        zipCode: data.zipCode,
        city: data.city,
        phone: data.phone,
        email: data.email,
        entryDate: data.entryDate ? new Date(data.entryDate) : null,
        exitDate: data.exitDate ? new Date(data.exitDate) : null,
        deathDate: data.deathDate ? new Date(data.deathDate) : null,
        fireServicePassNumber: data.fireServicePassNumber || null,
        rank: data.rank,
        functionTitle: data.functionTitle,
        status: data.status,
        groupName: data.groupName,
        driverLicenses: data.driverLicenses || [],
        isBreathingApparatus: data.isBreathingApparatus,
        isMachinist: data.isMachinist,
        hasFirstAidTraining: data.hasFirstAidTraining,
        isDriver: data.isDriver,
        isRadioOperator: data.isRadioOperator,
        isParamedic: data.isParamedic,
        isDiver: data.isDiver,
        isFlightHelper: data.isFlightHelper,
        isHazmatExpert: data.isHazmatExpert,
        isExplosivesExpert: data.isExplosivesExpert,
        isMRAS: data.isMRAS,
        isRescueCutter: data.isRescueCutter,
        isEquipmentManager: data.isEquipmentManager,
        isYouthLeader: data.isYouthLeader,
        trainings: data.trainings || [],
        clothingSizes: data.clothingSizes,
        emergencyContactName: data.emergencyContactName,
        emergencyContactPhone: data.emergencyContactPhone,
        notes: data.notes,
      },
    });

    await prisma.auditLog.create({
      data: { userId: req.user!.userId, action: 'UPDATE', entity: 'Member', entityId: id },
    });

    res.json(member);
  } catch (error) {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// DELETE /api/members/:id
router.delete('/:id', requirePermission('members', 'EDIT'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const member = await prisma.member.findUnique({ where: { id } });
    if (!member) { res.status(404).json({ error: 'Mitglied nicht gefunden' }); return; }

    // Soft delete: Status auf EXITED setzen
    await prisma.member.update({
      where: { id },
      data: { status: MemberStatus.EXITED, exitDate: new Date() },
    });

    await prisma.auditLog.create({
      data: { userId: req.user!.userId, action: 'DELETE', entity: 'Member', entityId: id },
    });

    res.json({ message: 'Mitglied als ausgetreten markiert' });
  } catch (error) {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/members/:id/force-delete-preview — Vorschau was gelöscht wird
router.get('/:id/force-delete-preview', requirePermission('members', 'DELETE'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if ((req as any).user?.role !== UserRole.ADMIN) {
      res.status(403).json({ error: 'Nur Administratoren können Mitglieder vollständig löschen' });
      return;
    }

    const member = await prisma.member.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!member) { res.status(404).json({ error: 'Mitglied nicht gefunden' }); return; }

    const [
      attendances, exerciseAttendances, orgEventAttendances,
      kommandoAttendances, incidentMembers, honors, trips,
      responsibleEvents, responsibleExercises, responsibleOrgEvents,
      trainingPlanEntries, schulungsplanEntries,
    ] = await Promise.all([
      prisma.attendance.count({ where: { memberId: id } }),
      prisma.exerciseAttendance.count({ where: { memberId: id } }),
      prisma.orgEventAttendance.count({ where: { memberId: id } }),
      prisma.kommandoTerminAttendance.count({ where: { memberId: id } }),
      prisma.incidentMember.count({ where: { memberId: id } }),
      prisma.honor.count({ where: { memberId: id } }),
      prisma.trip.count({ where: { driverId: id } }),
      prisma.event.count({ where: { responsiblePersonId: id } }),
      prisma.exercise.count({ where: { responsiblePersonId: id } }),
      prisma.orgEvent.count({ where: { responsiblePersonId: id } }),
      prisma.trainingPlanEntry.count({ where: { leaderId: id } }),
      prisma.schulungsplanEntry.count({ where: { trainerId: id } }),
    ]);

    res.json({
      member: { id: member.id, firstName: member.firstName, lastName: member.lastName },
      hasUser: !!member.user,
      counts: {
        attendances,
        exerciseAttendances,
        orgEventAttendances,
        kommandoAttendances,
        incidentMembers,
        honors,
        trips,
        responsibleEvents,
        responsibleExercises,
        responsibleOrgEvents,
        trainingPlanEntries,
        schulungsplanEntries,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// DELETE /api/members/:id/force — Vollständiges Löschen (nur ADMIN)
router.delete('/:id/force', requirePermission('members', 'DELETE'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if ((req as any).user?.role !== UserRole.ADMIN) {
      res.status(403).json({ error: 'Nur Administratoren können Mitglieder vollständig löschen' });
      return;
    }

    const member = await prisma.member.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!member) { res.status(404).json({ error: 'Mitglied nicht gefunden' }); return; }

    // Prüfe ob Bestätigungsname mitgeschickt wurde
    const { confirmName } = req.body;
    const fullName = `${member.firstName.trim()} ${member.lastName.trim()}`;
    if ((confirmName || '').trim() !== fullName) {
      res.status(400).json({ error: 'Bestätigungsname stimmt nicht überein' });
      return;
    }

    // Alle Löschoperationen in einer Transaction
    await prisma.$transaction(async (tx) => {
      // 1. String-Referenzen nullen (kein FK, nur Datenbereinigung)
      await tx.trainingPlanEntry.updateMany({ where: { leaderId: id }, data: { leaderId: null } });
      await tx.schulungsplanEntry.updateMany({ where: { trainerId: id }, data: { trainerId: null } });

      // 2. Anwesenheiten löschen
      await tx.kommandoTerminAttendance.deleteMany({ where: { memberId: id } });
      await tx.exerciseAttendance.deleteMany({ where: { memberId: id } });
      await tx.orgEventAttendance.deleteMany({ where: { memberId: id } });
      await tx.attendance.deleteMany({ where: { memberId: id } });

      // 3. Einsatz-Mitgliedschaften löschen
      await tx.incidentMember.deleteMany({ where: { memberId: id } });

      // 4. Ehrungen löschen
      await tx.honor.deleteMany({ where: { memberId: id } });

      // 5. FK-Referenzen auf null setzen (Datensätze bleiben erhalten)
      await tx.trip.updateMany({ where: { driverId: id }, data: { driverId: null } });
      await tx.event.updateMany({ where: { responsiblePersonId: id }, data: { responsiblePersonId: null } });
      await tx.exercise.updateMany({ where: { responsiblePersonId: id }, data: { responsiblePersonId: null } });
      await tx.orgEvent.updateMany({ where: { responsiblePersonId: id }, data: { responsiblePersonId: null } });

      // 6. Login-Account löschen (cascades: permissions, push, trusted devices, audit logs)
      if (member.user) {
        await tx.user.delete({ where: { id: member.user.id } });
      }

      // 7. Mitglied selbst löschen
      await tx.member.delete({ where: { id } });
    });

    res.json({ message: `Mitglied ${fullName} wurde vollständig gelöscht` });
  } catch (error) {
    console.error('[Force Delete Member]', error);
    res.status(500).json({ error: 'Interner Serverfehler beim Löschen' });
  }
});

// Rank order helper for sorting

export default router;
