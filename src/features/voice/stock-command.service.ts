import {
  doc,
  collection,
  getDocFromServer,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import {
  auth,
  requireFirestore,
  sanitizeFirestoreData,
} from "@/services/firebase";
import type { Category, StaffMember, Tile } from "@/types";
import type { StockCommand } from "./stock-command.types";
import { stockFingerprint, stockPlan } from "./stock-command-plan.mjs";

const collectionFor = (id: string) =>
  id === "tiles" || id === "ceramics" ? id : "inventory";

function assertActor(staff: StaffMember) {
  if (
    auth.currentUser?.uid !== staff.id ||
    staff.status !== "active" ||
    (staff.role !== "admin" && staff.role !== "employee")
  )
    throw new Error("جلسة الدخول لم تعد صالحة لهذا الأمر.");
}

function assertScope(
  staff: StaffMember,
  category: Category,
  item?: Partial<Tile>,
) {
  assertActor(staff);
  if (
    staff.role === "employee" &&
    (category.visibleToEmployees !== true || item?.hiddenForStaff === true)
  )
    throw new Error("الصنف أو القسم غير متاح لحسابك.");
}

function assertId(id: string) {
  if (!id || id.includes("/") || id === "." || id === ".." || id.length > 500)
    throw new Error("معرّف الصنف غير صالح.");
}

function audit(
  staff: StaffMember,
  categoryId: string,
  item: Pick<Tile, "name" | "hiddenForStaff">,
  action: string,
  details: string,
) {
  return {
    actorUid: staff.id,
    user: staff.name,
    timestamp: serverTimestamp(),
    action,
    tileName: item.name,
    categoryId,
    details,
    hiddenForStaff: item.hiddenForStaff === true,
  };
}

export type VoiceItemReview = {
  item: Tile;
  plan: ReturnType<typeof stockPlan>;
  commit: () => Promise<void>;
};

export async function previewVoiceItem(
  candidate: Tile,
  command: StockCommand,
  category: Category,
  staff: StaffMember,
): Promise<VoiceItemReview> {
  assertScope(staff, category, candidate);
  assertId(candidate.id);
  if (
    candidate.categoryId !== category.id ||
    (command.categoryId && command.categoryId !== category.id)
  )
    throw new Error("القسم المحدد لا يطابق الصنف.");
  const db = requireFirestore();
  const ref = doc(db, collectionFor(category.id), candidate.id);
  const snapshot = await getDocFromServer(ref);
  const raw = snapshot.data();
  const storedCategory =
    raw?.categoryId ??
    (collectionFor(category.id) === "inventory" ? null : category.id);
  if (!raw || raw.name !== candidate.name || storedCategory !== category.id)
    throw new Error(
      "الصنف تغيّر أو لم يعد موجوداً. حدّث القائمة ثم أعد البحث.",
    );
  const item = { ...raw, id: snapshot.id, categoryId: category.id } as Tile;
  assertScope(staff, category, item);
  const plan = stockPlan(item, command, category);
  const before = stockFingerprint(raw);
  const auditRef = doc(collection(db, "logs"));
  let attempted = false;

  return {
    item,
    plan,
    async commit() {
      assertActor(staff);
      if (attempted)
        throw new Error(
          "تم إرسال هذا التأكيد سابقاً. راجع المخزون قبل إعادة الأمر.",
        );
      attempted = true;
      await runTransaction(db, async (tx) => {
        assertActor(staff);
        const live = await tx.get(ref);
        if (!live.exists() || stockFingerprint(live.data()) !== before)
          throw new Error(
            "بيانات الصنف تغيّرت بعد المعاينة. أعد قراءة الصنف وراجع التغيير قبل التأكيد.",
          );
        const current = live.data() as Partial<Tile>;
        assertScope(staff, category, current);
        if (plan.action === "delete") {
          tx.delete(ref);
          tx.set(
            auditRef,
            audit(
              staff,
              category.id,
              item,
              "حذف",
              "تم حذف الصنف من مساعد المخزون بعد التأكيد",
            ),
          );
        } else {
          tx.update(ref, {
            ...plan.patch,
            updatedAt: serverTimestamp(),
            updatedBy: staff.name,
            updatedByUid: staff.id,
          });
          tx.set(
            auditRef,
            audit(
              staff,
              category.id,
              { ...item, ...plan.patch },
              "تعديل",
              plan.changes
                .map(
                  (change) =>
                    `${change.label}: ${change.before} -> ${change.after}`,
                )
                .join(" | "),
            ),
          );
        }
      });
    },
  };
}

// Stable IDs + immutable audit logs make retries of the same form atomic and non-duplicating.
export async function saveVoiceAddition(
  id: string,
  data: Omit<Tile, "id">,
  category: Category,
  staff: StaffMember,
) {
  assertScope(staff, category, data);
  assertId(id);
  if (data.categoryId !== category.id)
    throw new Error("القسم المحدد غير صالح.");
  const db = requireFirestore();
  const batch = writeBatch(db);
  batch.set(
    doc(db, collectionFor(category.id), id),
    sanitizeFirestoreData({
      ...data,
      id,
      createdAt: serverTimestamp(),
      createdBy: staff.name,
      createdByUid: staff.id,
    }),
  );
  batch.set(
    doc(db, "logs", id),
    audit(
      staff,
      category.id,
      data,
      "إضافة",
      `إضافة صنف جديد بالكمية: ${data.meters}`,
    ),
  );
  await batch.commit();
}
