import { ForgotForm } from "@/components/email-forms";

export const metadata = { title: "Forgot password" };

export default function Forgot() {
  return (
    <div style={{ maxWidth: 440, margin: "0 auto" }}>
      <h1 className="tn-h2">Forgot your password?</h1>
      <p className="tn-body">Enter the email you signed up with. We&apos;ll send a link to choose a new password.</p>
      <ForgotForm />
    </div>
  );
}
