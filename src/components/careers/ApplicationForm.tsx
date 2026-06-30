import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";



import { positions, storeLocationOptions } from "@/data/positions";
import {
  AvailabilityScheduler,
  defaultWeeklyAvailability,
  serializeAvailability,
  validateAvailability,
  type WeeklyAvailability,
} from "./AvailabilityScheduler";
import { ResumeDropzone } from "./ResumeDropzone";

const schema = z.object({
  firstName: z.string().trim().min(1, "Required").max(60),
  lastName: z.string().trim().min(1, "Required").max(60),
  email: z.string().trim().email("Invalid email").max(160),
  phone: z.string().trim().min(7, "Required").max(30),
  address: z.string().trim().min(1, "Required").max(160),
  city: z.string().trim().min(1, "Required").max(80),
  state: z.string().trim().min(2, "Required").max(40),
  zip: z.string().trim().min(3, "Required").max(15),
  position: z.string().min(1, "Required"),
  storeLocation: z.string().min(1, "Required"),
  employmentType: z.enum(["Full-Time", "Part-Time", "Either"]),
  startDate: z.string().min(1, "Required"),
  desiredWage: z.coerce.number().min(0).max(200),
  experience: z.string().trim().max(2000).optional().default(""),
  workAuthorized: z.enum(["Yes", "No"]),
  over18: z.enum(["Yes", "No"]),
  fit: z.string().trim().min(10, "Tell us a little more (min 10 chars)").max(2000),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  defaultPosition?: string;
}

export const ApplicationForm = ({ defaultPosition }: Props) => {
  const [availability, setAvailability] = useState<WeeklyAvailability>(defaultWeeklyAvailability());
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [resume, setResume] = useState<File | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ applicationId: string } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      position: defaultPosition ?? "",
      employmentType: "Either",
      workAuthorized: "Yes",
      over18: "Yes",
    },
  });

  const onSubmit = async (data: FormValues) => {
    const availErr = validateAvailability(availability);
    setAvailabilityError(availErr);
    if (!resume) {
      setResumeError("Please upload your resume.");
      return;
    }
    setResumeError(null);
    if (availErr) return;

    setSubmitting(true);
    try {
      const applicationId = `VTGM-${Date.now().toString(36).toUpperCase()}`;

      const fd = new FormData();
      fd.append("applicationId", applicationId);
      fd.append("submittedAt", new Date().toISOString());
      Object.entries(data).forEach(([k, v]) => fd.append(k, String(v ?? "")));
      fd.append("availabilitySummary", serializeAvailability(availability));
      fd.append("resume", resume, resume.name);

      const resp = await fetch("/api/submit-application", {
        method: "POST",
        body: fd,
      });
      const result = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(result?.error ?? `Request failed (${resp.status})`);

      setSubmitted({ applicationId });
      toast.success("Application submitted!");
      window.scrollTo({ top: document.getElementById("apply")?.offsetTop ?? 0, behavior: "smooth" });
    } catch (e) {
      console.error(e);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border bg-card-elevated p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-primary" />
        <h3 className="font-display text-2xl font-bold">Application Received!</h3>
        <p className="mt-2 text-muted-foreground">
          Thanks for applying to VT Gas & Market. Our hiring team will review your application and
          reach out if it's a fit.
        </p>
        <p className="mt-4 text-sm">
          Reference ID: <span className="font-mono font-semibold">{submitted.applicationId}</span>
        </p>
      </div>
    );
  }

  const employmentType = watch("employmentType");
  const workAuth = watch("workAuthorized");
  const over18 = watch("over18");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
      {/* Personal Information */}
      <section className="space-y-4">
        <h3 className="font-display text-xl font-bold">Personal Information</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="First Name" error={errors.firstName?.message}>
            <Input {...register("firstName")} />
          </Field>
          <Field label="Last Name" error={errors.lastName?.message}>
            <Input {...register("lastName")} />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" {...register("email")} />
          </Field>
          <Field label="Phone" error={errors.phone?.message}>
            <Input type="tel" {...register("phone")} />
          </Field>
          <Field label="Street Address" error={errors.address?.message} className="md:col-span-2">
            <Input {...register("address")} />
          </Field>
          <Field label="City" error={errors.city?.message}>
            <Input {...register("city")} />
          </Field>
          <Field label="State" error={errors.state?.message}>
            <Input {...register("state")} defaultValue="TX" />
          </Field>
          <Field label="ZIP" error={errors.zip?.message}>
            <Input {...register("zip")} />
          </Field>
        </div>
      </section>

      {/* Employment Information */}
      <section className="space-y-4">
        <h3 className="font-display text-xl font-bold">Employment Information</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Position Applying For" error={errors.position?.message}>
            <Select
              defaultValue={defaultPosition}
              onValueChange={(v) => setValue("position", v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a position" />
              </SelectTrigger>
              <SelectContent>
                {positions.map((p) => (
                  <SelectItem key={p.id} value={p.title}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Preferred Store Location" error={errors.storeLocation?.message}>
            <Select onValueChange={(v) => setValue("storeLocation", v, { shouldValidate: true })}>
              <SelectTrigger>
                <SelectValue placeholder="Select a location" />
              </SelectTrigger>
              <SelectContent>
                {storeLocationOptions.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Employment Type" error={errors.employmentType?.message} className="md:col-span-2">
            <RadioGroup
              value={employmentType}
              onValueChange={(v) => setValue("employmentType", v as FormValues["employmentType"])}
              className="flex flex-wrap gap-6"
            >
              {(["Full-Time", "Part-Time", "Either"] as const).map((v) => (
                <label key={v} className="flex items-center gap-2">
                  <RadioGroupItem value={v} id={`et-${v}`} />
                  <span>{v}</span>
                </label>
              ))}
            </RadioGroup>
          </Field>
        </div>
      </section>

      {/* Weekly Availability */}
      <section>
        <AvailabilityScheduler value={availability} onChange={setAvailability} />
        {availabilityError && <p className="mt-2 text-sm text-destructive">{availabilityError}</p>}
      </section>

      {/* Logistics */}
      <section className="space-y-4">
        <h3 className="font-display text-xl font-bold">Logistics</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Available Start Date" error={errors.startDate?.message}>
            <Input type="date" {...register("startDate")} />
          </Field>
          <Field label="Desired Hourly Wage (USD)" error={errors.desiredWage?.message}>
            <Input type="number" step="0.25" min="0" {...register("desiredWage")} />
          </Field>
          <Field label="Relevant Experience" className="md:col-span-2">
            <Textarea rows={4} {...register("experience")} placeholder="Briefly describe any relevant work experience." />
          </Field>
        </div>
      </section>

      {/* Eligibility */}
      <section className="space-y-4">
        <h3 className="font-display text-xl font-bold">Eligibility</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Legally authorized to work in the U.S.?" error={errors.workAuthorized?.message}>
            <RadioGroup
              value={workAuth}
              onValueChange={(v) => setValue("workAuthorized", v as "Yes" | "No")}
              className="flex gap-6"
            >
              {(["Yes", "No"] as const).map((v) => (
                <label key={v} className="flex items-center gap-2">
                  <RadioGroupItem value={v} id={`wa-${v}`} />
                  <span>{v}</span>
                </label>
              ))}
            </RadioGroup>
          </Field>
          <Field label="At least 18 years old?" error={errors.over18?.message}>
            <RadioGroup
              value={over18}
              onValueChange={(v) => setValue("over18", v as "Yes" | "No")}
              className="flex gap-6"
            >
              {(["Yes", "No"] as const).map((v) => (
                <label key={v} className="flex items-center gap-2">
                  <RadioGroupItem value={v} id={`o18-${v}`} />
                  <span>{v}</span>
                </label>
              ))}
            </RadioGroup>
          </Field>
        </div>
      </section>

      {/* Resume */}
      <section className="space-y-3">
        <h3 className="font-display text-xl font-bold">Resume</h3>
        <ResumeDropzone file={resume} onChange={setResume} error={resumeError ?? undefined} />
      </section>

      {/* Additional */}
      <section className="space-y-3">
        <h3 className="font-display text-xl font-bold">Additional Information</h3>
        <Field label="Why would you be a good fit?" error={errors.fit?.message}>
          <Textarea rows={5} {...register("fit")} />
        </Field>
      </section>

      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-end">
        <Button type="submit" size="lg" disabled={submitting} className="min-w-48">
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting…
            </>
          ) : (
            "Submit Application"
          )}
        </Button>
      </div>
    </form>
  );
};

const Field = ({
  label,
  error,
  children,
  className = "",
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={`space-y-1.5 ${className}`}>
    <Label className="text-sm font-medium">{label}</Label>
    {children}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);
