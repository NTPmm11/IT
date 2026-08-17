<script>
// ============================================
// StatusModal.vue — modal แจ้งผลสำเร็จ/พลาด (ใช้แทน alert() ทุกจุดที่ submit ไป backend)
// ============================================
//
// alert() ของ browser มีปัญหา: บล็อกทั้งหน้าจอแบบไม่มีสไตล์ ผู้ใช้บางคนมองข้าม/ไม่ทันสังเกต
// component นี้แทนที่ด้วย modal กลางจอที่ควบคุมหน้าตาเองได้ ให้ feedback ชัดเจนกว่า
//
// วิธีใช้ (ดูตัวอย่างจริงใน LoginView.vue / FormView.vue / ApprovalSection.vue):
//   <StatusModal :show="modal.show" :variant="modal.variant"
//                :title="modal.title" :message="modal.message" @close="modal.show = false" />
// แต่ละหน้าเก็บ state ของตัวเอง (modal.show/variant/title/message) แล้วสั่งเปิดก่อน/หลัง apiFetch
//
// ── เชื่อมกับไฟล์ไหนบ้าง ──
// ต้นทาง (import ไฟล์นี้): views/LoginView.vue, views/FormView.vue, components/ApprovalSection.vue
// ปลายทาง: ไม่เรียกไฟล์ไหนต่อเลย — เป็น "dumb component" รับ prop มาโชว์ ไม่รู้จัก apiFetch/backend
// ตั้งใจให้ไม่ผูกกับ logic ธุรกิจใดๆ (component นี้ไม่รู้ด้วยซ้ำว่าใครเรียกมันมา) เอาไปใช้ที่ไหนก็ได้
// ในโปรเจกต์ ไม่ต้องแก้ไฟล์นี้เลยเวลาเพิ่มฟอร์มใหม่ที่ต้องการ modal แบบเดียวกัน

export default {
  name: "StatusModal",

  props: {
    show: { type: Boolean, default: false },
    // "success" = ไอคอนติ๊กเขียว, "error" = ไอคอนกากบาทแดง
    variant: { type: String, default: "success" },
    title: { type: String, default: "" },
    message: { type: String, default: "" }
  },

  // component ลูกห้ามแก้ prop ของตัวเองตรงๆ (show มาจากพ่อแม่)
  // อยากปิด modal เลยต้อง "ขอ" พ่อแม่ผ่าน emit เหตุการณ์ close แทน
  emits: ["close"]
};
</script>

<template>
  <!-- v-if="show" = ไม่ได้ซ่อนด้วย CSS แต่ไม่วาด element นี้ลง DOM เลยตอนปิดอยู่ -->
  <!-- @click.self = คลิกจะทริกเกอร์เฉพาะตอนคลิกที่พื้นหลังเอง (ไม่ใช่คลิกโดนการ์ดข้างใน) -->
  <div class="modal-overlay" v-if="show" @click.self="$emit('close')">
    <div class="modal-card">
      <i class="fa-solid modal-icon"
         :class="variant === 'success' ? 'fa-circle-check icon-success' : 'fa-circle-xmark icon-error'"></i>
      <h3 class="modal-title">{{ title }}</h3>
      <p class="modal-message">{{ message }}</p>
      <button type="button" class="btn btn-submit modal-close-btn" @click="$emit('close')">ตกลง</button>
    </div>
  </div>
</template>

<style>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 14, 26, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-card {
  background: var(--sheet);
  border: 1px solid var(--line);
  border-radius: 0;
  padding: var(--lh);
  max-width: 380px;
  width: 100%;
  text-align: left;
}

.modal-icon {
  font-size: 24px;
  margin-bottom: var(--quarter);
}

.icon-success { color: var(--result-approved); }
.icon-error { color: var(--seal); }

.modal-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--ink);
  padding-bottom: var(--quarter);
  margin-bottom: var(--quarter);
  border-bottom: 1px solid var(--line-faint);
}

.modal-message {
  font-size: 16px;
  color: var(--ink-light);
  line-height: var(--lh);
  margin-bottom: var(--lh);
  white-space: pre-line;
}

.modal-close-btn {
  width: 100%;
  justify-content: center;
}
</style>
