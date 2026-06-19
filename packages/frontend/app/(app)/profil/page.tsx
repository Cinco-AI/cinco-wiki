"use client";

import { useState } from "react";
import {
  Check,
  FileText,
  Lock,
  MessageSquare,
  Star,
  UserRound,
} from "lucide-react";
import type { NoteImage } from "@cinco-wiki/shared";
import { api, ApiClientError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { fullName } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { ImageUploader } from "@/components/ImageUploader";
import { Spinner } from "@/components/Spinner";

export default function ProfilPage() {
  const { user, loading, refreshUser } = useAuth();

  // --- Profil ---
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileInit, setProfileInit] = useState(false);

  // --- Mot de passe ---
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  if (loading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Initialise les champs une fois l'utilisateur disponible.
  if (!profileInit) {
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setAvatarUrl(user.avatarUrl);
    setProfileInit(true);
  }

  // ImageUploader est piloté par `avatarUrl` (avatar = une seule image).
  const avatarImages: NoteImage[] = avatarUrl ? [{ url: avatarUrl, order: 0 }] : [];
  function onAvatarChange(imgs: NoteImage[]) {
    setAvatarUrl(imgs.length > 0 ? imgs[imgs.length - 1]!.url : null);
  }

  const previewUser = { ...user, firstName, lastName, avatarUrl };

  async function onSubmitProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfileSaved(false);
    setSavingProfile(true);
    try {
      await api.updateProfile({ firstName, lastName, avatarUrl });
      await refreshUser();
      setProfileSaved(true);
    } catch (err) {
      setProfileError(
        err instanceof ApiClientError
          ? err.message
          : "Impossible d'enregistrer le profil. Réessayez.",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function onSubmitPassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);
    if (newPassword !== confirmPassword) {
      setPasswordError("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }
    setSavingPassword(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setPasswordSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(
        err instanceof ApiClientError && (err.status === 401 || err.status === 403)
          ? "Mot de passe actuel incorrect."
          : "Impossible de modifier le mot de passe. Réessayez.",
      );
    } finally {
      setSavingPassword(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";
  const labelCls = "mb-1 block text-sm font-medium text-gray-700";

  const stats = [
    { label: "Notes", value: user.stats.notesCount, icon: FileText },
    { label: "Commentaires", value: user.stats.commentsCount, icon: MessageSquare },
    { label: "Votes", value: user.stats.votesCount, icon: Star },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8">
      {/* En-tête */}
      <header className="flex items-center gap-4">
        <Avatar user={previewUser} size="lg" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{fullName(user)}</h1>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
      </header>

      {/* Statistiques */}
      <section className="grid grid-cols-3 gap-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1 rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm"
          >
            <Icon className="h-5 w-5 text-brand-500" aria-hidden="true" />
            <span className="text-2xl font-bold text-gray-900">{value}</span>
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </section>

      {/* Profil */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <UserRound className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-gray-900">Mon profil</h2>
        </div>

        <form onSubmit={onSubmitProfile} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName" className={labelCls}>
                Prénom
              </label>
              <input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="lastName" className={labelCls}>
                Nom
              </label>
              <input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <span className={labelCls}>Photo de profil</span>
            <ImageUploader images={avatarImages} onChange={onAvatarChange} />
            <div className="mt-3">
              <label htmlFor="avatarUrl" className="mb-1 block text-xs text-gray-500">
                …ou collez une URL d'image
              </label>
              <input
                id="avatarUrl"
                type="url"
                placeholder="https://…"
                value={avatarUrl ?? ""}
                onChange={(e) => setAvatarUrl(e.target.value || null)}
                className={inputCls}
              />
            </div>
          </div>

          {profileError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {profileError}
            </p>
          )}
          {profileSaved && (
            <p className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              <Check className="h-4 w-4" aria-hidden="true" />
              Profil enregistré.
            </p>
          )}

          <button
            type="submit"
            disabled={savingProfile}
            className="rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {savingProfile ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>
      </section>

      {/* Mot de passe */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Lock className="h-5 w-5 text-brand-600" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-gray-900">Changer de mot de passe</h2>
        </div>

        <form onSubmit={onSubmitPassword} className="space-y-4">
          <div>
            <label htmlFor="currentPassword" className={labelCls}>
              Mot de passe actuel
            </label>
            <input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="newPassword" className={labelCls}>
                Nouveau mot de passe
              </label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className={labelCls}>
                Confirmer
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {passwordError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {passwordError}
            </p>
          )}
          {passwordSaved && (
            <p className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              <Check className="h-4 w-4" aria-hidden="true" />
              Mot de passe modifié.
            </p>
          )}

          <button
            type="submit"
            disabled={savingPassword}
            className="rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {savingPassword ? "Modification…" : "Modifier le mot de passe"}
          </button>
        </form>
      </section>
    </main>
  );
}
