<script>
export default {
  name: "DateInputTH",

  props: {
    modelValue: { type: String, default: "" },
    required: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    id: { type: String, default: undefined }
  },

  emits: ["update:modelValue"],

  data() {
    return { text: this.isoToDisplay(this.modelValue) };
  },

  watch: {
    modelValue(value) {
      const display = this.isoToDisplay(value);
      if (display !== this.text) this.text = display;
    }
  },

  methods: {
    isoToDisplay(iso) {
      const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
    },

    displayToIso(display) {
      const match = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!match) return "";
      const [, d, m, y] = match;
      const day = Number(d);
      const month = Number(m);
      const year = Number(y);
      const date = new Date(year, month - 1, day);
      const isValid = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
      return isValid ? `${y}-${m}-${d}` : "";
    },

    handleInput(event) {
      const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
      let formatted = digits;
      if (digits.length > 4) {
        formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
      } else if (digits.length > 2) {
        formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
      }
      this.text = formatted;
      this.$emit("update:modelValue", this.displayToIso(formatted));
    },

    handleNativeChange(event) {
      const iso = event.target.value;
      this.text = this.isoToDisplay(iso);
      this.$emit("update:modelValue", iso);
    },

    openPicker() {
      const el = this.$refs.nativeDate;
      if (!el || this.disabled) return;
      if (typeof el.showPicker === "function") {
        el.showPicker();
      } else {
        el.focus();
        el.click();
      }
    }
  }
};
</script>

<template>
  <div class="date-th-wrap">
    <input
      type="text"
      class="date-th-input"
      :id="id"
      :value="text"
      @input="handleInput"
      placeholder="วว/ดด/ปปปป"
      inputmode="numeric"
      autocomplete="off"
      maxlength="10"
      pattern="\d{2}/\d{2}/\d{4}"
      :required="required"
      :disabled="disabled"
    >
    <button
      type="button"
      class="date-th-pick-btn"
      :disabled="disabled"
      tabindex="-1"
      aria-label="เลือกวันที่จากปฏิทิน"
      @click="openPicker"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    </button>
    <input
      ref="nativeDate"
      type="date"
      class="date-th-native"
      tabindex="-1"
      :disabled="disabled"
      :value="modelValue"
      @input="handleNativeChange"
    >
  </div>
</template>

<style scoped>
.date-th-wrap {
  position: relative;
  width: 100%;
}

.date-th-input {
  padding-right: 28px !important;
}

.date-th-pick-btn {
  position: absolute;
  right: 3px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  background: none;
  color: #00075a;
  cursor: pointer;
  line-height: 1;
  padding: 3px;
  transition: background-color 0.2s;
}

.date-th-pick-btn:hover:not(:disabled) {
  background-color: rgba(0, 7, 90, 0.1);
}

.date-th-pick-btn:disabled {
  cursor: not-allowed;
  color: #9e9797;
}

.date-th-native {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  pointer-events: none;
  border: none;
  padding: 0;
  margin: 0;
}
</style>
