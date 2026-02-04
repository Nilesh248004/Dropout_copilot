import emailjs from "@emailjs/browser";

const SERVICE_ID = process.env.REACT_APP_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = process.env.REACT_APP_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = process.env.REACT_APP_EMAILJS_PUBLIC_KEY;

export const sendEmail = async ({
  fromRole,
  toRoles,
  fromEmail,
  toEmail,
  subject,
  message,
}) => {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    throw new Error(
      "Email service not configured. Set REACT_APP_EMAILJS_SERVICE_ID, REACT_APP_EMAILJS_TEMPLATE_ID, and REACT_APP_EMAILJS_PUBLIC_KEY."
    );
  }
  if (!fromEmail || !String(fromEmail).trim()) {
    throw new Error("Sender email is required.");
  }
  if (!toEmail || !String(toEmail).trim()) {
    throw new Error("Recipient email is required.");
  }

  const templateParams = {
    from_role: fromRole,
    to_roles: Array.isArray(toRoles) ? toRoles.join(", ") : String(toRoles || ""),
    from_email: String(fromEmail || "").trim(),
    to_email: String(toEmail || "").trim(),
    subject,
    message,
  };

  await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
};
