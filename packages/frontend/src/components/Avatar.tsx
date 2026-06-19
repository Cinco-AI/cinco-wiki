import type { UserPublic } from "@cinco-wiki/shared";
import { fullName, initials } from "@/lib/format";
import { cn } from "@/lib/cn";

interface AvatarProps {
  user: UserPublic;
  size?: "sm" | "md" | "lg";
}

const SIZE: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-lg",
};

/** Photo de profil ou initiales sur fond brand (§4.2). */
export function Avatar({ user, size = "md" }: AvatarProps) {
  const name = fullName(user);
  const base = cn(
    "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold",
    SIZE[size],
  );

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={name}
        className={cn(base, "object-cover")}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={cn(base, "bg-brand-100 text-brand-700")}
    >
      {initials(user)}
    </span>
  );
}
