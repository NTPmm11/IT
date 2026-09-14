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

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-card {
  background: #fff;
  border-radius: 16px;
  padding: 32px 28px;
  max-width: 380px;
  width: 100%;
  text-align: center;
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.3);
}

.modal-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.icon-success { color: #16a34a; }
.icon-error { color: #dc2626; }

.modal-title {
  font-size: 18px;
  color: #00112c;
  margin-bottom: 8px;
}

.modal-message {
  font-size: 14px;
  color: #4b5563;
  line-height: 1.6;
  margin-bottom: 24px;
  white-space: pre-line;
}

.modal-close-btn {
  width: 100%;
  justify-content: center;
}
</style>
