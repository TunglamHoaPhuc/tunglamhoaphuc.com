// Sending mail. The rest of the admin only knows `Mailer`; the real one (SMTP over a Workers socket,
// configured in the admin) is added with the settings module. Tests pass their own.
export type MailMessage = { to: string; subject: string; text: string };
export type Mailer = (message: MailMessage) => Promise<void>;
