/// <reference types="vite/client" />
import { defineAppSetup } from "@slidev/types";
import events from "./events";

const scalewayBrand = {
  logoVertical: import.meta.env.BASE_URL + "/logo_scaleway.svg",
  logoHorizontal: import.meta.env.BASE_URL + "/logo_scaleway.svg",
};

const empty = {};
const isProd = import.meta.env.PROD;
const lastEvent = Object.values(events).at(-1);

const currentEvent = isProd ? empty : lastEvent;
const brand = isProd ? empty : scalewayBrand;

export default defineAppSetup(({ app }) => {
  app.config.globalProperties.$event = currentEvent;
  app.config.globalProperties.$brand = brand;
});
