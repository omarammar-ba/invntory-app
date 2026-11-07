// Run against the Firestore emulator: see VOICE_ASSISTANT_AR.md.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { build } from "esbuild";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";

test("real Firestore rules and transactions protect confirmed voice changes", async () => {
  assert.ok(
    process.env.FIRESTORE_EMULATOR_HOST,
    "Firestore emulator required; no live databases are used",
  );
  const directory = await mkdtemp(
    fileURLToPath(new URL("./.stock-qa-", import.meta.url)),
  );
  const env = await initializeTestEnvironment({
    projectId: "demo-voice-actions-test",
    firestore: {
      rules: await readFile(
        new URL("../firestore.rules", import.meta.url),
        "utf8",
      ),
    },
  });
  try {
    const path = join(directory, "service.mjs");
    await build({
      entryPoints: [
        fileURLToPath(
          new URL(
            "../src/features/voice/stock-command.service.ts",
            import.meta.url,
          ),
        ),
      ],
      outfile: path,
      bundle: true,
      format: "esm",
      platform: "node",
      packages: "external",
      plugins: [
        {
          name: "emulator-only",
          setup(b) {
            b.onResolve({ filter: /^@\/services\/firebase$/ }, () => ({
              path: "firebase",
              namespace: "emulator",
            }));
            b.onLoad({ filter: /.*/, namespace: "emulator" }, () => ({
              contents: `
          export const auth = { get currentUser() { return { uid: globalThis.voiceTestUid }; } };
          export const requireFirestore = () => globalThis.voiceTestDb;
          export const sanitizeFirestoreData = x => x;
        `,
            }));
          },
        },
      ],
    });
    const { previewVoiceItem, saveVoiceAddition } = await import(
      pathToFileURL(path).href
    );
    const staff = {
      id: "staff-test",
      name: "مختبر",
      status: "active",
      role: "employee",
    };
    const category = { id: "tiles", name: "بورسلان", visibleToEmployees: true };
    const item = {
      id: "item-1",
      categoryId: "tiles",
      name: "0012044",
      meters: 10,
      boxes: 5,
      pallets: 0.11,
      image: "",
      packing: { mBox: 2.16, bPallet: 44 },
    };
    const hidden = { ...item, id: "hidden", hiddenForStaff: true };
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await Promise.all([
        setDoc(doc(db, "staff", staff.id), staff),
        setDoc(doc(db, "categories", category.id), category),
        setDoc(doc(db, "tiles", item.id), item),
        setDoc(doc(db, "tiles", hidden.id), hidden),
      ]);
    });
    const db = (globalThis.voiceTestDb = env
      .authenticatedContext(staff.id)
      .firestore());
    globalThis.voiceTestUid = staff.id;
    const itemRef = doc(db, "tiles", item.id);
    const logCount = async () => {
      let count;
      await env.withSecurityRulesDisabled(async (ctx) => {
        count = (await getDocs(collection(ctx.firestore(), "logs"))).size;
      });
      return count;
    };
    const quantity = {
      action: "quantity",
      mode: "increase",
      amount: 1,
      unit: "pallets",
    };
    const first = await previewVoiceItem(item, quantity, category, staff);
    const stale = await previewVoiceItem(item, quantity, category, staff);
    assert.equal((await getDoc(itemRef)).data().meters, 10);
    assert.equal(await logCount(), 0);
    await first.commit();
    assert.equal((await getDoc(itemRef)).data().meters, 105.04);
    assert.equal(await logCount(), 1);
    await assert.rejects(first.commit(), /سابقاً/);
    await assert.rejects(stale.commit(), /بعد المعاينة/);
    assert.equal(await logCount(), 1);
    const edit = await previewVoiceItem(
      item,
      { action: "edit", color: "أسود" },
      category,
      staff,
    );
    await edit.commit();
    assert.equal((await getDoc(itemRef)).data().color, "أسود");
    const { id: _, ...draft } = item;
    await saveVoiceAddition(
      "voice-repeat",
      { ...draft, name: "NEW-1" },
      category,
      staff,
    );
    await assert.rejects(
      saveVoiceAddition(
        "voice-repeat",
        { ...draft, name: "DUPLICATE" },
        category,
        staff,
      ),
    );
    assert.equal(
      (await getDoc(doc(db, "tiles", "voice-repeat"))).data().name,
      "NEW-1",
    );
    await assert.rejects(
      previewVoiceItem(
        { ...hidden, hiddenForStaff: false },
        { action: "delete" },
        category,
        staff,
      ),
      /غير متاح/,
    );
    const deletion = await previewVoiceItem(
      item,
      { action: "delete" },
      category,
      staff,
    );
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), "categories", category.id), {
        visibleToEmployees: false,
      });
    });
    await assert.rejects(deletion.commit(), /permission|insufficient/i);
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), "categories", category.id), {
        visibleToEmployees: true,
      });
    });
    const allowedDeletion = await previewVoiceItem(
      item,
      { action: "delete" },
      category,
      staff,
    );
    assert.equal((await getDoc(itemRef)).exists(), true);
    await allowedDeletion.commit();
    assert.equal((await getDoc(itemRef)).exists(), false);
    assert.equal(await logCount(), 4);
  } finally {
    delete globalThis.voiceTestDb;
    delete globalThis.voiceTestUid;
    await env.cleanup();
    await rm(directory, { recursive: true, force: true });
  }
});
