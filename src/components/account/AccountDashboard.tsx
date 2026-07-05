"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
import {
  changePassword,
  deleteAccount,
  updateProfile,
} from "@/app/_actions/account";
import {
  AVATARS,
  type AvatarId,
  getAvatarUrlById,
  resolveAvatarId,
} from "@/app/_lib/account/avatars";
import { formatEuroAmount } from "@/app/_lib/bookings/money";
import {
  AdminFormFeedback,
  adminButtonClassName,
  adminInputClassName,
  adminLabelClassName,
  adminSecondaryButtonClassName,
} from "@/components/admin/AdminFormFeedback";
import { CancelMyBookingButton } from "@/components/account/CancelMyBookingButton";

type AccountBookingStatus =
  | "PENDING"
  | "DEPOSIT_PAID"
  | "PAID"
  | "CANCELLED"
  | "COMPLETED"
  | "PAYMENT_CONFLICT_REFUND_REQUIRED";

type AccountBookingCancellationKind =
  | "FREE_CANCEL"
  | "REFUND_ELIGIBLE"
  | "PAST_CUTOFF"
  | "MANUAL_REVIEW"
  | "NOT_CANCELLABLE";

type AccountBookingCancellation = {
  kind: AccountBookingCancellationKind;
  refundCutoffAt: string | null;
};

const STATUS_LABELS: Record<AccountBookingStatus, string> = {
  PENDING: "In attesa",
  DEPOSIT_PAID: "Caparra pagata",
  PAID: "Pagata",
  CANCELLED: "Annullata",
  COMPLETED: "Completata",
  PAYMENT_CONFLICT_REFUND_REQUIRED: "Conflitto pagamento",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "medium",
  timeStyle: "short",
});

export type AccountBooking = {
  id: string;
  startTime: string;
  endTime: string;
  totalAmount: string;
  status: AccountBookingStatus;
  holdExpiresAt: string | null;
  room: {
    name: string;
    slug: string;
  };
  cancellation: AccountBookingCancellation;
};

type AccountDashboardProps = {
  user: {
    name: string;
    email: string;
    phone: string;
    image: string | null;
  };
  bookings: AccountBooking[];
};

function AccountSection({
  title,
  description,
  children,
  danger,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={`rounded-md border p-6 ${
        danger ? "border-blood/40 bg-blood/5" : "border-void-mist bg-void-deep"
      }`}
    >
      <h2
        className={`font-[family-name:var(--font-display)] text-2xl ${
          danger ? "text-blood-bright" : "text-blood-bright"
        }`}
      >
        {title}
      </h2>
      {description ? (
        <p className="mt-2 text-sm text-bone/60">{description}</p>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function ProfileSection({
  user,
}: {
  user: AccountDashboardProps["user"];
}) {
  const [state, formAction, pending] = useActionState(updateProfile, null);
  const [selectedAvatarId, setSelectedAvatarId] = useState<AvatarId>(() =>
    resolveAvatarId(user.image),
  );
  const [name, setName] = useState(user.name);

  return (
    <AccountSection
      title="Profilo"
      description="Scegli un avatar e aggiorna i tuoi dati."
    >
      <form action={formAction} className="flex flex-col gap-4">
        <fieldset>
          <legend className="mb-3 text-sm text-bone/80">Avatar</legend>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            {AVATARS.map((avatar) => (
              <label
                key={avatar.id}
                className={`cursor-pointer rounded border p-1 transition-colors ${
                  selectedAvatarId === avatar.id
                    ? "border-blood bg-blood/10"
                    : "border-void-mist hover:border-bone/30"
                }`}
              >
                <input
                  type="radio"
                  name="avatarId"
                  value={avatar.id}
                  checked={selectedAvatarId === avatar.id}
                  onChange={() => setSelectedAvatarId(avatar.id)}
                  className="sr-only"
                />
                <Image
                  src={avatar.url}
                  alt={avatar.label}
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded"
                />
                <span className="mt-1 block text-center text-[10px] text-bone/60">
                  {avatar.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className={adminLabelClassName}>
          Nome
          <input
            type="text"
            name="name"
            required
            minLength={2}
            maxLength={32}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={adminInputClassName}
          />
        </label>

        <label className={adminLabelClassName}>
          Telefono
          <input
            type="tel"
            name="phone"
            required
            minLength={10}
            maxLength={20}
            defaultValue={user.phone}
            className={adminInputClassName}
          />
        </label>

        <label className={adminLabelClassName}>
          Email
          <input
            type="email"
            value={user.email}
            readOnly
            className={`${adminInputClassName} cursor-not-allowed opacity-70`}
          />
        </label>

        <div className="flex items-center gap-3 rounded border border-void-mist bg-void px-3 py-3">
          <Image
            src={getAvatarUrlById(selectedAvatarId)}
            alt="Anteprima avatar"
            width={48}
            height={48}
            className="h-12 w-12 rounded"
          />
          <div>
            <p className="text-sm text-bone/60">Anteprima</p>
            <p className="text-bone">{name}</p>
          </div>
        </div>

        <AdminFormFeedback state={state} />

        <button type="submit" disabled={pending} className={adminButtonClassName}>
          {pending ? "Salvataggio…" : "Salva profilo"}
        </button>
      </form>
    </AccountSection>
  );
}

function CancellationAction({ booking }: { booking: AccountBooking }) {
  const { kind, refundCutoffAt } = booking.cancellation;

  if (kind === "FREE_CANCEL") {
    return <CancelMyBookingButton bookingId={booking.id} variant="free" />;
  }

  if (kind === "REFUND_ELIGIBLE") {
    return (
      <div className="flex flex-col gap-1">
        <CancelMyBookingButton bookingId={booking.id} variant="refund" />
        {refundCutoffAt ? (
          <p className="text-[11px] text-bone/50">
            Rimborsabile entro il {DATE_FORMATTER.format(new Date(refundCutoffAt))}
          </p>
        ) : null}
      </div>
    );
  }

  if (kind === "PAST_CUTOFF") {
    return (
      <p className="max-w-[16rem] text-[11px] text-bone/50">
        Non annullabile entro 48h dall&apos;evento. Contattaci per assistenza.
      </p>
    );
  }

  if (kind === "MANUAL_REVIEW") {
    return (
      <p className="max-w-[16rem] text-[11px] text-bone/50">
        Contattaci per questa prenotazione.
      </p>
    );
  }

  return null;
}

function OrdersSection({ bookings }: { bookings: AccountBooking[] }) {
  const now = Date.now();

  return (
    <AccountSection
      title="I miei ordini"
      description="Le tue prenotazioni passate e in corso."
    >
      {bookings.length === 0 ? (
        <p className="text-sm text-bone/60">
          Non hai ancora prenotazioni.{" "}
          <Link href="/rooms" className="underline decoration-blood underline-offset-4">
            Sfoglia le stanze
          </Link>
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-void-mist text-bone/60">
              <tr>
                <th className="px-2 py-2 font-normal">Stanza</th>
                <th className="px-2 py-2 font-normal">Data e ora</th>
                <th className="px-2 py-2 font-normal">Stato</th>
                <th className="px-2 py-2 font-normal">Importo</th>
                <th className="px-2 py-2 font-normal" />
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => {
                const canCheckout =
                  booking.status === "PENDING" &&
                  !!booking.holdExpiresAt &&
                  new Date(booking.holdExpiresAt).getTime() > now;

                return (
                  <tr key={booking.id} className="border-b border-void-mist/60">
                    <td className="px-2 py-3 text-bone">{booking.room.name}</td>
                    <td className="px-2 py-3 text-bone/80">
                      {DATE_FORMATTER.format(new Date(booking.startTime))}
                    </td>
                    <td className="px-2 py-3 text-bone/80">
                      {STATUS_LABELS[booking.status]}
                    </td>
                    <td className="px-2 py-3 text-bone/80">
                      € {formatEuroAmount(booking.totalAmount)}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex flex-col gap-2">
                        {canCheckout ? (
                          <Link
                            href={`/checkout?bookingId=${booking.id}`}
                            className={adminSecondaryButtonClassName}
                          >
                            Completa pagamento
                          </Link>
                        ) : null}
                        <CancellationAction booking={booking} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AccountSection>
  );
}

function SecuritySection() {
  const [state, formAction, pending] = useActionState(changePassword, null);

  return (
    <AccountSection
      title="Sicurezza"
      description="Aggiorna la password del tuo account."
    >
      <form action={formAction} className="flex max-w-md flex-col gap-4">
        <label className={adminLabelClassName}>
          Password attuale
          <input
            type="password"
            name="currentPassword"
            required
            autoComplete="current-password"
            className={adminInputClassName}
          />
        </label>

        <label className={adminLabelClassName}>
          Nuova password
          <input
            type="password"
            name="newPassword"
            required
            minLength={8}
            autoComplete="new-password"
            className={adminInputClassName}
          />
        </label>

        <AdminFormFeedback state={state} />

        <button type="submit" disabled={pending} className={adminButtonClassName}>
          {pending ? "Aggiornamento…" : "Cambia password"}
        </button>
      </form>
    </AccountSection>
  );
}

function DeleteAccountSection({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(deleteAccount, null);

  return (
    <AccountSection
      title="Elimina account"
      description="Questa azione è irreversibile. Non puoi eliminare l'account se hai prenotazioni attive o pagate."
      danger
    >
      <form action={formAction} className="flex max-w-md flex-col gap-4">
        <label className={adminLabelClassName}>
          Conferma la tua email
          <input
            type="email"
            name="confirmEmail"
            required
            autoComplete="email"
            placeholder={email}
            className={adminInputClassName}
          />
        </label>

        <label className={adminLabelClassName}>
          Password
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className={adminInputClassName}
          />
        </label>

        <AdminFormFeedback state={state} />

        <button
          type="submit"
          disabled={pending}
          className="rounded bg-blood px-4 py-2 text-sm text-bone transition-colors hover:bg-blood-bright disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Eliminazione…" : "Elimina il mio account"}
        </button>
      </form>
    </AccountSection>
  );
}

export function AccountDashboard({ user, bookings }: AccountDashboardProps) {
  return (
    <div className="flex flex-col gap-8">
      <ProfileSection user={user} />
      <OrdersSection bookings={bookings} />
      <SecuritySection />
      <DeleteAccountSection email={user.email} />
    </div>
  );
}
