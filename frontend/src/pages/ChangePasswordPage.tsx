import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import toast from 'react-hot-toast';
import { KeyRound, Eye, EyeOff, ArrowLeft } from 'lucide-react';

const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      toast.error('Neue Passwörter stimmen nicht überein');
      return;
    }
    if (form.newPassword.length < 8) {
      toast.error('Neues Passwort muss mindestens 8 Zeichen haben');
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword(form.currentPassword, form.newPassword);
      toast.success('Passwort erfolgreich geändert');
      navigate('/');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Fehler beim Ändern des Passworts');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/settings')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Passwort ändern</h1>
      </div>

      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-fire-100 rounded-full flex items-center justify-center">
            <KeyRound className="h-6 w-6 text-fire-600" />
          </div>
          <p className="text-sm text-gray-500">Bitte gib dein aktuelles Passwort ein und wähle ein neues.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Aktuelles Passwort */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Aktuelles Passwort</label>
            <div className="relative">
              <input
                type={show.current ? 'text' : 'password'}
                className="input-field pr-10"
                value={form.currentPassword}
                onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))}
                required
              />
              <button type="button" onClick={() => setShow(s => ({ ...s, current: !s.current }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {show.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Neues Passwort */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Neues Passwort</label>
            <div className="relative">
              <input
                type={show.new ? 'text' : 'password'}
                className="input-field pr-10"
                value={form.newPassword}
                onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
                required
              />
              <button type="button" onClick={() => setShow(s => ({ ...s, new: !s.new }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {show.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Bestätigung */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Neues Passwort bestätigen</label>
            <div className="relative">
              <input
                type={show.confirm ? 'text' : 'password'}
                className="input-field pr-10"
                value={form.confirmPassword}
                onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                required
              />
              <button type="button" onClick={() => setShow(s => ({ ...s, confirm: !s.confirm }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {show.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {form.newPassword && form.newPassword.length < 8 && (
            <p className="text-xs text-red-500">Mindestens 8 Zeichen erforderlich</p>
          )}
          {form.confirmPassword && form.newPassword !== form.confirmPassword && (
            <p className="text-xs text-red-500">Passwörter stimmen nicht überein</p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => navigate('/settings')} className="btn-secondary flex-1">Abbrechen</button>
            <button type="submit"
              disabled={saving || form.newPassword !== form.confirmPassword || form.newPassword.length < 8}
              className="btn-primary flex-1">
              {saving ? 'Speichern...' : 'Passwort ändern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
