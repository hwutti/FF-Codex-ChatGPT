import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { prisma } from '../config/database';
import { UserRole } from '@prisma/client';

const router = Router();
router.use(authenticate);

// Alle verfügbaren Bereiche
export const PERMISSION_AREAS = [
  // Hauptmenü
  { key: 'dashboard',              label: 'Dashboard' },
  { key: 'incidents',              label: 'Einsätze' },
  { key: 'einsatzplaene',          label: 'Einsatzpläne' },
  { key: 'exercises',              label: 'Übungen' },
  { key: 'org_events',             label: 'Ereignisse' },
  { key: 'members',                label: 'Kamerad:innen' },
  { key: 'calendar',               label: 'Kalender Allgemein' },
  { key: 'birthdays',              label: 'Geburtstage' },
  { key: 'honors',                 label: 'Ehrungen' },
  // Dokumentation Allgemein
  { key: 'vehicles',               label: 'Fahrtenbuch' },
  { key: 'equipment',              label: 'Gerätebuch' },
  { key: 'documents_public',       label: 'Dokumente Allgemein' },
  // Verwaltung Kommando
  { key: 'calendar_command',       label: 'Kalender Kommando' },
  { key: 'kommando_termine',       label: 'Kommandotermine' },
  { key: 'documents_command',      label: 'Verwaltung Kommando' },
  { key: 'protocols',              label: 'Protokolle' },
  { key: 'reports',                label: 'Berichte' },
  { key: 'jahresbericht',          label: 'Jahresbericht' },
  { key: 'berichte_kameradschaft', label: 'Berichte Kameradschaftsführer' },
  { key: 'berichte_kassier',       label: 'Berichte Kassier' },
  { key: 'schriftverkehr',         label: 'Schriftverkehr' },
  { key: 'administration',         label: 'Administration' },
];

export const PERMISSION_ACTIONS = ['VIEW', 'CREATE', 'EDIT', 'DELETE'];

// Basis-Rechte pro Rolle (VIEW-only für MEMBER auf öffentliche Bereiche)
export const ROLE_BASE_PERMISSIONS: Record<string, { area: string; actions: string[] }[]> = {
  MEMBER: [
    { area: 'dashboard',     actions: ['VIEW'] },
    { area: 'einsatzplaene', actions: ['VIEW'] },
    { area: 'exercises',     actions: ['VIEW'] },
    { area: 'org_events',    actions: ['VIEW'] },
    { area: 'members',       actions: ['VIEW'] },
    { area: 'calendar',      actions: ['VIEW'] },
    { area: 'birthdays',     actions: ['VIEW'] },
  ],
  GROUP_COMMANDER: [
    { area: 'dashboard',     actions: ['VIEW'] },
    { area: 'einsatzplaene', actions: ['VIEW'] },
    { area: 'exercises',     actions: ['VIEW','CREATE','EDIT'] },
    { area: 'org_events',    actions: ['VIEW','CREATE','EDIT'] },
    { area: 'members',       actions: ['VIEW'] },
    { area: 'calendar',      actions: ['VIEW'] },
    { area: 'birthdays',     actions: ['VIEW'] },
  ],
  SECRETARY: [
    { area: 'dashboard',              actions: ['VIEW'] },
    { area: 'incidents',              actions: ['VIEW','CREATE','EDIT'] },
    { area: 'einsatzplaene',          actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'exercises',              actions: ['VIEW','CREATE','EDIT'] },
    { area: 'org_events',             actions: ['VIEW','CREATE','EDIT'] },
    { area: 'members',                actions: ['VIEW','CREATE','EDIT'] },
    { area: 'calendar',               actions: ['VIEW','CREATE'] },
    { area: 'birthdays',              actions: ['VIEW'] },
    { area: 'honors',                 actions: ['VIEW','CREATE','EDIT'] },
    { area: 'vehicles',               actions: ['VIEW','CREATE','EDIT'] },
    { area: 'equipment',              actions: ['VIEW','CREATE','EDIT'] },
    { area: 'documents_public',       actions: ['VIEW','CREATE'] },
    { area: 'calendar_command',       actions: ['VIEW','CREATE'] },
    { area: 'kommando_termine',       actions: ['VIEW','CREATE'] },
    { area: 'documents_command',      actions: ['VIEW','CREATE'] },
    { area: 'protocols',              actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'reports',                actions: ['VIEW'] },
    { area: 'jahresbericht',          actions: ['VIEW'] },
    { area: 'berichte_kameradschaft', actions: ['VIEW'] },
    { area: 'berichte_kassier',       actions: ['VIEW'] },
    { area: 'schriftverkehr',         actions: ['VIEW','CREATE','EDIT'] },
  ],
  DEPUTY_COMMANDER: [
    { area: 'dashboard',              actions: ['VIEW'] },
    { area: 'incidents',              actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'einsatzplaene',          actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'exercises',              actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'org_events',             actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'members',                actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'calendar',               actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'birthdays',              actions: ['VIEW'] },
    { area: 'honors',                 actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'vehicles',               actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'equipment',              actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'documents_public',       actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'calendar_command',       actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'kommando_termine',       actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'documents_command',      actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'protocols',              actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'reports',                actions: ['VIEW','CREATE'] },
    { area: 'jahresbericht',          actions: ['VIEW','CREATE'] },
    { area: 'berichte_kameradschaft', actions: ['VIEW','CREATE'] },
    { area: 'berichte_kassier',       actions: ['VIEW'] },
    { area: 'schriftverkehr',         actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'administration',         actions: ['VIEW'] },
  ],
  COMMANDER: [
    { area: 'dashboard',              actions: ['VIEW'] },
    { area: 'incidents',              actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'einsatzplaene',          actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'exercises',              actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'org_events',             actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'members',                actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'calendar',               actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'birthdays',              actions: ['VIEW'] },
    { area: 'honors',                 actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'vehicles',               actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'equipment',              actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'documents_public',       actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'calendar_command',       actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'kommando_termine',       actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'documents_command',      actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'protocols',              actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'reports',                actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'jahresbericht',          actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'berichte_kameradschaft', actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'berichte_kassier',       actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'schriftverkehr',         actions: ['VIEW','CREATE','EDIT','DELETE'] },
    { area: 'administration',         actions: ['VIEW'] },
  ],
};

// ── Gruppen CRUD ──────────────────────────────────────────────────────────────

// GET /api/permissions/groups
router.get('/groups', authorize(UserRole.ADMIN), async (_req: Request, res: Response) => {
  try {
    const groups = await prisma.permissionGroup.findMany({
      include: { members: { include: { user: { include: { member: true } } } } },
      orderBy: { name: 'asc' },
    });
    res.json(groups);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/permissions/groups
router.post('/groups', authorize(UserRole.ADMIN), async (req: Request, res: Response) => {
  try {
    const { name, description, permissions } = req.body;
    const group = await prisma.permissionGroup.create({
      data: { name, description, permissions: permissions || [] },
    });
    res.json(group);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/permissions/groups/:id
router.put('/groups/:id', authorize(UserRole.ADMIN), async (req: Request, res: Response) => {
  try {
    const { name, description, permissions } = req.body;
    const group = await prisma.permissionGroup.update({
      where: { id: req.params.id },
      data: { name, description, permissions: permissions || [] },
    });
    res.json(group);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/permissions/groups/:id
router.delete('/groups/:id', authorize(UserRole.ADMIN), async (req: Request, res: Response) => {
  try {
    await prisma.permissionGroup.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// POST /api/permissions/groups/:id/members — User zu Gruppe hinzufügen
router.post('/groups/:id/members', authorize(UserRole.ADMIN), async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    await prisma.userPermissionGroup.create({
      data: { userId, groupId: req.params.id },
    });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/permissions/groups/:id/members/:userId
router.delete('/groups/:id/members/:userId', authorize(UserRole.ADMIN), async (req: Request, res: Response) => {
  try {
    await prisma.userPermissionGroup.delete({
      where: { userId_groupId: { userId: req.params.userId, groupId: req.params.id } },
    });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Direkte User-Berechtigungen ───────────────────────────────────────────────

// GET /api/permissions/me — Eigene Berechtigungen abrufen (alle User)
router.get('/me', async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;
    const direct = await prisma.userDirectPermission.findMany({ where: { userId } });
    const groups = await prisma.userPermissionGroup.findMany({
      where: { userId },
      include: { group: true },
    });
    const groupPerms = groups.flatMap(ug => (ug.group.permissions as any[]) || []);
    res.json({ direct, groupPerms });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/permissions/users/:userId
router.get('/users/:userId', authorize(UserRole.ADMIN), async (req: Request, res: Response) => {
  try {
    const perms = await prisma.userDirectPermission.findMany({
      where: { userId: req.params.userId },
    });
    res.json(perms);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// PUT /api/permissions/users/:userId — Alle direkten Rechte setzen
router.put('/users/:userId', authorize(UserRole.ADMIN), async (req: Request, res: Response) => {
  try {
    const { permissions } = req.body; // [{area, action}]
    await prisma.userDirectPermission.deleteMany({ where: { userId: req.params.userId } });
    if (permissions?.length > 0) {
      await prisma.userDirectPermission.createMany({
        data: permissions.map((p: any) => ({ userId: req.params.userId, area: p.area, action: p.action })),
      });
    }
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// GET /api/permissions/areas — Alle Bereiche und Aktionen
router.get('/areas', async (_req: Request, res: Response) => {
  res.json({ areas: PERMISSION_AREAS, actions: PERMISSION_ACTIONS });
});

// ── Wiederverwendbare Permission-Check Middleware ────────────────────────────
export async function checkUserPermission(userId: string, role: string, area: string, action: string): Promise<boolean> {
  if (role === UserRole.ADMIN) return true;

  const direct = await prisma.userDirectPermission.findFirst({ where: { userId, area, action } });
  if (direct) return true;

  const groups = await prisma.userPermissionGroup.findMany({ where: { userId }, include: { group: true } });
  for (const ug of groups) {
    const perms = ug.group.permissions as any[];
    if (perms.some((p: any) => p.area === area && p.action === action)) return true;
  }

  const rolePerms = ROLE_BASE_PERMISSIONS[role] || [];
  return rolePerms.some(rp => rp.area === area && rp.actions.includes(action));
}

export function requirePermission(area: string, action: string = 'VIEW') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId, role } = (req as any).user;
      const allowed = await checkUserPermission(userId, role, area, action);
      if (!allowed) { res.status(403).json({ error: 'Keine Berechtigung' }); return; }
      next();
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  };
}

// GET /api/permissions/check/:area/:action — Prüfe ob aktueller User Recht hat
router.get('/check/:area/:action', async (req: Request, res: Response) => {
  try {
    const { userId, role } = (req as any).user;
    const { area, action } = req.params;

    // ADMIN hat immer alles
    if (role === UserRole.ADMIN) { res.json({ allowed: true }); return; }

    // Direkte Berechtigung prüfen
    const direct = await prisma.userDirectPermission.findFirst({
      where: { userId, area, action },
    });
    if (direct) { res.json({ allowed: true }); return; }

    // Gruppen-Berechtigung prüfen
    const groups = await prisma.userPermissionGroup.findMany({
      where: { userId },
      include: { group: true },
    });
    for (const ug of groups) {
      const perms = ug.group.permissions as any[];
      if (perms.some((p: any) => p.area === area && p.action === action)) {
        res.json({ allowed: true }); return;
      }
    }

    // Rollen-Basis prüfen
    const rolePerms = ROLE_BASE_PERMISSIONS[role] || [];
    const allowed = rolePerms.some(rp => rp.area === area && rp.actions.includes(action));
    res.json({ allowed });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
