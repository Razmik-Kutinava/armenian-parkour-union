export type Mail = { to: string; subject: string; text: string };

/** The mail provider is deferred (task 0.10): until then every message goes to the server log. */
export async function sendMail(mail: Mail): Promise<void> {
	console.info(`[mail] to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
}
