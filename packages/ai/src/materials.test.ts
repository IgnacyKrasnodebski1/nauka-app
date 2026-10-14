import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import type Anthropic from "@anthropic-ai/sdk";
import { generateTopic, GenerationError } from "./generate.js";
import { setClientForTests } from "./client.js";
import {
  materialsToBlocks,
  materialsToUpload,
  uploadMaterials,
  deleteUploadedFiles,
  DELETE_TIMEOUT_MS,
  MaterialUploadError,
  INLINE_IMAGES_MAX_BYTES,
  UPLOAD_TTL_SECONDS,
  type MaterialInput,
} from "./materials.js";

const MB = 1024 * 1024;

/** Mock of the slice of the Anthropic client that generate.ts uses. No network. */
function mockClient(opts: { failUpload?: (name: string) => boolean; failDelete?: boolean; stream?: () => Promise<unknown> } = {}) {
  let n = 0;
  const uploads: { name: string; type: string; size: number; expires?: number; id: string }[] = [];
  const deleted: string[] = [];
  const streamCalls: Anthropic.Beta.MessageCreateParams[] = [];
  const client = {
    files: {
      async upload(p: Anthropic.FileUploadParams) {
        const file = p.file as File;
        await new Promise((r) => setTimeout(r, 5));
        if (opts.failUpload?.(file.name)) throw new Error("upload boom");
        const id = `file_test_${++n}`;
        uploads.push({ name: file.name, type: file.type, size: file.size, expires: p.expires_in_seconds, id });
        return { id, type: "file" };
      },
      async delete(id: string) {
        if (opts.failDelete) throw new Error("delete boom");
        deleted.push(id);
        return { id, type: "file_deleted" };
      },
    },
    beta: {
      messages: {
        stream(params: Anthropic.Beta.MessageCreateParams) {
          streamCalls.push(params);
          return {
            finalMessage:
              opts.stream ??
              (async () => ({ id: "msg_test", type: "message", role: "assistant", model: "claude-opus-5", stop_reason: "refusal", content: [], usage: { input_tokens: 1, output_tokens: 1 } })),
          };
        },
      },
    },
  };
  return { client: client as unknown as Anthropic, uploads, deleted, streamCalls };
}

function withKey() {
  process.env.ANTHROPIC_API_KEY = "test-key-not-used";
}

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;
  setClientForTests(null);
});

const pdf = (name: string): MaterialInput => ({ mime: "application/pdf", data: Buffer.from("%PDF-1.4 test"), name });
const img = (name: string, bytes: number): MaterialInput => ({ mime: "image/jpeg", data: Buffer.alloc(bytes, 1), name });

test("materialsToBlocks uses file sources for uploaded materials and keeps labels", () => {
  const { blocks, summary } = materialsToBlocks(
    [pdf("skrypt.pdf"), img("tablica.jpg", 10), { mime: "text/plain", data: Buffer.from("notatki") }],
    "wklejone",
    ["file_a", "file_b", undefined],
  );
  assert.deepEqual(blocks[0], { type: "text", text: "[Materiał 1: PDF — skrypt.pdf]" });
  assert.deepEqual(blocks[1], { type: "document", source: { type: "file", file_id: "file_a" }, title: "skrypt.pdf" });
  assert.deepEqual(blocks[2], { type: "text", text: "[Materiał 2: zdjęcie — tablica.jpg]" });
  assert.deepEqual(blocks[3], { type: "image", source: { type: "file", file_id: "file_b" } });
  assert.deepEqual(blocks[4], { type: "document", source: { type: "text", media_type: "text/plain", data: "notatki" }, title: "plik 3" });
  assert.equal(blocks.length, 6);
  assert.match(summary, /1 zdj\., 1 PDF, 2 tekst\./);
});

test("materialsToBlocks without file ids stays inline base64 (sync, backwards compatible)", () => {
  const { blocks } = materialsToBlocks([pdf("a.pdf"), img("b.jpg", 3)]);
  const doc = blocks[1] as Anthropic.Beta.BetaRequestDocumentBlock;
  const image = blocks[3] as Anthropic.Beta.BetaImageBlockParam;
  assert.equal(doc.source.type, "base64");
  assert.equal(image.source.type, "base64");
});

test("upload policy: every PDF, images only above the inline budget, never text", () => {
  const small = [pdf("a.pdf"), img("b.jpg", 5 * MB), img("c.jpg", 5 * MB), { mime: "text/plain", data: "aGVq" }];
  assert.deepEqual(materialsToUpload(small), [0]);
  const big = [img("b.jpg", 8 * MB), pdf("a.pdf"), img("c.jpg", 8 * MB), { mime: "text/plain", data: "aGVq" }];
  assert.ok(16 * MB > INLINE_IMAGES_MAX_BYTES);
  assert.deepEqual(materialsToUpload(big), [0, 1, 2]);
  // base64 string data is measured by its decoded size
  const b64 = { mime: "image/png", data: Buffer.alloc(16 * MB).toString("base64"), name: "x.png" };
  assert.deepEqual(materialsToUpload([b64]), [0]);
  assert.deepEqual(materialsToUpload([]), []);
});

test("uploadMaterials uploads in parallel with a TTL and returns ids aligned with materials", async () => {
  const m = mockClient();
  const uploaded: string[] = [];
  const mats: MaterialInput[] = [{ mime: "text/plain", data: "aGVq" }, pdf("Wykład ćwiczenia/1.pdf"), { mime: "application/pdf", data: Buffer.from("%PDF").toString("base64") }];
  const ids = await uploadMaterials(m.client, mats, uploaded);
  assert.equal(ids.length, 3);
  assert.equal(ids[0], undefined);
  assert.ok(ids[1] && ids[2] && ids[1] !== ids[2]);
  assert.deepEqual([...uploaded].sort(), [ids[1], ids[2]].sort());
  for (const u of m.uploads) {
    assert.equal(u.type, "application/pdf");
    assert.equal(u.expires, UPLOAD_TTL_SECONDS);
    assert.match(u.name, /^[\w.-]+\.pdf$/);
  }
  assert.ok(m.uploads.some((u) => u.name === "1.pdf"), "keeps only the last path component");
  assert.ok(m.uploads.some((u) => u.name === "material-3.pdf"), "unnamed material gets a fallback name");
  assert.ok(m.uploads.some((u) => u.size === 4), "base64 data is decoded before upload");
});

test("uploadMaterials: one failed upload throws but keeps the successful ids for cleanup", async () => {
  const m = mockClient({ failUpload: (name) => name.startsWith("zly") });
  const uploaded: string[] = [];
  await assert.rejects(
    () => uploadMaterials(m.client, [pdf("dobry.pdf"), pdf("zly.pdf"), pdf("drugi.pdf")], uploaded),
    (e: unknown) => e instanceof MaterialUploadError && /zly\.pdf/.test(e.message) && /Nie udało się przesłać/.test(e.message),
  );
  assert.equal(uploaded.length, 2);
});

test("deleteUploadedFiles never throws", async () => {
  const m = mockClient({ failDelete: true });
  await deleteUploadedFiles(m.client, ["file_x", "file_y"]);
  await deleteUploadedFiles(m.client, []);
});

test("deleteUploadedFiles bounds every delete with a short timeout (cleanup cannot stall a finished generation)", async () => {
  const seen: { id: string; options: unknown }[] = [];
  const client = {
    files: {
      async upload() {
        return { id: "unused" };
      },
      async delete(id: string, _params?: unknown, options?: unknown) {
        seen.push({ id, options });
        return { id };
      },
    },
  };
  await deleteUploadedFiles(client, ["file_a", "file_b"]);
  assert.deepEqual(seen, [
    { id: "file_a", options: { timeout: DELETE_TIMEOUT_MS, maxRetries: 1 } },
    { id: "file_b", options: { timeout: DELETE_TIMEOUT_MS, maxRetries: 1 } },
  ]);
});

test("generateTopic sends PDFs by file_id, keeps cache_control on the last block and deletes uploads when generation fails", async () => {
  withKey();
  const m = mockClient();
  setClientForTests(m.client);
  await assert.rejects(
    () => generateTopic({ materials: [pdf("skrypt.pdf"), img("foto.jpg", 10)], text: "dopisek", options: { stage: "liceum", mode: "materials", levels: 2 } }),
    (e: unknown) => e instanceof GenerationError && e.code === "refusal",
  );
  assert.equal(m.uploads.length, 1, "only the PDF is uploaded (images are small)");
  assert.deepEqual(m.deleted, [m.uploads[0]!.id]);
  const call = m.streamCalls[0]!;
  const content = call.messages[0]!.content as Anthropic.Beta.BetaContentBlockParam[];
  const doc = content.find((b) => b.type === "document" && b.title === "skrypt.pdf") as Anthropic.Beta.BetaRequestDocumentBlock;
  assert.deepEqual(doc.source, { type: "file", file_id: m.uploads[0]!.id });
  const image = content.find((b) => b.type === "image") as Anthropic.Beta.BetaImageBlockParam;
  assert.equal(image.source.type, "base64");
  // last material block (pasted text) carries the cache breakpoint; the prompt text block comes after it
  const pasted = content[content.length - 2] as Anthropic.Beta.BetaRequestDocumentBlock;
  assert.equal(pasted.title, "Wklejony tekst");
  assert.deepEqual(pasted.cache_control, { type: "ephemeral" });
  assert.equal(content[content.length - 1]!.type, "text");
});

test("generateTopic uploads large image sets and cleans up even when the API call throws", async () => {
  withKey();
  const m = mockClient({
    stream: async () => {
      throw new Error("socket hang up");
    },
  });
  setClientForTests(m.client);
  await assert.rejects(() => generateTopic({ materials: [img("a.jpg", 8 * MB), img("b.jpg", 8 * MB)], options: { stage: "studia", mode: "materials", levels: 2 } }), /socket hang up/);
  assert.equal(m.uploads.length, 2);
  assert.deepEqual([...m.deleted].sort(), m.uploads.map((u) => u.id).sort());
  const content = m.streamCalls[0]!.messages[0]!.content as Anthropic.Beta.BetaContentBlockParam[];
  const images = content.filter((b): b is Anthropic.Beta.BetaImageBlockParam => b.type === "image");
  assert.equal(images.length, 2);
  assert.ok(images.every((b) => b.source.type === "file"));
});

test("generateTopic: failed upload → GenerationError 'api' in Polish, no AI calls, successful uploads deleted", async () => {
  withKey();
  const m = mockClient({ failUpload: (name) => name === "drugi.pdf" });
  setClientForTests(m.client);
  await assert.rejects(
    () => generateTopic({ materials: [pdf("pierwszy.pdf"), pdf("drugi.pdf")], options: { stage: "liceum", mode: "materials", levels: 2 } }),
    (e: unknown) => e instanceof GenerationError && e.code === "api" && /Nie udało się przesłać materiału „drugi\.pdf”/.test(e.message),
  );
  assert.equal(m.streamCalls.length, 0);
  assert.equal(m.uploads.length, 1);
  assert.deepEqual(m.deleted, [m.uploads[0]!.id]);
});

test("generateTopic: failing cleanup does not mask the generation error", async () => {
  withKey();
  const m = mockClient({ failDelete: true });
  setClientForTests(m.client);
  await assert.rejects(
    () => generateTopic({ materials: [pdf("a.pdf")], options: { stage: "liceum", mode: "materials", levels: 2 } }),
    (e: unknown) => e instanceof GenerationError && e.code === "refusal",
  );
});

test("generateTopic with text only (no materials) uploads nothing", async () => {
  withKey();
  const m = mockClient();
  setClientForTests(m.client);
  await assert.rejects(() => generateTopic({ materials: [], text: "Fotosynteza to…", options: { stage: "liceum", mode: "materials", levels: 2 } }), GenerationError);
  assert.equal(m.uploads.length, 0);
  assert.equal(m.deleted.length, 0);
  const content = m.streamCalls[0]!.messages[0]!.content as Anthropic.Beta.BetaContentBlockParam[];
  assert.deepEqual(content[0], { type: "document", source: { type: "text", media_type: "text/plain", data: "Fotosynteza to…" }, title: "Wklejony tekst", cache_control: { type: "ephemeral" } });
});

test("generateTopic in prompt mode uploads nothing", async () => {
  withKey();
  const m = mockClient();
  setClientForTests(m.client);
  await assert.rejects(() => generateTopic({ materials: [], options: { stage: "liceum", mode: "prompt", hint: "fotosynteza", levels: 2 } }), GenerationError);
  assert.equal(m.uploads.length, 0);
  assert.equal((m.streamCalls[0]!.messages[0]!.content as unknown[]).length, 1);
});
