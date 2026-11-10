import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarCheck, CheckCircle2, Clock, MonitorPlay, PhoneCall } from "lucide-react";
import { demoRequestSchema, type DemoRequestInput } from "@erp-software/shared";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { ErrorBanner } from "@/components/ui/States";
import { api } from "@/lib/api-client";
import { applyServerErrors } from "@/lib/utils";

const POINTS = [
  { icon: PhoneCall, text: "We call you back, usually the same working day." },
  { icon: MonitorPlay, text: "A 20-minute walk-through of billing, dues, stock and GST reports on your own items." },
  { icon: Clock, text: "Pick a time that suits your shop, before or after the rush." },
];

// "Book a quick demo" on the landing page. Only the phone number is required; requests go to the
// platform admin (saved, and emailed to PLATFORM_ADMIN_NOTIFY_EMAIL).
export function DemoRequestSection() {
  const [done, setDone] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DemoRequestInput>({
    resolver: zodResolver(demoRequestSchema),
    defaultValues: { name: "", mobile: "", email: "", website: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const res = await api.postWithMessage<null>("/platform/demo-requests", values);
      setDone(res.message ?? "Thanks! We'll call you soon to book your demo.");
      reset();
    } catch (err) {
      setFormError(applyServerErrors(err, setError));
    }
  });

  return (
    <section id="demo" className="scroll-mt-16 bg-canvas py-20 sm:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="eyebrow text-navy-600">Book a demo</p>
          <h2 className="mt-2 text-[1.75rem] leading-[2.25rem] font-bold tracking-[-0.01em] sm:text-[2rem] sm:leading-[2.5rem]">
            See it work for your shop in 20 minutes.
          </h2>
          <p className="mt-3 text-card text-slate">
            Leave your number and we'll show you how a day at your counter looks: a bill, a Pay later sale, a return and
            the GST report at the end of the month.
          </p>
          <ul className="mt-8 space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-input bg-yellow-100 text-yellow-700">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <p className="pt-1.5 text-body text-ink">{text}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-modal border border-border bg-surface p-6 shadow-menu sm:p-8">
          {done ? (
            <div role="status" className="py-6 text-center">
              <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden />
              <h3 className="mt-4 text-section font-semibold">Request received</h3>
              <p className="mt-2 text-body text-slate">{done}</p>
              <Button variant="outline" className="mt-6" onClick={() => setDone(null)}>
                Book another demo
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate>
              <div className="flex items-center gap-2">
                <CalendarCheck className="size-5 text-navy-600" aria-hidden />
                <h3 className="text-section font-semibold">Book a quick demo</h3>
              </div>
              <p className="mt-1 text-helper text-slate">Free, no obligation. Only your phone number is required.</p>

              {formError && <ErrorBanner className="mt-5" title="Couldn't send your request" message={formError} />}

              <div className="mt-6 space-y-4">
                <Field label="Name" error={errors.name?.message}>
                  {(p) => (
                    <Input {...p} autoComplete="name" maxLength={100} placeholder="Your name" {...register("name")} />
                  )}
                </Field>
                <Field label="Phone" required error={errors.mobile?.message}>
                  {(p) => (
                    <Input
                      {...p}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      maxLength={14}
                      placeholder="98765 43210"
                      {...register("mobile")}
                    />
                  )}
                </Field>
                <Field label="Email" error={errors.email?.message}>
                  {(p) => (
                    <Input
                      {...p}
                      type="email"
                      autoComplete="email"
                      maxLength={255}
                      placeholder="you@shop.in"
                      {...register("email")}
                    />
                  )}
                </Field>
                {/* Spam trap: hidden from people and screen readers; bots fill it in. */}
                <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden>
                  <label>
                    Website
                    <input tabIndex={-1} autoComplete="off" {...register("website")} />
                  </label>
                </div>
              </div>

              <Button
                type="submit"
                variant="accent"
                size="lg"
                className="mt-6 w-full"
                loading={isSubmitting}
                loadingText="Sending…"
              >
                Book my demo
              </Button>
              <p className="mt-3 text-center text-helper text-muted">
                We only use your details to call you about the demo.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
