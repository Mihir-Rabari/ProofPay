export type ProofAsset = {
  id: string; title: string; site: string; date: string; trust: number; status: "Verified" | "Review" | "New";
  image: string; coordinates: string; hash: string; note: string; checks: { label: string; value: number; detail: string }[];
};

export const initialAssets: ProofAsset[] = [
  { id: "PP-8F2A91", title: "Stone pitching · east embankment", site: "Vatadra check dam", date: "Today, 10:42 AM", trust: .94, status: "Verified", image: "https://images.unsplash.com/photo-1516937941344-00b4e0337589?auto=format&fit=crop&w=1100&q=85", coordinates: "22.3941° N, 72.8578° E", hash: "sha256:8c27…a194", note: "Stone masonry is visible along the east bank. Six workers on site; dry channel condition matches the work plan.", checks: [{ label: "Milestone relevance", value: 98, detail: "Stone pitching clearly visible" }, { label: "Location match", value: 96, detail: "18 m from registered site pin" }, { label: "Capture time", value: 94, detail: "EXIF within milestone window" }, { label: "Originality", value: 100, detail: "No matching perceptual hash" }] },
  { id: "PP-1D7C42", title: "New saplings · north plot", site: "Vatadra plantation", date: "Today, 9:18 AM", trust: .87, status: "Verified", image: "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1100&q=85", coordinates: "22.3972° N, 72.8601° E", hash: "sha256:7a10…d083", note: "Rows of young saplings are established. Soil appears recently watered; vegetation is consistent with the plantation milestone.", checks: [{ label: "Milestone relevance", value: 91, detail: "Planting rows detected" }, { label: "Location match", value: 89, detail: "42 m from registered site pin" }, { label: "Capture time", value: 92, detail: "EXIF within milestone window" }, { label: "Originality", value: 100, detail: "No matching perceptual hash" }] },
  { id: "PP-3B5E11", title: "Foundation trench · west side", site: "Vatadra check dam", date: "Yesterday, 4:36 PM", trust: .68, status: "Review", image: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1100&q=85", coordinates: "22.3928° N, 72.8559° E", hash: "sha256:3d9f…f620", note: "Excavation is visible, though the frame does not show enough of the site to confirm the full foundation length.", checks: [{ label: "Milestone relevance", value: 84, detail: "Excavation activity detected" }, { label: "Location match", value: 63, detail: "310 m from site pin" }, { label: "Capture time", value: 92, detail: "EXIF within milestone window" }, { label: "Originality", value: 44, detail: "Similar frame found in this project" }] },
];

export const milestones = [
  { id: "MILESTONE 01", name: "Site clearing & foundation", amount: 850000, progress: 100, state: "Released", trust: 94, date: "12 Sep 2026", assets: 18 },
  { id: "MILESTONE 02", name: "Stone pitching & spillway", amount: 1250000, progress: 78, state: "In verification", trust: 87, date: "04 Oct 2026", assets: 24 },
  { id: "MILESTONE 03", name: "Planting & site restoration", amount: 650000, progress: 34, state: "Collecting proof", trust: 68, date: "22 Oct 2026", assets: 11 },
];

export const rupees = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
