import Link from "next/link";
import { storageMode } from "@/lib/storage";
import { SeriesForm } from "@/components/studio-forms";

export const metadata = { title: "New series" };

export default function NewSeries() {
  return (
    <>
      <p className="crumbs"><Link href="/studio">Series</Link> / New</p>
      <h1 className="tn-h2">New series</h1>
      <SeriesForm mode={storageMode()} />
    </>
  );
}
