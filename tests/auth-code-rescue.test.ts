import assert from "node:assert/strict";
import test from "node:test";

import { shouldRescueAuthCode } from "../src/lib/auth-code-rescue";

test("rescues an OAuth code only while an auth return is pending", () => {
  assert.equal(shouldRescueAuthCode("?code=oauth-code", "/profile"), true);
});

test("does not treat PortOne payment errors as OAuth callbacks", () => {
  assert.equal(
    shouldRescueAuthCode(
      "?paymentId=LRCP_test&code=FAILURE_TYPE_PG&pgCode=V016",
      null,
    ),
    false,
  );
});

test("does not rescue provider error callbacks", () => {
  assert.equal(
    shouldRescueAuthCode("?code=oauth-code&error=access_denied", "/profile"),
    false,
  );
});
