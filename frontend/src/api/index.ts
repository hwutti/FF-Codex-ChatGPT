import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 300000, // 5 Minuten Standard-Timeout
});

// Spezieller AI-Client mit 10 Minuten Timeout
export const aiApi = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 600000, // 10 Minuten für KI-Anfragen
});

// Request interceptor: Bearer Token als Fallback (Cookie ist primär)
// Response interceptor: handle 401
// WICHTIG: kein window.location.href – verursacht Reload-Loop im iOS PWA Standalone-Mode.
// Custom Event → AuthContext navigiert per React Router (kein Hard-Reload).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const authApi = {
  login: (email: string, password: string, totpCode?: string, trustDevice?: boolean) =>
    api.post('/auth/login', { email, password, totpCode, trustDevice }).then(r => r.data),
  logout: () => api.post('/auth/logout').then(r => r.data),
  me: () => api.get('/auth/me').then(r => r.data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/auth/change-password', { currentPassword, newPassword }),
  setup2fa: () => api.post('/auth/2fa/setup').then(r => r.data),
  verify2fa: (code: string) => api.post('/auth/2fa/verify', { code }).then(r => r.data),
  disable2fa: (code: string) => api.post('/auth/2fa/disable', { code }).then(r => r.data),
};

// Dashboard
export const dashboardApi = {
  get: () => api.get('/dashboard').then(r => r.data),
  getStats: () => api.get('/dashboard').then(r => r.data),
};

// Members
export const memberApi = {
  list: (params?: Record<string, string>) => api.get('/members', { params }).then(r => r.data),
  get: (id: string) => api.get(`/members/${id}`, { params: { _t: Date.now() } }).then(r => r.data),
  nextNumber: () => api.get('/members/next-number').then(r => r.data),
  create: (data: any) => api.post('/members', data).then(r => r.data),
  update: (id: string, data: any) => api.put(`/members/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/members/${id}`),
};

// Events
export const eventApi = {
  list: (params?: Record<string, string>) => api.get('/events', { params }).then(r => r.data),
  get: (id: string) => api.get(`/events/${id}`).then(r => r.data),
  create: (data: any) => api.post('/events', data).then(r => r.data),
  update: (id: string, data: any) => api.put(`/events/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/events/${id}`),
  getAttendance: (id: string) => api.get(`/events/${id}/attendance`).then(r => r.data),
  saveAttendance: (id: string, attendances: any[]) =>
    api.post(`/events/${id}/attendance`, { attendances }).then(r => r.data),
};

export const exerciseApi = {
  list: (params?: Record<string, string>) => api.get('/exercises', { params }).then(r => r.data),
  get: (id: string) => api.get(`/exercises/${id}`).then(r => r.data),
  create: (data: any) => api.post('/exercises', data).then(r => r.data),
  update: (id: string, data: any) => api.put(`/exercises/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/exercises/${id}`),
  getAttendance: (id: string) => api.get(`/exercises/${id}/attendance`).then(r => r.data),
  updateAttendance: (id: string, memberId: string, status: string) =>
    api.put(`/exercises/${id}/attendance`, { memberId, status }).then(r => r.data),
  deleteAttendance: (id: string, memberId: string) =>
    api.delete(`/exercises/${id}/attendance/${memberId}`),
  getEquipment: (id: string) => api.get(`/exercises/${id}/equipment`).then(r => r.data),
  addEquipment: (id: string, data: any) => api.post(`/exercises/${id}/equipment`, data).then(r => r.data),
  removeEquipment: (id: string, equipmentId: string) => api.delete(`/exercises/${id}/equipment/${equipmentId}`),
};

export const orgEventApi = {
  list: (params?: Record<string, string>) => api.get('/org-events', { params }).then(r => r.data),
  get: (id: string) => api.get(`/org-events/${id}`).then(r => r.data),
  create: (data: any) => api.post('/org-events', data).then(r => r.data),
  update: (id: string, data: any) => api.put(`/org-events/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/org-events/${id}`),
  updateAttendance: (id: string, memberId: string, status: string) =>
    api.put(`/org-events/${id}/attendance`, { memberId, status }).then(r => r.data),
  deleteAttendance: (id: string, memberId: string) =>
    api.delete(`/org-events/${id}/attendance/${memberId}`),
};

// Incidents
export const incidentApi = {
  list: (params?: Record<string, string>) => api.get('/incidents', { params }).then(r => r.data),
  get: (id: string) => api.get(`/incidents/${id}`).then(r => r.data),
  withMembers: () => api.get('/incidents/with-members').then(r => r.data),
  create: (data: any) => api.post('/incidents', data).then(r => r.data),
  update: (id: string, data: any) => api.put(`/incidents/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/incidents/${id}`),
};

// Honors
export const honorApi = {
  list: () => api.get('/honors').then(r => r.data),
  create: (data: any) => api.post('/honors', data).then(r => r.data),
  update: (id: string, data: any) => api.put(`/honors/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/honors/${id}`),
};

// Birthdays
export const birthdayApi = {
  upcoming: (days?: number) => api.get('/birthdays/upcoming', { params: { days } }).then(r => r.data),
  list: (month?: number) => api.get('/birthdays', { params: { month } }).then(r => r.data),
};

// Reports
export const reportApi = {
  members: () => api.get('/reports/members', { responseType: 'blob' }),
  attendance: (eventId?: string) => api.get('/reports/attendance', { params: { eventId }, responseType: 'blob' }),
  birthdays: () => api.get('/reports/birthdays', { responseType: 'blob' }),
  honors: () => api.get('/reports/honors', { responseType: 'blob' }),
  download: (endpoint: string) => api.get(`/reports/${endpoint}`, { responseType: 'blob' }),
};

// Users
export const userApi = {
  list: () => api.get('/users').then(r => r.data),
  create: (data: any) => api.post('/users', data).then(r => r.data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/users/${id}`),
  uploadAvatar: async (file: File, userId?: string) => {
    const form = new FormData();
    form.append('avatar', file);
    const url = userId ? `/api/users/${userId}/avatar` : '/api/users/me/avatar';
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    const data = await response.json();
    if (!response.ok) throw { response: { data } };
    return data;
  },
  deleteAvatar: (userId?: string) => {
    const url = userId ? `/users/${userId}/avatar` : '/users/me/avatar';
    return api.delete(url).then(r => r.data);
  },
  setup2faForUser: (userId: string) => api.post(`/users/${userId}/2fa/setup`).then(r => r.data),
  disable2faForUser: (userId: string) => api.post(`/users/${userId}/2fa/disable`).then(r => r.data),
};

// Data Import/Export
export const dataApi = {
  export: () => api.get('/data/export', { responseType: 'blob' }),
  import: (data: any) => api.post('/data/import', { data }).then(r => r.data),
};

// App Settings / Branding
export const settingsApi = {
  get: () => api.get('/settings').then(r => r.data),
  update: (data: any) => api.put('/settings', data).then(r => r.data),
  uploadLogo: async (file: File) => {
    const form = new FormData();
    form.append('logo', file);
    const response = await fetch('/api/settings/logo', {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (!response.ok) throw { response: { data: await response.json() } };
    return response.json();
  },
  deleteLogo: () => api.delete('/settings/logo').then(r => r.data),
};

// Protocols
export const protocolApi = {
  list: () => api.get('/protocols').then(r => r.data),
  get: (id: string) => api.get(`/protocols/${id}`).then(r => r.data),
  update: (id: string, data: any) => api.put(`/protocols/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/protocols/${id}`),
  upload: async (file: File, meta: { title: string; date: string; eventId?: string; author?: string; notes?: string }) => {
    const form = new FormData();
    form.append('file', file);
    Object.entries(meta).forEach(([k, v]) => { if (v) form.append(k, v); });
    const response = await fetch('/api/protocols', {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (!response.ok) throw { response: { data: await response.json() } };
    return response.json();
  },
  downloadUrl: (id: string) => `/api/protocols/${id}/download`,
};

// Documents (separate from Protocols)
export const documentApi = {
  list: (params?: { category?: string; isPublic?: boolean }) => {
    const p: Record<string, string> = {};
    if (params?.category) p.category = params.category;
    if (params?.isPublic !== undefined) p.isPublic = String(params.isPublic);
    return api.get('/documents', { params: p }).then(r => r.data);
  },
  upload: async (file: File, meta: { title: string; category: string; isPublic: boolean; author?: string; notes?: string; date?: string }) => {
    const form = new FormData();
    form.append('file', file);
    form.append('title', meta.title);
    form.append('category', meta.category);
    form.append('isPublic', String(meta.isPublic));
    if (meta.author) form.append('author', meta.author);
    if (meta.notes) form.append('notes', meta.notes);
    if (meta.date) form.append('date', meta.date);
    const res = await fetch('/api/documents', {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (!res.ok) throw { response: { data: await res.json() } };
    return res.json();
  },
  delete: (id: string) => api.delete(`/documents/${id}`),
  downloadUrl: (id: string) => `/api/documents/${id}/download`,
  viewUrl: (id: string) => `/api/documents/${id}/view`,
};

// Fahrtenbuch
export const vehicleApi = {
  // Fahrzeuge
  listVehicles: () => api.get('/vehicles').then(r => r.data),
  getVehicle: (id: string) => api.get(`/vehicles/${id}`).then(r => r.data),
  createVehicle: (data: any) => api.post('/vehicles', data).then(r => r.data),
  updateVehicle: (id: string, data: any) => api.put(`/vehicles/${id}`, data).then(r => r.data),
  deleteVehicle: (id: string) => api.delete(`/vehicles/${id}`),
  uploadPhoto: async (id: string, file: File) => {
    const form = new FormData();
    form.append('photo', file);
    const res = await fetch(`/api/vehicles/${id}/photo`, {
      method: 'POST', credentials: 'include',
      body: form,
    });
    if (!res.ok) throw await res.json();
    return res.json();
  },
  deletePhoto: (id: string) => api.delete(`/vehicles/${id}/photo`),
  // Fahrten
  listTrips: (params?: Record<string, string>) => api.get('/vehicles/trips', { params }).then(r => r.data),
  createTrip: (data: any) => api.post('/vehicles/trips', data).then(r => r.data),
  updateTrip: (id: string, data: any) => api.put(`/vehicles/trips/${id}`, data).then(r => r.data),
  deleteTrip: (id: string) => api.delete(`/vehicles/trips/${id}`),
  // Tanken
  listFuel: (params?: Record<string, string>) => api.get('/vehicles/fuel', { params }).then(r => r.data),
  createFuel: (data: any) => api.post('/vehicles/fuel', data).then(r => r.data),
  updateFuel: (id: string, data: any) => api.put(`/vehicles/fuel/${id}`, data).then(r => r.data),
  deleteFuel: (id: string) => api.delete(`/vehicles/fuel/${id}`),
  // Wartung
  listMaintenance: (params?: Record<string, string>) => api.get('/vehicles/maintenance', { params }).then(r => r.data),
  createMaintenance: (data: any) => api.post('/vehicles/maintenance', data).then(r => r.data),
  updateMaintenance: (id: string, data: any) => api.put(`/vehicles/maintenance/${id}`, data).then(r => r.data),
  deleteMaintenance: (id: string) => api.delete(`/vehicles/maintenance/${id}`),
  // Stats
  getStats: () => api.get('/vehicles/stats').then(r => r.data),
};

// Gerätebuch
export const equipmentApi = {
  list: () => api.get('/equipment').then(r => r.data),
  get: (id: string) => api.get(`/equipment/${id}`).then(r => r.data),
  create: (data: any) => api.post('/equipment', data).then(r => r.data),
  update: (id: string, data: any) => api.put(`/equipment/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/equipment/${id}`),
  getStats: () => api.get('/equipment/stats').then(r => r.data),
  uploadPhoto: async (id: string, file: File) => {
    const form = new FormData();
    form.append('photo', file);
    const res = await fetch(`/api/equipment/${id}/photo`, {
      method: 'POST', credentials: 'include',
      body: form,
    });
    if (!res.ok) throw await res.json();
    return res.json();
  },
  deletePhoto: (id: string) => api.delete(`/equipment/${id}/photo`),
  // Prüfungen
  listChecks: (equipmentId?: string) => api.get('/equipment/checks', { params: equipmentId ? { equipmentId } : {} }).then(r => r.data),
  createCheck: (data: any) => api.post('/equipment/checks', data).then(r => r.data),
  updateCheck: (id: string, data: any) => api.put(`/equipment/checks/${id}`, data).then(r => r.data),
  deleteCheck: (id: string) => api.delete(`/equipment/checks/${id}`),
  // Reparaturen
  listRepairs: (equipmentId?: string) => api.get('/equipment/repairs', { params: equipmentId ? { equipmentId } : {} }).then(r => r.data),
  createRepair: (data: any) => api.post('/equipment/repairs', data).then(r => r.data),
  updateRepair: (id: string, data: any) => api.put(`/equipment/repairs/${id}`, data).then(r => r.data),
  deleteRepair: (id: string) => api.delete(`/equipment/repairs/${id}`),
  // Defekte
  listDefects: (equipmentId?: string) => api.get('/equipment/defects', { params: equipmentId ? { equipmentId } : {} }).then(r => r.data),
  createDefect: (data: any) => api.post('/equipment/defects', data).then(r => r.data),
  updateDefect: (id: string, data: any) => api.put(`/equipment/defects/${id}`, data).then(r => r.data),
  deleteDefect: (id: string) => api.delete(`/equipment/defects/${id}`),
  // Ausgaben
  listLoans: (equipmentId?: string) => api.get('/equipment/loans', { params: equipmentId ? { equipmentId } : {} }).then(r => r.data),
  createLoan: (data: any) => api.post('/equipment/loans', data).then(r => r.data),
  returnLoan: (id: string) => api.put(`/equipment/loans/${id}/return`).then(r => r.data),
  deleteLoan: (id: string) => api.delete(`/equipment/loans/${id}`),
};

export const kommandoTerminApi = {
  list: () => api.get('/kommando-termine').then(r => r.data),
  get: (id: string) => api.get(`/kommando-termine/${id}`).then(r => r.data),
  create: (data: any) => api.post('/kommando-termine', data).then(r => r.data),
  update: (id: string, data: any) => api.put(`/kommando-termine/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/kommando-termine/${id}`),
  updateAttendance: (id: string, memberId: string, status: string) =>
    api.put(`/kommando-termine/${id}/attendance`, { memberId, status }).then(r => r.data),
  deleteAttendance: (id: string, memberId: string) =>
    api.delete(`/kommando-termine/${id}/attendance/${memberId}`),
};
