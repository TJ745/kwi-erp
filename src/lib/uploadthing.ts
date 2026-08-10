import {
  generateReactHelpers,
  generateUploadButton,
  generateUploadDropzone,
} from "@uploadthing/react";
import type { OmsFileRouter } from "@/app/api/uploadthing/core";

/**
 * Typed client helpers. The router type is imported type-only, so no server
 * code — Prisma, guards, the storage client — reaches the browser bundle.
 */
export const UploadButton = generateUploadButton<OmsFileRouter>();
export const UploadDropzone = generateUploadDropzone<OmsFileRouter>();
export const { useUploadThing } = generateReactHelpers<OmsFileRouter>();
