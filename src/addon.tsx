import React from "react";
import type { AddonContext } from "@wealthfolio/addon-sdk";
import { Icons } from "@wealthfolio/ui";
import { MainPage, SettingsPage } from "./pages";

export default function enable(ctx: AddonContext) {
  const sidebarItem = ctx.sidebar.addItem({
    id: "lunch-money",
    label: "Lunch Money",
    icon: <Icons.Blocks className="h-5 w-5" />,
    route: "/addon/lunch-money",
    order: 100,
  });

  const Main = () => <MainPage ctx={ctx} />;
  ctx.router.add({
    path: "/addon/lunch-money",
    component: React.lazy(() => Promise.resolve({ default: Main })),
  });

  const Settings = () => <SettingsPage ctx={ctx} />;
  ctx.router.add({
    path: "/addon/lunch-money/settings",
    component: React.lazy(() => Promise.resolve({ default: Settings })),
  });

  ctx.onDisable(() => {
    try {
      sidebarItem.remove();
    } catch {
      ctx.api.logger.error("Failed to remove sidebar item:");
    }
  });
}
