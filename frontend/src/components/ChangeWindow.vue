<script>
// ============================================
// ChangeWindow.vue — แถบหน้าต่างการเปลี่ยนแปลง
// ============================================
//
// แก่นของ change request ไม่ใช่ฟอร์ม แต่คือ "ช่วงเวลาที่ระบบพังได้ กับสัญญาว่าย้อนกลับได้"
// แถบนี้เอาข้อมูลที่มีอยู่แล้วมาวางบนแกนเวลาเส้นเดียว:
//   เหนือแกน = แผนดำเนินงาน (เดินหน้า)
//   ใต้แกน   = แผนการกู้คืน (เดินย้อน จึงสะท้อนกลับด้าน)
//
// cr_action_plans.start_date / end_date เป็น NVARCHAR ผู้ใช้พิมพ์เอง
// อ่านเป็นเวลาไม่ได้ทุกแถวเมื่อไหร่ ตกไปโหมด "เรียงตามลำดับ" แทน แล้วบอกผู้อ่านตรงๆ
// ว่ากำลังดูลำดับ ไม่ใช่สเกลเวลาจริง
//
// ── เชื่อมกับไฟล์ไหนบ้าง ──
// ต้นทาง: views/ApproveView.vue (ใต้หัวเอกสาร) — รับ plan/rollbackPlan จาก GET /change-requests/:id
// ปลายทาง: ไม่เรียก API เอง วาดจาก props อย่างเดียว

export default {
  name: "ChangeWindow",

  props: {
    plan: { type: Array, default: () => [] },
    rollbackPlan: { type: Array, default: () => [] },
    deployDate: { type: String, default: "" },
    downtime: { type: Boolean, default: false },
    duration: { type: String, default: "" }
  },

  computed: {
    forward() {
      return this.normalize(this.plan);
    },

    backward() {
      return this.normalize(this.rollbackPlan);
    },

    rows() {
      return [...this.forward, ...this.backward];
    },

    hasContent() {
      return this.rows.length > 0;
    },

    // สเกลเวลาจริงได้ก็ต่อเมื่อทุกแถวอ่านเวลาออกทั้งต้นและท้าย
    // มีแถวเดียวที่อ่านไม่ออกก็เลิกทั้งแถบ — วางครึ่งจริงครึ่งเดาแล้วคนอ่านแยกไม่ออกว่าอันไหนจริง
    scaled() {
      return this.rows.length > 0 && this.rows.every(r => r.start !== null && r.end !== null);
    },

    span() {
      if (!this.scaled) return null;
      const starts = this.rows.map(r => r.start);
      const ends = this.rows.map(r => r.end);
      const from = Math.min(...starts);
      const to = Math.max(...ends);
      return { from, to, length: Math.max(to - from, 1) };
    },

    // ตำแหน่งของ deploy date บนแกน — อยู่นอกช่วงก็ไม่ต้องปัก
    deployMark() {
      if (!this.scaled || !this.deployDate) return null;
      const at = this.toTime(this.deployDate);
      if (at === null || at < this.span.from || at > this.span.to) return null;
      return { left: this.percent(at), label: this.fmtDate(this.deployDate) };
    },

    axisLabels() {
      if (!this.scaled) return [];
      return [this.fmtStamp(this.span.from), this.fmtStamp(this.span.to)];
    },

    caption() {
      if (this.scaled) return "ตามเวลาที่ระบุในแผน";
      return "เรียงตามลำดับขั้นตอน — เวลาในแผนไม่ได้อยู่ในรูปแบบที่อ่านเป็นวันเวลาได้";
    }
  },

  methods: {
    normalize(rows) {
      return (rows || [])
        .filter(r => r && (r.step || r.start_date || r.end_date))
        .map((r, index) => ({
          seq: index + 1,
          step: r.step || `ขั้นตอนที่ ${index + 1}`,
          owner: r.owner || "",
          start: this.toTime(r.start_date),
          end: this.toTime(r.end_date)
        }));
    },

    // "2026-08-18 09:00" -> เวลาแบบตัวเลข / อ่านไม่ออกคืน null
    // เปลี่ยนช่องว่างเป็น T ก่อน เพราะ Safari ไม่รับรูปแบบที่มีช่องว่างคั่น
    toTime(value) {
      if (!value) return null;
      const parsed = Date.parse(String(value).trim().replace(" ", "T"));
      return Number.isNaN(parsed) ? null : parsed;
    },

    percent(at) {
      return ((at - this.span.from) / this.span.length) * 100;
    },

    // ความกว้างของช่วงที่สั้นมากจะบางจนมองไม่เห็น — กันขั้นต่ำไว้ 1.5%
    segmentStyle(row, index, total) {
      if (!this.scaled) {
        return { left: `${(index / total) * 100}%`, width: `${(1 / total) * 100}%` };
      }
      const left = this.percent(row.start);
      const width = Math.max(this.percent(row.end) - left, 1.5);
      return { left: `${left}%`, width: `${Math.min(width, 100 - left)}%` };
    },

    fmtStamp(at) {
      const d = new Date(at);
      return d.toLocaleString("th-TH", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
      });
    },

    fmtDate(value) {
      const at = this.toTime(value);
      if (at === null) return value;
      return new Date(at).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
    },

    rowLabel(row, lane) {
      const when = row.start === null ? "" : ` · ${this.fmtStamp(row.start)}`;
      const who = row.owner ? ` · ${row.owner}` : "";
      return `${lane} ${row.seq}: ${row.step}${when}${who}`;
    }
  }
};
</script>

<template>
  <figure class="cw" v-if="hasContent">
    <figcaption class="cw-head">
      <span class="cw-title">หน้าต่างการเปลี่ยนแปลง</span>
      <span class="cw-note">{{ caption }}</span>
    </figcaption>

    <div class="cw-track" :class="{ 'is-downtime': downtime }">
      <!-- เดินหน้า: แผนดำเนินงาน -->
      <div class="cw-lane cw-lane-forward">
        <div
          v-for="(row, i) in forward"
          :key="'f' + i"
          class="cw-seg cw-seg-forward"
          :style="segmentStyle(row, i, forward.length)"
          :title="rowLabel(row, 'ดำเนินงาน')"
        >
          <span class="cw-seg-text">{{ row.step }}</span>
        </div>
      </div>

      <div class="cw-axis">
        <span
          v-if="deployMark"
          class="cw-deploy"
          :style="{ left: deployMark.left + '%' }"
          :title="'เป้าหมาย Deploy ' + deployMark.label"
        >
          <span class="cw-deploy-label">Deploy {{ deployMark.label }}</span>
        </span>
      </div>

      <!-- เดินย้อน: แผนการกู้คืน (สะท้อนใต้แกน) -->
      <div class="cw-lane cw-lane-back">
        <div
          v-for="(row, i) in backward"
          :key="'b' + i"
          class="cw-seg cw-seg-back"
          :style="segmentStyle(row, i, backward.length)"
          :title="rowLabel(row, 'กู้คืน')"
        >
          <span class="cw-seg-text">{{ row.step }}</span>
        </div>
        <p v-if="backward.length === 0" class="cw-empty">ยังไม่มีแผนการกู้คืน</p>
      </div>
    </div>

    <!-- จอแคบ: แท่งบนแกนแคบจนอ่านไม่ออก กลายเป็นแถบสีเปล่าที่ไม่บอกอะไร
         สลับไปเป็นรายการขั้นตอนแทน ข้อมูลชุดเดียวกัน สลับด้วย CSS ไม่ต้องเช็คขนาดจอด้วย JS -->
    <ol class="cw-list">
      <li v-for="(row, i) in forward" :key="'lf' + i" class="cw-item cw-item-forward">
        <span class="cw-item-step">{{ row.step }}</span>
        <span class="cw-item-when">{{ row.start === null ? '—' : fmtStamp(row.start) }}</span>
      </li>
      <li v-for="(row, i) in backward" :key="'lb' + i" class="cw-item cw-item-back">
        <span class="cw-item-step">กู้คืน: {{ row.step }}</span>
        <span class="cw-item-when">{{ row.start === null ? '—' : fmtStamp(row.start) }}</span>
      </li>
    </ol>

    <div class="cw-foot">
      <span v-if="axisLabels.length" class="cw-stamp">{{ axisLabels[0] }}</span>
      <span class="cw-meta">
        <span class="cw-flag" :class="downtime ? 'is-on' : 'is-off'">
          {{ downtime ? 'ต้องปิดระบบ' : 'ไม่ต้องปิดระบบ' }}
        </span>
        <span v-if="duration" class="cw-duration">ระยะเวลา {{ duration }}</span>
      </span>
      <span v-if="axisLabels.length" class="cw-stamp">{{ axisLabels[1] }}</span>
    </div>
  </figure>
</template>

<style scoped>
/* หน้าต่างการเปลี่ยนแปลงคือ "กำหนดการ" ที่แนบมากับหนังสือ
   จึงล้อมด้วยกรอบเต็มเหมือนตารางแนบท้าย ไม่ใช่กราฟลอยบนหน้าเว็บ */
.cw {
  margin: 0 0 var(--lh);
  padding: var(--half);
  border: 1px solid var(--line);
}

.cw-head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--quarter) var(--half);
  padding-bottom: var(--quarter);
  margin-bottom: var(--half);
  border-bottom: 1px solid var(--line-faint);
}

.cw-title {
  font-size: 16px;
  font-weight: 700;
}

.cw-note {
  font-size: 14px;
  color: var(--ink-light);
}

.cw-track {
  position: relative;
}

/* ต้องปิดระบบ = ทั้งช่วงมีความเสี่ยง ไม่ใช่แค่ขั้นตอนใดขั้นตอนหนึ่ง
   แรเงาทั้งราง อย่างที่คนขีดทับช่วงเวลาบนกำหนดการด้วยดินสอ */
.cw-track.is-downtime {
  background-image: repeating-linear-gradient(
    -45deg,
    rgba(155, 27, 27, 0.10) 0 5px,
    transparent 5px 11px
  );
}

.cw-lane {
  position: relative;
  height: 38px;
}

/* แกนกลาง = เส้นเวลา */
.cw-axis {
  position: relative;
  height: 0;
  border-top: 1.5px solid var(--line);
}

.cw-deploy {
  position: absolute;
  top: -8px;
  width: 1px;
  height: 16px;
  background: var(--ink);
}

/* ป้ายอยู่เหนือแกน ในช่องว่างที่แท่งแผนงานไม่ได้ใช้
   วางใต้แกนจะไปทับแท่งแผนกู้คืนพอดี */
.cw-deploy-label {
  position: absolute;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  font-size: 13px;
  font-weight: 700;
  color: var(--ink);
  background: var(--sheet);
  padding: 0 var(--quarter);
  white-space: nowrap;
}

.cw-seg {
  position: absolute;
  height: 24px;
  display: flex;
  align-items: center;
  padding: 0 var(--quarter);
  overflow: hidden;
}

/* แผนดำเนินงานทึบ = สิ่งที่จะเกิดขึ้นแน่
   แผนกู้คืนเป็นเส้นประ = สิ่งที่จะทำต่อเมื่อล้มเหลว ยังไม่แน่ว่าได้ใช้ */
.cw-seg-forward {
  bottom: 0;
  background: var(--official);
  color: var(--sheet);
}

.cw-seg-back {
  top: 0;
  background: var(--sheet);
  color: var(--seal-deep);
  border: 1px dashed var(--seal-deep);
}

.cw-seg-text {
  font-size: 13px;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cw-empty {
  position: absolute;
  top: var(--quarter);
  left: 0;
  font-size: 14px;
  color: var(--ink-light);
}

.cw-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--half);
  flex-wrap: wrap;
  margin-top: var(--quarter);
  padding-top: var(--quarter);
  border-top: 1px solid var(--line-faint);
  font-size: 14px;
}

.cw-stamp {
  color: var(--ink-light);
}

.cw-meta {
  display: flex;
  align-items: center;
  gap: var(--half);
}

.cw-flag {
  font-weight: 700;
}

.cw-flag.is-on {
  color: var(--seal);
}

.cw-flag.is-off {
  color: var(--ink-light);
  font-weight: 400;
}

.cw-duration {
  color: var(--ink-light);
}

/* รายการขั้นตอน — โผล่เฉพาะจอแคบ */
.cw-list {
  display: none;
  list-style: none;
  margin: 0;
  padding: 0;
}

.cw-item {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--half);
  padding: var(--quarter) 0 var(--quarter) var(--half);
  border-bottom: 1px solid var(--line-faint);
  border-left: 3px solid var(--official);
  font-size: 14px;
}

.cw-item-back {
  border-left-style: dashed;
  border-left-color: var(--seal-deep);
  color: var(--seal-deep);
}

.cw-item-when {
  flex: none;
  color: var(--ink-light);
}

/* จอแคบ: แกนเวลาแคบจนแท่งไม่มีความหมาย — สลับไปใช้รายการแทน */
@media screen and (max-width: 560px) {
  .cw-track {
    display: none;
  }

  .cw-list {
    display: block;
  }

  .cw-foot {
    justify-content: flex-start;
  }
}

/* พื้นหลังไม่ถูกพิมพ์ตาม default ของ browser — ให้แท่งเป็นเส้นขอบแทนพื้นทึบตอนพิมพ์
   ได้ทั้งคนที่ปิด print backgrounds (ไม่งั้นแท่งหายหมด) และคนที่เปิด (ไม่กินหมึก) */
@media print {
  .cw-seg-forward {
    background: none;
    color: var(--official);
    border: 1.5px solid var(--official);
  }

  .cw-track.is-downtime {
    background-image: none;
  }
}
</style>
