<script>

export default {
  name: "StatusModal",

  props: {
    show: { type: Boolean, default: false },
    variant: { type: String, default: "success" },
    title: { type: String, default: "" },
    message: { type: String, default: "" }
  },

  emits: ["close"]
};
</script>

<template>
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
  max-width: 460px;
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
  max-height: 45vh;
  overflow-y: auto;
}

.modal-close-btn {
  width: 100%;
  justify-content: center;
}
</style>
