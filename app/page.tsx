import ResearchForm from "@/components/ResearchForm";
import { COUNTRIES } from "@/lib/countries";

export default function Home() {
  return <ResearchForm countries={COUNTRIES} />;
}
