import test from "node:test";
import assert from "node:assert/strict";
import { destroyCloudinaryAsset } from "../config/cloudinary.js";

const env = {
  CLOUDINARY_CLOUD_NAME: "mindful-demo",
  CLOUDINARY_API_KEY: "123456789",
  CLOUDINARY_API_SECRET: "test-secret"
};

test("Cloudinary asset deletion uses the Admin API DELETE method", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return {
      ok: true,
      status: 200,
      json: async () => ({ deleted: { "mindful/media/test-photo": "deleted" } })
    };
  };

  try {
    const result = await destroyCloudinaryAsset("mindful/media/test-photo", "image", { env });
    assert.equal(result, "deleted");
    assert.equal(captured.url, "https://api.cloudinary.com/v1_1/mindful-demo/resources/image/upload");
    assert.equal(captured.options.method, "DELETE");
    assert.equal(captured.options.headers.Authorization.startsWith("Basic "), true);
    assert.equal(captured.options.body.toString(), "public_ids%5B%5D=mindful%2Fmedia%2Ftest-photo");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Cloudinary deletion surfaces provider errors instead of a generic failure", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ error: { message: "Invalid API credentials" } })
  });

  try {
    await assert.rejects(
      destroyCloudinaryAsset("mindful/media/test-photo", "image", { env }),
      (error) => error.message === "Invalid API credentials" && error.statusCode === 502
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
