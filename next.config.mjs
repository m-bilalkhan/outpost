/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["postgres", "nodemailer", "imapflow"],
};
export default nextConfig;
