import assert from "node:assert/strict";
import test from "node:test";

import { buildPortOneNoticeUrl } from "../src/lib/portone-notice-url";

test("keeps the production webhook URL free of deployment bypass data", () => {
  assert.equal(
    buildPortOneNoticeUrl("https://loverebbit.xyz", {
      vercelEnvironment: "production",
      automationBypassSecret: "preview-secret",
    }),
    "https://loverebbit.xyz/api/portone/webhook",
  );
});

test("adds Vercel automation bypass only to preview webhook URLs", () => {
  const noticeUrl = new URL(
    buildPortOneNoticeUrl("https://preview.example.com", {
      vercelEnvironment: "preview",
      automationBypassSecret: "preview secret",
    }),
  );

  assert.equal(noticeUrl.pathname, "/api/portone/webhook");
  assert.equal(
    noticeUrl.searchParams.get("x-vercel-protection-bypass"),
    "preview secret",
  );
});

test("does not add an empty preview bypass secret", () => {
  assert.equal(
    buildPortOneNoticeUrl("https://preview.example.com", {
      vercelEnvironment: "preview",
      automationBypassSecret: "   ",
    }),
    "https://preview.example.com/api/portone/webhook",
  );
});
