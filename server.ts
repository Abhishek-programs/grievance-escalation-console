// Vercel treats a root server.ts that imports Express as the app entry.
import "express";
export { default } from "./server/src/server.ts";
