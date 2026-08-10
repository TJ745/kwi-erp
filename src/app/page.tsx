import { redirect } from "next/navigation";

/** The app has no public landing page; unauthenticated users are sent to /login
 *  by middleware before ever reaching here. */
export default function RootPage() {
  redirect("/dashboard");
}
