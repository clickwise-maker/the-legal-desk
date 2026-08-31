import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card } from "@/components/ui";
import { formatDateTime } from "@/lib/constants";

export const metadata = { title: "ScheduleAI — LegalFlow" };

export default async function ScheduleAIPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/scheduleai");

  const [eventTypes, bookings, availability] = await Promise.all([
    // Reuse existing Booking as ScheduleAI bookings for now — in full integration, this would be ScheduleEventType
    prisma.booking.findMany({
      where: { clientId: session.user.id },
      orderBy: { startTime: "desc" },
      take: 5,
      include: { lawyer: { select: { name: true } } },
    }),
    prisma.booking.findMany({
      where: { clientId: session.user.id },
      orderBy: { startTime: "desc" },
      take: 5,
      include: { lawyer: { select: { name: true } } },
    }),
    prisma.availability.findMany({
      where: { lawyerProfile: { userId: session.user.id } },
      orderBy: { dayOfWeek: "asc" },
    }),
  ]);

  // Mock event types for ScheduleAI — in real integration, these would come from ScheduleEventType model
  const mockEventTypes = [
    { id: "1", title: "30 Minute Consultation", duration: 30, description: "Quick legal consultation" },
    { id: "2", title: "60 Minute Deep Dive", duration: 60, description: "Detailed case review" },
    { id: "3", title: "15 Minute Follow-up", duration: 15, description: "Quick follow-up" },
  ];

  return (
    <div className="container-legal py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-primary-800">ScheduleAI</h1>
            <p className="mt-2 text-legal-muted">Your scheduling hub — event types, availability, and bookings, inside LegalFlow.</p>
          </div>
          <Link href="/dashboard" className="btn-outline">Back to Dashboard</Link>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <h2 className="font-heading text-lg font-bold text-primary-800">Event Types</h2>
              <p className="mt-1 text-sm text-legal-muted">Manage your scheduling templates — powered by ScheduleAI engine, styled for LegalFlow.</p>
              <div className="mt-4 space-y-3">
                {mockEventTypes.map((et) => (
                  <div key={et.id} className="flex items-center justify-between rounded-lg border border-primary-100 p-4">
                    <div>
                      <div className="font-semibold text-primary-800">{et.title}</div>
                      <div className="text-sm text-legal-muted">{et.duration} min · {et.description}</div>
                    </div>
                    <span className="badge bg-gold-50 text-gold-600">Active</span>
                  </div>
                ))}
              </div>
              <Link href="/scheduleai" className="btn-primary mt-4 w-full">Create Event Type</Link>
            </Card>

            <Card className="p-6">
              <h2 className="font-heading text-lg font-bold text-primary-800">Availability</h2>
              <p className="mt-1 text-sm text-legal-muted">Your weekly schedule — synced with LegalFlow availability.</p>
              <div className="mt-4">
                {availability.length === 0 ? (
                  <p className="text-sm text-legal-muted">No availability set. <Link href="/profile" className="text-gold-500 hover:underline">Set in Profile</Link></p>
                ) : (
                  <ul className="space-y-2">
                    {availability.map((a) => (
                      <li key={a.id} className="flex justify-between text-sm">
                        <span className="text-legal-muted">Day {a.dayOfWeek}</span>
                        <span className="font-medium text-primary-800">{a.startMinute} - {a.endMinute} min</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="font-heading font-bold text-primary-800">Upcoming Bookings</h3>
              {bookings.length === 0 ? (
                <p className="mt-3 text-sm text-legal-muted">No bookings yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {bookings.slice(0, 3).map((b) => (
                    <li key={b.id} className="rounded-lg border border-primary-100 p-3">
                      <div className="font-medium text-primary-800">{b.title}</div>
                      <div className="text-xs text-legal-muted">{formatDateTime(b.startTime)} · {b.lawyer.name}</div>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/dashboard#upcoming" className="btn-outline mt-4 w-full">View All</Link>
            </Card>

            <Card className="p-6 bg-primary-50">
              <h3 className="font-heading font-bold text-primary-800">LegalFlow + ScheduleAI</h3>
              <p className="mt-2 text-sm text-legal-muted">Same login, same header, same design — scheduling, now native inside LegalFlow.</p>
              <div className="mt-3 flex gap-2">
                <Link href="/lawyers" className="btn-primary flex-1 text-center">Find Lawyer</Link>
                <Link href="/forms" className="btn-outline flex-1 text-center">Fill Form</Link>
              </div>
            </Card>
          </div>
        </div>

        <div className="mt-8 rounded-lg bg-white p-4 text-center text-xs text-legal-muted">
          ScheduleAI engine by Cal.com (MIT) — integrated natively into LegalFlow. No separate login, no external redirect.
        </div>
      </div>
    </div>
  );
}
