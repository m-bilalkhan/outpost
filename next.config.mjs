/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    "postgres",
    "nodemailer",
    "imapflow",
    "sanitize-html",
    "html-to-text",
  ],
};
export default nextConfig;
