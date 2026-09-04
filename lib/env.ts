function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get mailUser() {
    return required("MAIL_USER");
  },
  get mailPassword() {
    return required("MAIL_APP_PASSWORD");
  },
  get mailFromName() {
    return process.env.MAIL_FROM_NAME ?? "";
  },
  get alertTo() {
    return process.env.ALERT_TO ?? required("MAIL_USER");
  },
  get cronSecret() {
    return required("CRON_SHARED_SECRET");
  },
  tz: process.env.APP_TZ ?? "Asia/Karachi",
  maxSendsPerHour: Number(process.env.MAX_SENDS_PER_HOUR ?? 20),
  batchSize: Number(process.env.JOB_BATCH_SIZE ?? 3),
};
