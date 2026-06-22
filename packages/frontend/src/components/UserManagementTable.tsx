"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import type {
  CreateUserInput,
  UserAdmin,
  UserRole,
  UserStatus,
  UserWithTempPassword,
} from "@cinco-wiki/shared";
import { LIMITS } from "@cinco-wiki/shared";
import { api, ApiClientError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { fullName } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/Avatar";
import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";

const PAGE_SIZE = 10;

const ROLE_LABEL: Record<UserRole, string> = {
  user: "Utilisateur",
  admin: "Administrateur",
};

const STATUS_LABEL: Record<UserStatus, string> = {
  active: "Actif",
  disabled: "Désactivé",
};

type ModalState =
  | { type: "create" }
  | { type: "edit"; user: UserAdmin }
  | { type: "delete"; user: UserAdmin }
  | { type: "tempPassword"; data: UserWithTempPassword }
  | null;

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Gestion des utilisateurs (admin, §3.2) : table paginée + CRUD. */
export function UserManagementTable() {
  const { user: currentUser } = useAuth();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalState>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Recherche avec debounce (§ LIMITS.searchDebounceMs).
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), LIMITS.searchDebounceMs);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => setPage(1), [debounced]);

  const { data, error, isLoading, mutate } = useSWR(
    ["users", debounced] as const,
    () => api.listUsers(debounced || undefined),
  );

  const items = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? items.length;
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function toggleStatus(target: UserAdmin) {
    const next: UserStatus = target.status === "active" ? "disabled" : "active";
    setBusyId(target.id);
    setActionError(null);
    try {
      await api.updateUser(target.id, { status: next });
      await mutate();
    } catch (err) {
      setActionError(errorMessage(err, "Le changement de statut a échoué. Réessayez."));
    } finally {
      setBusyId(null);
    }
  }

  async function resetPassword(target: UserAdmin) {
    setBusyId(target.id);
    setActionError(null);
    try {
      const result = await api.resetUserPassword(target.id);
      await mutate();
      setModal({ type: "tempPassword", data: result });
    } catch (err) {
      setActionError(errorMessage(err, "La réinitialisation a échoué. Réessayez."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">
          {total} compte{total > 1 ? "s" : ""} au total.
        </p>
        <button
          type="button"
          onClick={() => setModal({ type: "create" })}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
        >
          <Plus className="h-5 w-5" aria-hidden />
          Créer un utilisateur
        </button>
      </header>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou e-mail…"
          aria-label="Rechercher un utilisateur"
          className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:max-w-md"
        />
      </div>

      {actionError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" label="Chargement des utilisateurs…" />
        </div>
      ) : error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-3 text-sm text-red-700">
          Impossible de charger la liste des utilisateurs.
        </p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Users}
          title={debounced ? "Aucun résultat" : "Aucun utilisateur"}
          description={
            debounced
              ? "Aucun compte ne correspond à votre recherche."
              : "Créez le premier compte pour démarrer."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Nom</th>
                  <th scope="col" className="px-4 py-3 font-semibold">E-mail</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Rôle</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Statut</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Créé le</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageItems.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="transition hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar user={u} size="sm" />
                          <span className="font-medium text-gray-900">
                            {fullName(u)}
                            {isSelf && (
                              <span className="ml-1.5 text-xs font-normal text-gray-400">
                                (vous)
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{u.email}</td>
                      <td className="px-4 py-3">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        <time
                          dateTime={u.createdAt}
                          title={new Date(u.createdAt).toLocaleString("fr-FR")}
                        >
                          {formatDate(u.createdAt)}
                        </time>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <RowActions
                          user={u}
                          isSelf={isSelf}
                          busy={busyId === u.id}
                          onEdit={() => setModal({ type: "edit", user: u })}
                          onDelete={() => setModal({ type: "delete", user: u })}
                          onToggleStatus={() => toggleStatus(u)}
                          onResetPassword={() => resetPassword(u)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {items.length > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-sm text-gray-600">
              <span aria-live="polite">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, items.length)} sur{" "}
                {items.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label="Page précédente"
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-medium transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  Précédent
                </button>
                <span className="px-2 tabular-nums text-gray-500">
                  {page} / {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={page >= pageCount}
                  aria-label="Page suivante"
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-medium transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {modal?.type === "create" && (
        <CreateUserModal
          onClose={() => setModal(null)}
          onCreated={() => {
            void mutate();
            setModal(null);
          }}
        />
      )}
      {modal?.type === "edit" && (
        <EditUserModal
          user={modal.user}
          onClose={() => setModal(null)}
          onSaved={() => {
            void mutate();
            setModal(null);
          }}
        />
      )}
      {modal?.type === "delete" && (
        <DeleteUserModal
          user={modal.user}
          onClose={() => setModal(null)}
          onDeleted={() => {
            void mutate();
            setModal(null);
          }}
        />
      )}
      {modal?.type === "tempPassword" && (
        <TempPasswordModal data={modal.data} onClose={() => setModal(null)} />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        role === "admin"
          ? "bg-brand-100 text-brand-700"
          : "bg-gray-100 text-gray-600",
      )}
    >
      {role === "admin" && <ShieldCheck className="h-3.5 w-3.5" aria-hidden />}
      {ROLE_LABEL[role]}
    </span>
  );
}

function StatusBadge({ status }: { status: UserStatus }) {
  const active = status === "active";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500",
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-green-500" : "bg-gray-400")}
        aria-hidden
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Menu d'actions par ligne
// ---------------------------------------------------------------------------

function RowActions({
  user,
  isSelf,
  busy,
  onEdit,
  onDelete,
  onToggleStatus,
  onResetPassword,
}: {
  user: UserAdmin;
  isSelf: boolean;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  onResetPassword: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function run(action: () => void) {
    setOpen(false);
    action();
  }

  const disabling = user.status === "active";

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions pour ${fullName(user)}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <MoreVertical className="h-4 w-4" aria-hidden />
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`Actions pour ${fullName(user)}`}
          className="absolute right-0 z-20 mt-1 w-52 origin-top-right overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-lg animate-scale-in focus:outline-none"
        >
          <MenuItem icon={Pencil} onClick={() => run(onEdit)}>
            Modifier
          </MenuItem>
          <MenuItem icon={KeyRound} onClick={() => run(onResetPassword)}>
            Réinitialiser le mot de passe
          </MenuItem>
          <MenuItem
            icon={disabling ? UserX : UserCheck}
            disabled={isSelf}
            title={isSelf ? "Vous ne pouvez pas modifier votre propre statut." : undefined}
            onClick={() => run(onToggleStatus)}
          >
            {disabling ? "Désactiver" : "Réactiver"}
          </MenuItem>
          <div className="my-1 border-t border-gray-100" />
          <MenuItem
            icon={Trash2}
            tone="danger"
            disabled={isSelf}
            title={isSelf ? "Vous ne pouvez pas supprimer votre propre compte." : undefined}
            onClick={() => run(onDelete)}
          >
            Supprimer
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  children,
  onClick,
  disabled = false,
  tone = "default",
  title,
}: {
  icon: typeof Pencil;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
  title?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-medium transition focus:outline-none focus-visible:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40",
        tone === "danger"
          ? "text-red-600 hover:bg-red-50"
          : "text-gray-700 hover:bg-gray-50",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Champs de formulaire partagés
// ---------------------------------------------------------------------------

const FIELD_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
    </div>
  );
}

function ModalActions({
  busy,
  submitLabel,
  onCancel,
  tone = "brand",
}: {
  busy: boolean;
  submitLabel: string;
  onCancel: () => void;
  tone?: "brand" | "danger";
}) {
  return (
    <div className="mt-2 flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="rounded-lg px-4 py-2 font-medium text-gray-600 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 disabled:opacity-60"
      >
        Annuler
      </button>
      <button
        type="submit"
        disabled={busy}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200 disabled:opacity-60",
          tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-brand-600 hover:bg-brand-700",
        )}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {submitLabel}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modale : créer
// ---------------------------------------------------------------------------

function CreateUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<CreateUserInput>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "user",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createUser({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      });
      onCreated();
    } catch (err) {
      setError(errorMessage(err, "La création du compte a échoué. Réessayez."));
      setBusy(false);
    }
  }

  return (
    <Modal title="Créer un utilisateur" size="md" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="create-firstName" label="Prénom">
            <input
              id="create-firstName"
              required
              autoFocus
              value={form.firstName}
              onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              className={FIELD_CLASS}
            />
          </Field>
          <Field id="create-lastName" label="Nom">
            <input
              id="create-lastName"
              required
              value={form.lastName}
              onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              className={FIELD_CLASS}
            />
          </Field>
        </div>
        <Field id="create-email" label="Adresse e-mail">
          <input
            id="create-email"
            type="email"
            required
            autoComplete="off"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className={FIELD_CLASS}
          />
        </Field>
        <Field id="create-password" label="Mot de passe">
          <div className="relative">
            <input
              id="create-password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className={cn(FIELD_CLASS, "pr-10")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 transition hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" aria-hidden />
              ) : (
                <Eye className="h-5 w-5" aria-hidden />
              )}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            8 caractères minimum. Communiquez-le à l'utilisateur.
          </p>
        </Field>
        <Field id="create-role" label="Rôle">
          <select
            id="create-role"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
            className={FIELD_CLASS}
          >
            <option value="user">{ROLE_LABEL.user}</option>
            <option value="admin">{ROLE_LABEL.admin}</option>
          </select>
        </Field>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <ModalActions busy={busy} submitLabel="Créer le compte" onCancel={onClose} />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Modale : modifier
// ---------------------------------------------------------------------------

function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserAdmin;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<UserRole>(user.role);
  const [status, setStatus] = useState<UserStatus>(user.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.updateUser(user.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        role,
        status,
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err, "L'enregistrement a échoué. Réessayez."));
      setBusy(false);
    }
  }

  return (
    <Modal title={`Modifier ${fullName(user)}`} size="md" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="edit-firstName" label="Prénom">
            <input
              id="edit-firstName"
              required
              autoFocus
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={FIELD_CLASS}
            />
          </Field>
          <Field id="edit-lastName" label="Nom">
            <input
              id="edit-lastName"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={FIELD_CLASS}
            />
          </Field>
        </div>
        <Field id="edit-email" label="Adresse e-mail">
          <input
            id="edit-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={FIELD_CLASS}
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="edit-role" label="Rôle">
            <select
              id="edit-role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className={FIELD_CLASS}
            >
              <option value="user">{ROLE_LABEL.user}</option>
              <option value="admin">{ROLE_LABEL.admin}</option>
            </select>
          </Field>
          <Field id="edit-status" label="Statut">
            <select
              id="edit-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as UserStatus)}
              className={FIELD_CLASS}
            >
              <option value="active">{STATUS_LABEL.active}</option>
              <option value="disabled">{STATUS_LABEL.disabled}</option>
            </select>
          </Field>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <ModalActions busy={busy} submitLabel="Enregistrer" onCancel={onClose} />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Modale : supprimer
// ---------------------------------------------------------------------------

function DeleteUserModal({
  user,
  onClose,
  onDeleted,
}: {
  user: UserAdmin;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.deleteUser(user.id);
      onDeleted();
    } catch (err) {
      setError(errorMessage(err, "La suppression a échoué. Réessayez."));
      setBusy(false);
    }
  }

  return (
    <Modal title="Supprimer l'utilisateur" size="sm" onClose={onClose}>
      <form onSubmit={confirm} className="space-y-4">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </div>
          <p className="text-sm text-gray-600">
            Voulez-vous vraiment supprimer le compte de{" "}
            <strong className="font-semibold text-gray-900">{fullName(user)}</strong> ({user.email})
            ? Cette action est irréversible.
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <ModalActions
          busy={busy}
          submitLabel="Supprimer"
          tone="danger"
          onCancel={onClose}
        />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Modale : mot de passe temporaire (affiché une seule fois)
// ---------------------------------------------------------------------------

function TempPasswordModal({
  data,
  onClose,
}: {
  data: UserWithTempPassword;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(data.temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* presse-papiers indisponible */
    }
  }

  return (
    <Modal title="Mot de passe temporaire" size="md" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg bg-brand-50 px-3 py-3 text-sm text-brand-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
          <p>
            Ce mot de passe n'est affiché <strong>qu'une seule fois</strong>. Copiez-le et
            transmettez-le à{" "}
            <strong className="font-semibold">{fullName(data.user)}</strong> ({data.user.email}).
          </p>
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium text-gray-700">
            Mot de passe temporaire
          </span>
          <div className="flex items-center gap-2">
            <code className="flex-1 select-all break-all rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-sm text-gray-900">
              {data.temporaryPassword}
            </code>
            <button
              type="button"
              onClick={() => void copy()}
              aria-label="Copier le mot de passe"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-600" aria-hidden />
                  Copié
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden />
                  Copier
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
          >
            J'ai noté le mot de passe
          </button>
        </div>
      </div>
    </Modal>
  );
}
