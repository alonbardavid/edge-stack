import { env } from "cloudflare:workers";
import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";
import { moduleLogger } from "@lib/logging";

const log = moduleLogger("email-service/send");

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
}

interface EmailBinding {
  send(message: EmailMessage): Promise<void>;
}

interface EmailEnv {
  SEND_EMAIL: EmailBinding;
  EMAIL_FROM: string;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const { SEND_EMAIL, EMAIL_FROM } = env as unknown as EmailEnv;
  const raw = buildMimeMessage(input, EMAIL_FROM);

  await SEND_EMAIL.send(new EmailMessage(EMAIL_FROM, input.to, raw));
  log.info("email sent", { subject: input.subject, from: EMAIL_FROM });
}

function buildMimeMessage(input: SendEmailInput, from: string): string {
  const message = createMimeMessage();
  message.setSender(
    input.fromName ? { name: input.fromName, addr: from } : from,
  );
  message.setRecipient(input.to);
  message.setSubject(input.subject);
  if (input.text) {
    message.addMessage({ contentType: "text/plain", data: input.text });
  }
  message.addMessage({ contentType: "text/html", data: input.html });
  return message.asRaw();
}
