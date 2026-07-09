"use client";

import { getInitials, getAvatarColor } from "@/lib/avatar";
import { cn } from "@/lib/utils";

export type OrgUser = { id: string; firstName: string; lastName: string; email: string; image?: string | null };

const SIZES = { sm: "size-6 text-[10px]", md: "size-[30px] text-xs", lg: "size-10 text-sm" };

export function OrgAvatar({
  user,
  size = "md",
  className,
}: {
  user: OrgUser;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const title = `${user.firstName} ${user.lastName}`;
  if (user.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.image}
        alt={title}
        title={title}
        className={cn(
          "shrink-0 rounded-full object-cover ring-2 ring-background select-none",
          SIZES[size],
          className
        )}
      />
    );
  }
  return (
    <span
      title={title}
      style={{ backgroundColor: getAvatarColor(user.id) }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-background select-none",
        SIZES[size],
        className
      )}
    >
      {getInitials(user.firstName, user.lastName)}
    </span>
  );
}

/** Overlapping stack, capped, with +N overflow bubble. */
export function OrgAvatarStack({ users, max = 3 }: { users: OrgUser[]; max?: number }) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <span className="flex -space-x-1.5">
      {shown.map((u) => (
        <OrgAvatar key={u.id} user={u} size="sm" />
      ))}
      {extra > 0 && (
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-background">
          +{extra}
        </span>
      )}
    </span>
  );
}
