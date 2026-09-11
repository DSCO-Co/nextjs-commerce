import OpengraphImage from "components/opengraph-image";
import { getPage } from "lib/flightdeck";

export default async function Image({ params }: { params: { page: string } }) {
  const page = await getPage(params.page);
  // Flightdeck's getPage may return undefined (no CMS pages yet) — fall back
  // to the handle so the OG image still renders something sensible.
  const title = page?.seo?.title || page?.title || params.page;

  return await OpengraphImage({ title });
}
