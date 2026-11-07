import type { AddonContext } from "@wealthfolio/addon-sdk";
import "./addon.css";
import { MainPage, SettingsPage } from "./pages";
import { MAIN_ROUTE, SETTINGS_ROUTE } from "./lib/routes";

// Routes and the sidebar link are declared in manifest.json `contributes`; here
// we only attach the components. The host owns the React root and mounts these
// in the addon's sandboxed iframe.
export default function enable(ctx: AddonContext) {
  const Main = () => <MainPage ctx={ctx} />;
  const Settings = () => <SettingsPage ctx={ctx} />;

  ctx.router.add({ ...MAIN_ROUTE, title: "Lunch Money", component: Main });
  ctx.router.add({ ...SETTINGS_ROUTE, title: "Lunch Money Settings", component: Settings });
}
