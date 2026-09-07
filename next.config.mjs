/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only packages that genuinely cannot be bundled belong here. A pure-JS
  // library listed as external still has to be traced into the serverless
  // bundle, and if tracing misses it the route 500s in production while
  // working locally, where the server resolves from the full node_modules.
  // sanitize-html and html-to-text bundle fine, so they are not listed.
  serverExternalPackages: ["postgres", "nodemailer", "imapflow"],
};
export default nextConfig;
