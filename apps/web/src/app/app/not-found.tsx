import { ErrorView } from "@/components/screens/error";

export default function AppNotFound() {
  return <ErrorView icon="file" title="Nie ma takiego ekranu" reason="Temat mógł zostać usunięty albo link jest krzywy." can={[["home", "Wróć na Dziś"], ["grid", "Zajrzyj do katalogu przedmiotów"]]} actions={[{ label: "NA DZIŚ", primary: true, href: "/app" }, { label: "Katalog", href: "/app/catalog" }]} back="/app" />;
}
